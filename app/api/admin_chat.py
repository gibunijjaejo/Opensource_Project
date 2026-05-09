"""admin 챗 API — Gemini tool use를 거쳐 admin_assistant 도구를 호출.

흐름:
  1. POST /admin/chat/ask {message, history?}
  2. Gemini에 도구 9개(DB 6 + 인프라 3) 노출
  3. Gemini가 도구 호출하면 백엔드가 실행 후 결과를 다시 Gemini에 전달
  4. 최종 텍스트 답변 + 호출된 도구/인자/결과 리스트 반환
  5. 프론트는 답변 본문 + 호출된 도구 메타데이터를 함께 표시 (시연·디버깅용)

raw httpx로 Gemini API 호출 (app/services/ai_service.py와 같은 패턴).
"""
import logging
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.admin import get_current_admin
from app.database import get_db
from app.models.user import User
from app.services import admin_assistant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/chat", tags=["AdminChat"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "MYKEY")
GEMINI_MODEL = os.getenv("ADMIN_CHAT_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
# 503/UNAVAILABLE 시 자동 폴백 모델 (시연 안정성용)
# gemini-2.0 계열은 2026년부터 신규 사용자에게 deprecated → 2.5 계열로.
FALLBACK_MODEL = os.getenv("ADMIN_CHAT_FALLBACK_MODEL", "gemini-2.5-flash-lite")
GEMINI_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

MAX_TOOL_ITERATIONS = 6  # 무한루프 방지
MAX_503_RETRIES = 1  # 같은 모델로 재시도 횟수 (그 후 폴백 모델로 전환)

SYSTEM_PROMPT = """당신은 서간표(학생 시간표·강의 추천 서비스)의 운영 어시스턴트입니다.

관리자가 자연어로 묻는 질문에, 제공된 도구를 사용해 정확한 데이터를 조회한 뒤 답변하세요.

도구 카테고리:
- DB 도구: 강의 검색, 인기 과목, 사용자 통계, OCR 매칭 커버리지, AI 평가 통계
- 인프라 도구: Loki 로그 검색, Prometheus 메트릭 쿼리, Docker 컨테이너 상태

답변 원칙:
- 추측하지 말고 도구를 호출해서 사실 기반으로 답하세요.
- 한 번에 여러 도구를 병렬로 호출해도 좋습니다.
- 결과 숫자를 정확히 인용하고, 컨텍스트(연도/학기/기간 등)도 함께 표시하세요.
- 도구 호출 결과에 error가 있으면 그 사실을 사용자에게 알리고, 가능한 원인(관측 스택 미기동 등)을 짚어주세요.
- 답변은 한국어, 마크다운 사용 가능.
- 학생 PII(이메일, 학번)가 결과에 들어있을 수 있는데, 시연용 dev 환경이므로 그대로 인용해도 됩니다.
"""


# ─── 요청/응답 스키마 ─────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" | "model"
    content: str


class ChatAskRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ToolCallRecord(BaseModel):
    name: str
    args: dict
    result: Any
    duration_ms: int


class ChatAskResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]
    iterations: int
    model: str


# ─── Gemini tool 스키마 변환 ───────────────────────────────────────
_TYPE_MAP = {
    "string": "STRING",
    "integer": "INTEGER",
    "number": "NUMBER",
    "boolean": "BOOLEAN",
}


def _to_gemini_tool_decls() -> list[dict]:
    """admin_assistant.TOOL_REGISTRY → Gemini functionDeclarations 형식."""
    decls = []
    for t in admin_assistant.TOOL_REGISTRY:
        properties: dict[str, dict] = {}
        required: list[str] = []
        for pname, pinfo in t["params"].items():
            gtype = _TYPE_MAP.get(pinfo["type"], "STRING")
            properties[pname] = {"type": gtype, "description": pinfo["description"]}
            if pinfo.get("required"):
                required.append(pname)
        params_schema: dict[str, Any] = {"type": "OBJECT"}
        if properties:
            params_schema["properties"] = properties
        if required:
            params_schema["required"] = required
        # 파라미터가 하나도 없는 도구는 parameters 자체를 빼야 Gemini가 거부 안 함
        decl: dict[str, Any] = {"name": t["name"], "description": t["description"]}
        if properties:
            decl["parameters"] = params_schema
        decls.append(decl)
    return decls


# ─── 도구 실행 ────────────────────────────────────────────────────
def _run_tool(name: str, args: dict, db: Session) -> Any:
    tool = admin_assistant.TOOLS_BY_NAME.get(name)
    if not tool:
        return {"error": f"unknown tool: {name}"}
    fn = tool["fn"]
    try:
        if name in admin_assistant.DB_TOOLS:
            return fn(db, **args)
        return fn(**args)
    except TypeError as e:
        return {"error": f"잘못된 인자: {e}", "args": args}
    except Exception as e:
        logger.exception("tool %s 실행 실패", name)
        return {"error": f"도구 실행 오류: {type(e).__name__}: {e}"}


# ─── Gemini 호출 ──────────────────────────────────────────────────
def _is_unavailable(status_code: int, body_text: str) -> bool:
    """503 또는 UNAVAILABLE 응답인지 판정."""
    if status_code == 503:
        return True
    if status_code == 429:
        return True  # rate limit도 폴백 트리거
    return "UNAVAILABLE" in body_text.upper() or "high demand" in body_text.lower()


def _post_gemini(model: str, payload: dict) -> tuple[int, str, dict | None]:
    url = GEMINI_URL_TEMPLATE.format(model=model)
    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            url,
            params={"key": GEMINI_API_KEY},
            json=payload,
            headers={"Content-Type": "application/json"},
        )
    text = res.text
    body_json: dict | None = None
    if res.status_code == 200:
        try:
            body_json = res.json()
        except ValueError:
            body_json = None
    return res.status_code, text, body_json


def _call_gemini(contents: list[dict], tool_decls: list[dict]) -> tuple[dict, str]:
    """Gemini 호출. 503/UNAVAILABLE 시 같은 모델로 재시도 후 폴백 모델로 전환.

    Returns:
        (응답 JSON, 실제 사용된 모델명)
    """
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "tools": [{"functionDeclarations": tool_decls}],
        "generationConfig": {"temperature": 0.2},
    }

    candidates_models = [GEMINI_MODEL]
    if FALLBACK_MODEL and FALLBACK_MODEL != GEMINI_MODEL:
        candidates_models.append(FALLBACK_MODEL)

    last_status = 0
    last_body = ""

    for model in candidates_models:
        for attempt in range(MAX_503_RETRIES + 1):
            status, body_text, body_json = _post_gemini(model, payload)
            if status == 200 and body_json is not None:
                return body_json, model
            last_status, last_body = status, body_text
            if not _is_unavailable(status, body_text):
                # 비-503 오류는 즉시 중단 (모델 변경해도 같은 결과)
                logger.error("Gemini %s %d: %s", model, status, body_text[:300])
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini API 오류 ({status}): {body_text[:300]}",
                )
            logger.warning(
                "Gemini %s 503/UNAVAILABLE (시도 %d/%d): %s",
                model, attempt + 1, MAX_503_RETRIES + 1, body_text[:200],
            )
            time.sleep(1.0 + attempt)  # 1초, 2초

    # 모든 모델·재시도 실패
    logger.error("Gemini 모든 모델 실패: 마지막 %d %s", last_status, last_body[:200])
    raise HTTPException(
        status_code=503,
        detail=(
            "AI 서버가 일시적으로 바빠요. 잠시 후 다시 시도해주세요. "
            f"(시도한 모델: {', '.join(candidates_models)})"
        ),
    )


# ─── 메인 엔드포인트 ──────────────────────────────────────────────
@router.post("/ask", response_model=ChatAskResponse)
def ask(
    req: ChatAskRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "MYKEY":
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY가 .env에 설정되지 않았습니다. 운영자에게 문의하세요.",
        )
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="질문이 비어있습니다.")

    tool_decls = _to_gemini_tool_decls()

    # 대화 컨텍스트 구성 — Gemini는 role: "user" / "model"만 허용
    contents: list[dict] = []
    for m in req.history:
        role = "model" if m.role == "model" else "user"
        contents.append({"role": role, "parts": [{"text": m.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    tool_calls: list[ToolCallRecord] = []
    used_model = GEMINI_MODEL

    for iteration in range(1, MAX_TOOL_ITERATIONS + 1):
        data, used_model = _call_gemini(contents, tool_decls)

        candidates = data.get("candidates") or []
        if not candidates:
            return ChatAskResponse(
                answer="(AI가 빈 응답을 보냈어요)",
                tool_calls=tool_calls,
                iterations=iteration,
                model=used_model,
            )
        parts = candidates[0].get("content", {}).get("parts", [])

        function_calls = [p for p in parts if "functionCall" in p]
        text_chunks = [p["text"] for p in parts if "text" in p and p.get("text")]

        if not function_calls:
            answer = "\n".join(text_chunks).strip() or "(AI가 답변을 생성하지 못했어요)"
            return ChatAskResponse(
                answer=answer,
                tool_calls=tool_calls,
                iterations=iteration,
                model=used_model,
            )

        # 모델 응답을 그대로 contents에 추가 (multi-turn function calling 규약)
        contents.append({"role": "model", "parts": parts})

        # 모든 function_call 실행 → 결과를 user 턴에 묶어서 추가
        result_parts: list[dict] = []
        for fc_part in function_calls:
            fc = fc_part["functionCall"]
            name = fc.get("name", "")
            args = fc.get("args", {}) or {}

            t0 = time.monotonic()
            result = _run_tool(name, args, db)
            duration_ms = int((time.monotonic() - t0) * 1000)

            tool_calls.append(
                ToolCallRecord(
                    name=name, args=args, result=result, duration_ms=duration_ms
                )
            )
            result_parts.append(
                {
                    "functionResponse": {
                        "name": name,
                        "response": {"content": result},
                    }
                }
            )
        contents.append({"role": "user", "parts": result_parts})

    # 반복 한도 도달
    return ChatAskResponse(
        answer="(도구 호출 반복 한도에 도달해 답변을 마치지 못했습니다)",
        tool_calls=tool_calls,
        iterations=MAX_TOOL_ITERATIONS,
        model=used_model,
    )


# ─── 메타데이터 (UI에서 사용 가능한 도구 목록 표시용) ─────────────
@router.get("/tools")
def list_tools(admin: User = Depends(get_current_admin)):
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "params": t["params"],
        }
        for t in admin_assistant.TOOL_REGISTRY
    ]
