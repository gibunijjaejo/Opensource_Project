"""서간표 자체 MCP 서버 — Claude Desktop / Claude Code에서 stdio로 붙어 사용.

도구 로직은 app/services/admin_assistant.py에 있고, 이 파일은 FastMCP 래퍼만.
같은 함수들을 admin 챗 UI 백엔드(app/api/admin_chat.py)에서도 직접 import해서 재사용한다.

실행:
    .venv-mcp/Scripts/python scripts/mcp_seoganpyo.py
"""
import sys
from contextlib import contextmanager
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

from sqlalchemy.orm import Session

from app.database import SessionLocal
# SQLAlchemy 매퍼 초기화 — relationship() 클래스명 resolve 위해 전 모델 import 필요.
# (app/main.py:11과 동일한 이유)
from app.models import (  # noqa: F401
    user,
    course,
    professor,
    activity,
    post,
    report,
    notice,
    portfolio as portfolio_models,
    contact as contact_model,
    admin_message,
)
from app.services import admin_assistant
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("seoganpyo")


@contextmanager
def session_scope() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@mcp.tool()
def search_courses(
    query: str,
    year: int | None = None,
    semester: int | None = None,
    limit: int = 20,
) -> list[dict]:
    """강의명으로 강의를 검색합니다 (부분 일치).

    Args:
        query: 검색할 강의명
        year: 연도 필터 (예: 2026)
        semester: 학기 필터 (1 또는 2)
        limit: 최대 반환 개수 (기본 20)
    """
    with session_scope() as db:
        return admin_assistant.search_courses(db, query, year, semester, limit)


@mcp.tool()
def get_popular_courses(year: int, semester: int, limit: int = 10) -> list[dict]:
    """수강이력 기준 가장 많이 들은 과목 TOP N (OCR 매칭 빈도)."""
    with session_scope() as db:
        return admin_assistant.get_popular_courses(db, year, semester, limit)


@mcp.tool()
def get_user_stats() -> dict:
    """전체 사용자 통계 — 가입자 수, 관리자, 학기별 분포 등."""
    with session_scope() as db:
        return admin_assistant.get_user_stats(db)


@mcp.tool()
def get_history_coverage(year: int, semester: int) -> dict:
    """특정 학기의 수강이력 커버리지 — OCR 사용 정도 지표."""
    with session_scope() as db:
        return admin_assistant.get_history_coverage(db, year, semester)


@mcp.tool()
def get_unused_courses(year: int, semester: int, limit: int = 30) -> list[dict]:
    """DB엔 있지만 수강이력에 한 번도 잡히지 않은 과목 — OCR 매칭 실패 후보."""
    with session_scope() as db:
        return admin_assistant.get_unused_courses(db, year, semester, limit)


@mcp.tool()
def get_evaluation_stats(days: int = 7) -> dict:
    """포트폴리오 AI 평가 통계 — 최근 N일 성공/실패 분포와 실패 사유."""
    with session_scope() as db:
        return admin_assistant.get_evaluation_stats(db, days)


# ─── 인프라 도구 (DB 세션 불필요) ─────────────────────────────────
@mcp.tool()
def query_prometheus(promql: str, minutes: int = 60, step_seconds: int = 60) -> dict:
    """PromQL로 Prometheus 메트릭을 범위 쿼리합니다.

    예: 'sum(rate(http_requests_total{status="5xx"}[5m]))'
    """
    return admin_assistant.query_prometheus(promql, minutes, step_seconds)


@mcp.tool()
def get_container_status() -> list[dict]:
    """seoganpyo-* 도커 컨테이너 상태와 CPU/메모리 사용률."""
    return admin_assistant.get_container_status()


if __name__ == "__main__":
    mcp.run()
