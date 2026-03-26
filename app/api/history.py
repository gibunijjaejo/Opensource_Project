from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_student_id
from app.schemas.history import HistoryCreate, HistoryResponse, HistoryUpdate
from app.services import history_service

router = APIRouter(prefix="/history", tags=["History"])


@router.get("/me", response_model=List[HistoryResponse])
async def get_my_histories(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """
    현재 로그인한 학생의 모든 이수 기록을 가져옵니다.
    """
    return history_service.get_student_histories(db, student_id)


@router.post("", response_model=HistoryResponse)
async def add_history(
    history_in: HistoryCreate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """
    이수 기록을 수동으로 추가합니다.
    """
    return history_service.add_student_history(db, student_id, history_in)


@router.patch("/{history_id}", response_model=HistoryResponse)
async def update_history(
    history_id: int,
    history_in: HistoryUpdate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """
    특정 이수 기록(재수강 여부 등)을 수정합니다.
    """
    return history_service.update_student_history(db, student_id, history_id, history_in)


@router.delete("/{history_id}")
async def delete_history(
    history_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """
    특정 이수 기록을 삭제합니다.
    """
    success = history_service.delete_student_history(db, student_id, history_id)
    if success:
        return {"message": "이수 기록이 삭제되었습니다."}
    raise HTTPException(status_code=400, detail="삭제에 실패했습니다.")
