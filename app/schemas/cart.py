from pydantic import BaseModel
from typing import Optional
from app.schemas.course import CourseResponse


class CartCreate(BaseModel):
    course_id: int


class CartResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    course: Optional[CourseResponse] = None

    model_config = {"from_attributes": True}


class HistoryCreate(BaseModel):
    course_code: str
    is_retake: bool = False


class HistoryResponse(BaseModel):
    id: int
    student_id: int
    course_code: str
    is_retake: bool
    course: Optional[CourseResponse] = None

    model_config = {"from_attributes": True}
