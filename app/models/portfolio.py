from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Date, DateTime, Index
from app.database import Base


PORTFOLIO_KINDS = ("campus_activity", "external_activity", "certificate", "award", "project")


class PortfolioEntry(Base):
    __tablename__ = "portfolio_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    entry_date = Column(Date, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_portfolio_student_kind", "student_id", "kind"),
    )


EVALUATION_STATUSES = ("pending", "running", "completed", "failed")


class PortfolioEvaluation(Base):
    __tablename__ = "portfolio_evaluations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    alignment_score = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    suggestions = Column(Text, nullable=True)
    by_section = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    model_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
