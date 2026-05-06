from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    sender_name = Column(String(100), nullable=True)
    sender_email = Column(String(200), nullable=True)
    status = Column(String(10), default="pending", nullable=False)  # pending | resolved | dismissed
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[student_id])
