from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
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
    course_code = Column(String(20), ForeignKey("courses.course_code"))
    is_retake = Column(Boolean, default=False)

    user = relationship("User", back_populates="histories")
    course = relationship("Course", back_populates="histories")

class Cart(Base):
    __tablename__ = "carts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.student_id"))
    course_id = Column(Integer, ForeignKey("courses.course_id"))

    user = relationship("User", back_populates="carts")