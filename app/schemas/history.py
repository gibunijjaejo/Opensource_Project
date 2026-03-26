from pydantic import BaseModel
from typing import Optional
from app.schemas.course import CourseResponse

class HistoryBase(BaseModel):
    course_code: str
    year: Optional[int] = None
    semester: Optional[int] = None
    is_retake: bool = False

class HistoryCreate(HistoryBase):
    pass

class HistoryUpdate(BaseModel):
    course_code: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    is_retake: Optional[bool] = None

class HistoryResponse(BaseModel):
    id: int
    student_id: int
    course_code: str
    year: Optional[int] = None
    semester: Optional[int] = None
    is_retake: bool
    course: Optional[CourseResponse] = None

    model_config = {"from_attributes": True}
