import hashlib
import json

from fastapi import HTTPException
from pypdf import PdfReader
from io import BytesIO
from sqlalchemy.orm import Session

from app.models.course import Course, CourseDetail

SYSTEM_PROMPT = """당신은 대학 강의 계획서를 분석하는 전문가입니다.
모든 텍스트 필드(overview, goals, evaluation_method, teaching_method, keyword)는 강의계획서가 영어로 작성되어 있더라도 반드시 한국어로 작성하세요. 단, 프로그래밍 언어·기술 용어 등 전문 용어는 영어 그대로 사용해도 됩니다.
입력 텍스트에 한자·일본어·힌디어·그리스 문자 등이 섞여 있으면 PDF 인코딩 오류입니다. 해당 문자는 무시하고, 주변 문맥을 바탕으로 자연스러운 한국어 문장으로 직접 작성하세요. 오류 문자를 그대로 포함하거나 단순 제거하지 말고, 처음부터 올바른 한국어로 표현하세요.
반환하는 JSON의 모든 문자열 값은 한국어와 영어(전문용어)만 사용하세요.
아래 텍스트에서 다음 항목을 추출하여 JSON으로 반환하세요.
JSON만 반환하고 다른 텍스트나 마크다운 코드블록은 포함하지 마세요.
{
  "course_code": "강의 코드. 반드시 CSE로 시작하는 7자리 코드(예: CSE2001)만 추출. 분반번호(-01 등), 괄호, AIE 코드 등 나머지는 모두 무시. 없으면 null",
  "year": 2026,
  "semester": 1,
  "overview": "강의 개요 2-3문장 (없으면 null)",
  "goals": "강의 목표 (없으면 null)",
  "evaluation_method": "평가 방식 요약 (예: 중간고사 30% 기말고사 40% 과제 20% 출석 10%, 없으면 null)",
  "teaching_method": "수업 방식 비율. 0%인 항목은 제외하고, 비율이 있는 항목만 한국어로 간결하게 작성 (예: 강의80 토론20, 강의50 실습50). 영어 표기는 한국어로 변환. '입니다' 등 불필요한 문장 종결어 제외. 없으면 null",
  "track_id": 3,
  "keyword": "기타 특징 (예: 프로젝트 3개 과제 4개, 없으면 null)",
  "professor_name": "담당 교수 이름. 영어로 표기된 경우 한국어 성명으로 변환 (예: Youngmin Yi → 이영민). 없으면 null"
}
year는 정수, semester는 1 또는 2 정수로만 반환하세요.
track_id는 아래 목록에서 강의 내용과 가장 관련 있는 직무 1개를 정수로 반환하세요.
1:데이터분석, 2:데이터관리, 3:백엔드, 4:프론트엔드, 5:웹/앱,
6:AI, 7:DevOps, 8:네트워크, 9:보안, 10:QA,
11:게임, 12:임베디드, 13:IT컨설팅, 14:컴퓨터교육
관련 트랙을 모르겠으면 null로 반환하세요."""


def extract_pdf_text(file_bytes: bytes) -> str:
    import logging
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    reader = PdfReader(BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def _parse_json_response(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"AI 응답을 파싱할 수 없습니다: {raw[:200]}")


def summarize_with_claude(text: str) -> dict:
    try:
        import anyio
        from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
    except ImportError:
        raise HTTPException(status_code=500, detail="claude-agent-sdk 미설치 — pip install claude-agent-sdk")

    prompt = f"{SYSTEM_PROMPT}\n\n강의계획서:\n\n{text[:8000]}"

    async def _run() -> str:
        async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(max_turns=1),
        ):
            if isinstance(message, ResultMessage):
                return message.result
        return ""

    raw = anyio.run(_run)
    return _parse_json_response(raw)


def process_syllabus(db: Session, file_bytes: bytes) -> tuple:
    """
    Returns: (CourseDetail, course, cached: bool)
    """
    pdf_hash = hashlib.sha256(file_bytes).hexdigest()

    existing = db.query(CourseDetail).filter(CourseDetail.pdf_hash == pdf_hash).first()
    if existing:
        course = db.query(Course).filter(Course.course_id == existing.course_id).first()
        return existing, course, True

    raw_text = extract_pdf_text(file_bytes)
    if not raw_text:
        raise HTTPException(status_code=400, detail="PDF에서 텍스트를 추출할 수 없습니다")

    result = summarize_with_claude(raw_text)

    course_code = result.get("course_code")
    year = result.get("year")
    semester = result.get("semester")

    if not course_code or not year or not semester:
        raise HTTPException(status_code=422, detail="강의 코드 또는 학기 정보를 찾을 수 없습니다")

    course = (
        db.query(Course)
        .filter(
            Course.course_code == course_code,
            Course.year == year,
            Course.semester == semester,
        )
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=404,
            detail=f"강의를 찾을 수 없습니다 (course_code={course_code}, year={year}, semester={semester})"
        )

    detail = db.query(CourseDetail).filter(CourseDetail.course_id == course.course_id).first()
    if detail is None:
        detail = CourseDetail(course_id=course.course_id)
        db.add(detail)

    detail.overview = result.get("overview")
    detail.required_skills = result.get("goals")
    detail.evaluation_method = result.get("evaluation_method")
    detail.teaching_method = result.get("teaching_method")
    detail.track_id = result.get("track_id")
    detail.keyword = result.get("keyword")
    detail.pdf_hash = pdf_hash

    db.commit()
    db.refresh(detail)

    return detail, course, False
