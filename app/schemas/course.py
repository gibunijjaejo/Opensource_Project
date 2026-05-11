from pydantic import BaseModel
from typing import Optional


class CourseDetailResponse(BaseModel):
    required_skills: Optional[str] = None
    evaluation_method: Optional[str] = None
    teaching_method: Optional[str] = None
    track_id: Optional[int] = None
    keyword: Optional[str] = None
    overview: Optional[str] = None
    pdf_hash: Optional[str] = None
    recommendation: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfessorDetailResponse(BaseModel):
    email: Optional[str] = None
    specialty: Optional[str] = None
    research_area: Optional[str] = None
    research_summary: Optional[str] = None
    homepage: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfessorResponse(BaseModel):
    professor_id: int
    name: str
    lab: Optional[str] = None
    department: Optional[str] = None
    details: Optional[ProfessorDetailResponse] = None

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
