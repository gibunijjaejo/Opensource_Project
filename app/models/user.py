from sqlalchemy import Column, Integer, String
from app.database import Base

class User(Base):
    __tablename__ = "users"

    # ERD에 맞춰 student_id를 기본키(PK)로 설정
    student_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    current_semester = Column(Integer, default=1)
    total_credits = Column(Integer, default=0)
    total_english = Column(Integer, default=0)