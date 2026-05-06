from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Integer, ForeignKey("users.student_id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String(10), nullable=False)   # "post" | "comment"
    target_id = Column(Integer, nullable=False)
    reason = Column(String(100), nullable=False)        # "욕설" | "스팸" | "기타"
    status = Column(String(10), default="pending", nullable=False)  # "pending" | "resolved" | "dismissed"
    api_scores = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id])
