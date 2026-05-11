"""보안 모니터링 페이지 사이드바용 챗 API — Gemini function calling 으로 DefectDojo 도구 호출.

흐름:
  1. POST /admin/security/chat/ask {message, history?}
  2. Gemini 에 보안 도구 5개(SECURITY_TOOL_REGISTRY) 노출
  3. Gemini 가 도구 호출하면 백엔드가 실행 후 결과 재전달
  4. 최종 텍스트 답변 + 호출된 도구/인자/결과 리스트 반환

admin_chat.py 의 Gemini 헬퍼(_call_gemini, _to_gemini_tool_decls 등)를 재사용.
"""
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.admin import get_current_admin
from app.api.admin_chat import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    MAX_TOOL_ITERATIONS,
    ChatMessage,
    ToolCallRecord,
    _call_gemini,
)
from app.models.user import User
from app.services import admin_security_assistant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/security/chat", tags=["Admin - Security Chat"])

SECURITY_SYSTEM_PROMPT = """당신은 서간표(학생 시간표·강의 추천 서비스)의 보안 운영 어시스턴트입니다.

관리자가 자연어로 묻는 보안 관련 질문에, 제공된 DefectDojo 도구를 사용해 정확한 데이터를 조회한 뒤 답변하세요.

도구 (read-only, 5개):
- get_security_summary: 심각도·카테고리별 카운트
- list_findings: finding 리스트 (severity/category/limit 필터)
- get_finding_detail: 특정 finding 의 description/mitigation/references
- get_health: DefectDojo 연결 상태 점검
- compare_with_last_week: 최근 7일 신규/mitigated 트렌드

답변 원칙:
- 추측하지 말고 도구를 호출해서 사실 기반으로 답하세요.
- "Critical 몇 개?" 같은 간단한 질문은 get_security_summary 한 번이면 충분합니다.
- 특정 finding 의 픽스 방법을 물으면 get_finding_detail 로 mitigation 을 가져오세요.
- 심각도 표기는 한국어 그대로(Critical/High/Medium/Low/Info) 또는 색 비유 가능.
- 결과 숫자를 정확히 인용하고, CVE ID / 패키지 버전 등 식별자를 함께 표시하세요.
- 도구 호출에 error 가 있으면 사실대로 알리고 가능한 원인(DefectDojo 다운, 토큰 만료 등)을 짚어주세요.
- 답변은 한국어, 마크다운 사용 가능, 길이는 간결하게.
"""


class SecurityChatAskRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class SecurityChatAskResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]
    iterations: int
    model: str


_TYPE_MAP = {
    "string": "STRING",
    "integer": "INTEGER",
    "number": "NUMBER",
    "boolean": "BOOLEAN",
}


def _to_security_tool_decls() -> list[dict]:
    """SECURITY_TOOL_REGISTRY → Gemini functionDeclarations 형식."""
    decls = []
    for t in admin_security_assistant.SECURITY_TOOL_REGISTRY:
        properties: dict[str, dict] = {}
        required: list[str] = []
        for pname, pinfo in t["params"].items():
            gtype = _TYPE_MAP.get(pinfo["type"], "STRING")
            properties[pname] = {"type": gtype, "description": pinfo["description"]}
            if pinfo.get("required"):
                required.append(pname)
        decl: dict[str, Any] = {"name": t["name"], "description": t["description"]}
        if properties:
            schema: dict[str, Any] = {"type": "OBJECT", "properties": properties}
            if required:
                schema["required"] = required
            decl["parameters"] = schema
        decls.append(decl)
    return decls


def _run_security_tool(name: str, args: dict) -> Any:
    """보안 도구 실행. HTTPException 은 error dict 로 변환해 Gemini 가 사용자에게 설명 가능하게."""
    tool = admin_security_assistant.SECURITY_TOOLS_BY_NAME.get(name)
    if not tool:
        return {"error": f"unknown tool: {name}"}
    try:
        return tool["fn"](**args)
    except HTTPException as e:
        return {"error": f"DefectDojo 호출 실패 ({e.status_code}): {e.detail}"}
    except TypeError as e:
        return {"error": f"잘못된 인자: {e}", "args": args}
    except Exception as e:  # noqa: BLE001
        logger.exception("security tool %s 실행 실패", name)
        return {"error": f"도구 실행 오류: {type(e).__name__}: {e}"}


@router.post("/ask", response_model=SecurityChatAskResponse)
def ask(
    req: SecurityChatAskRequest,
    admin: User = Depends(get_current_admin),
):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "MYKEY":
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY 가 .env 에 설정되지 않았습니다.",
        )
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="질문이 비어있습니다.")

    tool_decls = _to_security_tool_decls()

    contents: list[dict] = []
    for m in req.history:
        role = "model" if m.role == "model" else "user"
        contents.append({"role": role, "parts": [{"text": m.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    tool_calls: list[ToolCallRecord] = []
    used_model = GEMINI_MODEL

    for iteration in range(1, MAX_TOOL_ITERATIONS + 1):
        data, used_model = _call_gemini(contents, tool_decls, SECURITY_SYSTEM_PROMPT)

        candidates = data.get("candidates") or []
        if not candidates:
            return SecurityChatAskResponse(
                answer="(AI 가 빈 응답을 보냈어요)",
                tool_calls=tool_calls,
                iterations=iteration,
                model=used_model,
            )
        parts = candidates[0].get("content", {}).get("parts", [])

        function_calls = [p for p in parts if "functionCall" in p]
        text_chunks = [p["text"] for p in parts if "text" in p and p.get("text")]

        if not function_calls:
            answer = "\n".join(text_chunks).strip() or "(AI 가 답변을 생성하지 못했어요)"
            return SecurityChatAskResponse(
                answer=answer,
                tool_calls=tool_calls,
                iterations=iteration,
                model=used_model,
            )

        contents.append({"role": "model", "parts": parts})

        result_parts: list[dict] = []
        for fc_part in function_calls:
            fc = fc_part["functionCall"]
            name = fc.get("name", "")
            args = fc.get("args", {}) or {}

            t0 = time.monotonic()
            result = _run_security_tool(name, args)
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

    return SecurityChatAskResponse(
        answer="(도구 호출 반복 한도에 도달해 답변을 마치지 못했습니다)",
        tool_calls=tool_calls,
        iterations=MAX_TOOL_ITERATIONS,
        model=used_model,
    )


@router.get("/tools")
def list_tools(admin: User = Depends(get_current_admin)):
    """UI 에서 사용 가능한 도구 목록 표시용 메타데이터."""
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "params": t["params"],
        }
        for t in admin_security_assistant.SECURITY_TOOL_REGISTRY
    ]
