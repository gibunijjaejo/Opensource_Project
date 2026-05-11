from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Professor(Base):
    __tablename__ = "professors"
    professor_id = Column(Integer, primary_key=True)
    # 다중 교수 ("A, B, C") 를 한 row 로 넣는 import 규칙 때문에 255 까지 확장.
    name = Column(String(255), nullable=False)
    course_name = Column(String(255))
    lab = Column(String(100))
    # "컴퓨터공학과" 또는 "교양" 2값만 사용. 교양은 프로필/크롤링/AI 요약 대상 아님.
    department = Column(String(50), nullable=False, default="컴퓨터공학과")

    details = relationship("ProfessorDetail", back_populates="professor", uselist=False)
    courses = relationship("Course", back_populates="professor")

class ProfessorDetail(Base):
    __tablename__ = "professor_details"
    professor_id = Column(Integer, ForeignKey("professors.professor_id"), primary_key=True)
    name = Column(String(100))
    email = Column(String(100))
    specialty = Column(String(255))
    research_area = Column(Text)
    research_summary = Column(Text)
    homepage = Column(String(255))

    professor = relationship("Professor", back_populates="details")