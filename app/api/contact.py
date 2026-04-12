from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_student_id
from app.models.user import User
from app.services.email_service import send_contact_email

router = APIRouter(prefix="/api/v1/contact", tags=["Contact"])


class ContactRequest(BaseModel):
    subject: str
    content: str


@router.post("")
def send_contact(
    req: ContactRequest,
    background_tasks: BackgroundTasks,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.student_id == student_id).first()
    sender_name = user.name if user else "알 수 없음"
    sender_email_addr = user.email if user else ""
    background_tasks.add_task(
        send_contact_email,
        req.subject,
        req.content,
        sender_name,
        sender_email_addr,
    )
    return {"message": "문의가 접수되었습니다"}
