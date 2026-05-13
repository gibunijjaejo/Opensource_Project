from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from app.schemas.course import CourseResponse


SlotLiteral = Literal["A", "B", "C", "D"]


class TimetableCourseItem(BaseModel):
    """슬롯 한 칸에 담긴 강의 한 개 (응답용)."""
    course_id: int
    course: Optional[CourseResponse] = None

    model_config = {"from_attributes": True}


class TimetableResponse(BaseModel):
    """학생의 한 슬롯(A/B/C/D)에 담긴 강의 목록 + 메타데이터."""
    id: int
    slot: SlotLiteral
    name: Optional[str] = None
    courses: List[TimetableCourseItem] = []

    model_config = {"from_attributes": True}


class TimetableCourseCreate(BaseModel):
    """슬롯에 강의 한 개 추가."""
    course_id: int


class TimetableUpdate(BaseModel):
    """슬롯 메타데이터 수정 (별명 변경 등)."""
    name: Optional[str] = Field(None, max_length=50)
