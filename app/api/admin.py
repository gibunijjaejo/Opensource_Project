import os
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.crawl_service import crawl_and_upsert

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-in-production")


def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")


@router.post("/crawl/professors")
def crawl_professors(
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """
    서강대 CS 교수 페이지를 크롤링하여 professor_details 테이블을 갱신합니다.

    - updated: 정상 업데이트된 교수 목록
    - not_found_in_db: 웹에는 있지만 DB에 없는 교수 (수동 검토 필요)
    - db_only: DB에는 있지만 웹에 없는 교수 (변경 없음)
    """
    return crawl_and_upsert(db)


@router.get("/crawl/professors/test")
def test_crawl_professor(
    url: str,
    _: None = Depends(verify_admin),
):
    """단일 교수 상세 페이지 파싱 + 요약 결과 확인 (DB 저장 없음)"""
    from app.services.crawl_service import _parse_detail_page, _summarize_research_area, _to_plain
    detail = _parse_detail_page(url)
    plain = _to_plain(detail.get("research_area") or "")
    detail["research_summary"] = _summarize_research_area(plain) if plain else None
    return detail


class SummarizeBody(BaseModel):
    prompt_override: str | None = None  # None이면 기본 프롬프트 사용


@router.post("/professors/summarize-all")
def resummarize_all(
    body: SummarizeBody = SummarizeBody(),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """research_area가 있는 모든 교수의 research_summary를 재생성합니다."""
    from app.models.professor import ProfessorDetail
    from app.services.crawl_service import _summarize_research_area, _to_plain

    details = db.query(ProfessorDetail).filter(ProfessorDetail.research_area.isnot(None)).all()
    results = []
    for detail in details:
        plain = _to_plain(detail.research_area)
        if not plain:
            continue
        print(f"[Ollama] {detail.name} 요약 중...", flush=True)
        summary = _summarize_research_area(plain, prompt_override=body.prompt_override)
        if summary:
            detail.research_summary = summary
            results.append({"professor_id": detail.professor_id, "name": detail.name, "research_summary": summary})
            print(f"[Ollama] {detail.name} 완료", flush=True)

    db.commit()
    return {"updated_count": len(results), "results": results}


@router.post("/professors/{professor_id}/summarize")
def resummmarize_professor(
    professor_id: int,
    body: SummarizeBody = SummarizeBody(),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """특정 교수의 research_summary를 재생성합니다. prompt_override로 프롬프트 커스텀 가능."""
    from app.models.professor import ProfessorDetail
    from app.services.crawl_service import _summarize_research_area, _to_plain

    detail = db.query(ProfessorDetail).filter(
        ProfessorDetail.professor_id == professor_id
    ).first()
    if not detail:
        raise HTTPException(status_code=404, detail="교수 정보를 찾을 수 없습니다.")
    if not detail.research_area:
        raise HTTPException(status_code=400, detail="research_area 데이터가 없습니다.")

    plain = _to_plain(detail.research_area)
    summary = _summarize_research_area(plain, prompt_override=body.prompt_override)
    if not summary:
        raise HTTPException(status_code=502, detail="Ollama 요약 실패")

    detail.research_summary = summary
    db.commit()
    return {"professor_id": professor_id, "research_summary": summary}
