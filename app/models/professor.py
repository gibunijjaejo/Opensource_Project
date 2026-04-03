from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Professor(Base):
    __tablename__ = "professors"
    professor_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    course_name = Column(String(255))
    lab = Column(String(100))

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