from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Track(Base):
    __tablename__ = "tracks"
    track_id = Column(Integer, primary_key=True)
    track_name = Column(String(100), nullable=False)

class History(Base):
    __tablename__ = "histories"
    # (학생, 과목코드, 연도, 학기) 조합은 유일 — 같은 학기 같은 과목 중복 불가
    __table_args__ = (
        UniqueConstraint(
            "student_id", "course_code", "year", "semester",
            name="uq_history_student_course_semester",
        ),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"))
    course_code = Column(String(20), nullable=False)
    year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    is_retake = Column(Boolean, default=False)

    user = relationship("User", back_populates="histories")
    # course 관계는 서비스 레이어에서 (code, year, semester) 조합으로 수동 조인하여 처리합니다.

class Cart(Base):
    __tablename__ = "carts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"))
    course_id = Column(Integer, ForeignKey("courses.course_id"))

    user = relationship("User", back_populates="carts")
    # CartResponse 가 course 를 포함하므로 ORM 관계 명시 — API 핸들러에서 joinedload 로 fetch.
    course = relationship("Course")