from pydantic import BaseModel, field_validator
from typing import Optional


class UserCreate(BaseModel):
    student_id: int
    name: str
    email: str
    password: str
    current_semester: Optional[int] = None
    major_credits: Optional[int] = 0
    common_credits: Optional[int] = 0
    total_credits: Optional[int] = 0
    total_english: Optional[int] = 0

    @field_validator("email")
    @classmethod
    def check_sogang_email(cls, v: str) -> str:
        if not v.endswith("@sogang.ac.kr"):
            raise ValueError("서강대학교 이메일(@sogang.ac.kr)만 사용 가능합니다.")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    student_id: int
    name: str
    email: str
    current_semester: Optional[int] = None
    major_credits: int
    common_credits: int
    total_credits: int
    total_english: int

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    current_semester: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
