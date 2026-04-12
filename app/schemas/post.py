from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    post_id: int
    content: str
    student_id: int
    author_name: Optional[str] = None
    created_at: datetime
    likes: int = 0

    model_config = {"from_attributes": True}


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class PostCreate(BaseModel):
    title: str
    content: str


class PostResponse(BaseModel):
    id: int
    category: str
    title: str
    content: str
    student_id: int
    author_name: Optional[str] = None
    is_anonymous: bool = False
    created_at: datetime
    comment_count: int = 0
    likes: int = 0
    file_path: Optional[str] = None
    file_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LikeResponse(BaseModel):
    liked: bool
    likes: int


class PostDetailResponse(PostResponse):
    comments: List[CommentResponse] = []
