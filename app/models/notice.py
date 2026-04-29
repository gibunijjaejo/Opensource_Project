from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime
from app.database import Base


class Notice(Base):
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(10), nullable=False)           # "notice" | "banner"
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
