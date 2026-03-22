from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Professor(Base):
    __tablename__ = "professor"
    professor_id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    course_name = Column(String(50))
    lab = Column(String(50))

    details = relationship("ProfessorDetail", back_populates="professor", uselist=False)
    courses = relationship("Course", back_populates="professor")

class ProfessorDetail(Base):
    __tablename__ = "professor_details"
    professor_id = Column(Integer, ForeignKey("professor.professor_id"), primary_key=True)
    name = Column(String(50))
    email = Column(String(100))
    lab = Column(String(50))

    professor = relationship("Professor", back_populates="details")