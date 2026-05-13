from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.database import get_db
from app.models.professor import Professor
from app.schemas.course import ProfessorResponse

router = APIRouter(prefix="/api/v1/professors", tags=["Professors"])

# 프로필 노출 대상 학과 — 교양 교수는 목록·상세 어디에도 노출하지 않는다.
PROFILE_DEPARTMENT = "컴퓨터공학과"


@router.get("", response_model=List[ProfessorResponse])
def get_professors(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="교수명 검색"),
):
    query = (
        db.query(Professor)
        .options(joinedload(Professor.details))
        .filter(Professor.department == PROFILE_DEPARTMENT)
    )
    if q:
        query = query.filter(Professor.name.ilike(f"%{q}%"))
    return query.order_by(Professor.name).all()


@router.get("/{professor_id}", response_model=ProfessorResponse)
def get_professor(professor_id: int, db: Session = Depends(get_db)):
    prof = (
        db.query(Professor)
        .options(joinedload(Professor.details))
        .filter(
            Professor.professor_id == professor_id,
            Professor.department == PROFILE_DEPARTMENT,
        )
        .first()
    )
    if not prof:
        raise HTTPException(status_code=404, detail="교수를 찾을 수 없습니다.")
    return prof
