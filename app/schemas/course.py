from pydantic import BaseModel
from typing import Optional


class CourseDetailResponse(BaseModel):
    required_skills: Optional[str] = None
    evaluation_method: Optional[str] = None
    teaching_method: Optional[str] = None
    track_id: Optional[int] = None
    keyword: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfessorResponse(BaseModel):
    professor_id: int
    name: str
    lab: Optional[str] = None

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    credits: Optional[int] = None
    target_grade: Optional[str] = None
    is_english: bool
    class_days: Optional[str] = None
    class_start_time: Optional[str] = None
    class_end_time: Optional[str] = None
    professor_id: Optional[int] = None
    professor: Optional[ProfessorResponse] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    course_category: Optional[str] = None
    details: Optional[CourseDetailResponse] = None

    model_config = {"from_attributes": True}


class TrackResponse(BaseModel):
    track_id: int
    track_name: str

    model_config = {"from_attributes": True}
