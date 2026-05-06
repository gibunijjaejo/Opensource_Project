from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Course(Base):
    __tablename__ = "courses"
    course_id = Column(Integer, primary_key=True, autoincrement=True)
    course_code = Column(String(20), nullable=False)
    course_name = Column(String(255), nullable=False)
    credits = Column(Integer)
    target_grade = Column(String(20))
    is_english = Column(Boolean, default=False)
    class_days = Column(String(50))
    class_start_time = Column(String(10))
    class_end_time = Column(String(10))
    professor_id = Column(Integer, ForeignKey("professors.professor_id"))
    year = Column(Integer)
    semester = Column(Integer)
    course_category = Column(String(50))

    details = relationship("CourseDetail", back_populates="course", uselist=False)
    professor = relationship("Professor", back_populates="courses")

class CourseDetail(Base):
    __tablename__ = "course_details"
    course_id = Column(Integer, ForeignKey("courses.course_id"), primary_key=True)
    required_skills = Column(Text)
    evaluation_method = Column(Text)
    teaching_method = Column(Text)
    track_id = Column(Integer, ForeignKey("tracks.track_id"))
    keyword = Column(String(255))
    overview = Column(Text, nullable=True)
    pdf_hash = Column(String(64), nullable=True)
    recommendation = Column(Text, nullable=True)  # AI 추천 한 줄: "이 강의는 ~에 관심있는 학생에게 추천합니다."

    course = relationship("Course", back_populates="details")