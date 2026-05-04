from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_student_id
from app.models.admin_message import AdminMessage
from app.services import user_service
from app.schemas.admin import AdminMessageItem
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
    if req.interests is not None:
        user.interests = ",".join(req.interests)
    if req.target_careers is not None:
        user.target_careers = ",".join(req.target_careers)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/me", status_code=204)
def delete_me(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_by_id(db, student_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    user_service.delete_user(db, student_id)
    return Response(status_code=204)


@router.get("/me/messages/unread", response_model=list[AdminMessageItem])
def get_unread_messages(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    msgs = (
        db.query(AdminMessage)
        .filter(AdminMessage.recipient_id == student_id, AdminMessage.is_read == False)
        .order_by(AdminMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "content": m.content,
            "sender_name": m.sender.name if m.sender else None,
            "created_at": m.created_at,
        }
        for m in msgs
    ]


@router.patch("/me/messages/{message_id}/read", status_code=204)
def mark_message_read(
    message_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    msg = db.query(AdminMessage).filter(
        AdminMessage.id == message_id,
        AdminMessage.recipient_id == student_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")
    if not msg.is_read:
        msg.is_read = True
        msg.read_at = datetime.utcnow()
        db.commit()
    return Response(status_code=204)
