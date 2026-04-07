from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_student_id
from app.services import user_service
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/api/v1/users", tags=["Users"])

# 프론트엔드와 user 통신
@router.get("/me", response_model=UserResponse)
def get_me(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_by_id(db, student_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(
    req: UserUpdate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_by_id(db, student_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if req.current_semester is not None:
        user.current_semester = req.current_semester
    db.commit()
    db.refresh(user)
    return user
