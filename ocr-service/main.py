import base64
import io
import json
import os

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

app = FastAPI(title="OCR Service")

_MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

_PROMPT = """이 이미지는 대학교 시간표입니다.
시간표에서 다음 정보를 추출하여 JSON으로만 반환하세요. JSON 외 다른 텍스트나 마크다운은 포함하지 마세요.

{
  "course_names": ["과목명1", "과목명2", ...],
  "year": 연도(정수 또는 null),
  "semester": 학기(1 또는 2 정수, 없으면 null)
}

규칙:
- course_names: 시간표에 보이는 모든 과목명만 추출. 요일/시간/강의실/교수명/학점은 제외
- 과목명이 줄바꿈되어 있어도 하나로 합쳐서 반환
- year: 시간표에 표시된 연도 (예: 2026)
- semester: 1학기면 1, 2학기면 2"""


def _to_jpeg_b64(contents: bytes) -> str:
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)):
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY 환경변수가 설정되지 않았습니다")

    contents = await file.read()
    b64 = _to_jpeg_b64(contents)

    payload = {
        "model": "pixtral-12b-2409",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            _MISTRAL_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Mistral API 오류: {resp.text[:200]}")

    raw = resp.json()["choices"][0]["message"]["content"]
    try:
        result = _parse_json(raw)
    except (json.JSONDecodeError, KeyError, IndexError):
        raise HTTPException(status_code=502, detail=f"Mistral 응답 파싱 실패: {raw[:200]}")

    return {
        "course_names": result.get("course_names", []),
        "year": result.get("year"),
        "semester": result.get("semester"),
    }
