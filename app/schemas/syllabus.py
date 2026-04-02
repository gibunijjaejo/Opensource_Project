from pydantic import BaseModel
from typing import Optional


class SyllabusSummaryResponse(BaseModel):
    course_id: int
    course_code: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    overview: Optional[str] = None
    goals: Optional[str] = None        # required_skills 필드에 매핑
    evaluation_method: Optional[str] = None
    cached: bool = False

    model_config = {"from_attributes": True}
