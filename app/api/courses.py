from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.course import Course, CourseDetail
from app.models.professor import Professor
from app.schemas.course import CourseResponse

router = APIRouter(prefix="/api/v1/courses", tags=["Courses"])


@router.get("", response_model=List[CourseResponse])
def get_courses(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="강의명, 강의코드, 또는 교수명 검색"),
    year: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    category: Optional[str] = Query(None, description="course_category 필터"),
    is_english: Optional[bool] = Query(None),
):
    query = db.query(Course).options(joinedload(Course.professor))
    if q:
        query = query.join(Professor, Course.professor_id == Professor.professor_id, isouter=True).filter(
            Course.course_name.ilike(f"%{q}%")
            | Course.course_code.ilike(f"%{q}%")
            | Professor.name.ilike(f"%{q}%")
        )
    if year:
        query = query.filter(Course.year == year)
    if semester:
        query = query.filter(Course.semester == semester)
    if category:
        query = query.filter(Course.course_category == category)
    if is_english is not None:
        query = query.filter(Course.is_english == is_english)
    return query.all()


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    return course
