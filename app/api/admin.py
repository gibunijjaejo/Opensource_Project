import os
from fastapi import APIRouter, Depends, Header, HTTPException
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
