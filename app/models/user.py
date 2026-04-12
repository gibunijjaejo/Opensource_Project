from sqlalchemy import Column, Integer, String, SmallInteger, Text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    student_id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    current_semester = Column(SmallInteger)
    interests = Column(Text, default="")        # 쉼표 구분 문자열
    target_careers = Column(Text, default="")   # 쉼표 구분 문자열
    major_credits = Column(Integer, default=0)
    common_credits = Column(Integer, default=0)
    total_credits = Column(Integer, default=0)
    total_english = Column(SmallInteger, default=0)

    # 관계 설정 (문자열로 참조하여 에러 방지)
    histories = relationship("History", back_populates="user")
    carts = relationship("Cart", back_populates="user")
    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")
