from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Track(Base):
    __tablename__ = "tracks"
    track_id = Column(Integer, primary_key=True)
    track_name = Column(String(100), nullable=False)

class History(Base):
    __tablename__ = "histories"
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


class Timetable(Base):
    """학생이 비교용으로 후보 시간표를 4개(A/B/C/D)까지 저장하는 단위.

    cart 와 분리:
      - cart   = 단순 담아두기 (확정 전 후보 모음)
      - timetable = 확정 후보안 (A/B/C/D 슬롯 별로 독립 강의 셋)
    """
    __tablename__ = "timetables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"), nullable=False)
    slot = Column(String(1), nullable=False)        # 'A' | 'B' | 'C' | 'D'
    name = Column(String(50), nullable=True)         # 별명 (예: "주력안", "야간수업안"), 미입력 가능

    user = relationship("User")
    # cascade 로 timetable 삭제 시 자식 항목도 같이 정리.
    courses = relationship(
        "TimetableCourse",
        back_populates="timetable",
        cascade="all, delete-orphan",
    )

    # 한 학생이 같은 슬롯을 두 번 갖지 않도록 강제.
    __table_args__ = (UniqueConstraint("student_id", "slot", name="uq_timetable_student_slot"),)


class TimetableCourse(Base):
    """Timetable ↔ Course 다대다 연결.

    같은 슬롯에 같은 강의 중복 추가 방지를 위해 복합 PK 사용.
    """
    __tablename__ = "timetable_courses"
    timetable_id = Column(Integer, ForeignKey("timetables.id", ondelete="CASCADE"), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), primary_key=True)

    timetable = relationship("Timetable", back_populates="courses")
    course = relationship("Course")