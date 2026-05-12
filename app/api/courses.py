from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.course import Course
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
    division: Optional[str] = Query(
        None,
        regex="^(major|liberal)$",
        description="major=CSE 전공, liberal=교양 (course_code prefix 기준)",
    ),
    is_english: Optional[bool] = Query(None),
    limit: Optional[int] = Query(None),
    offset: int = Query(0),
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
    if division == "major":
        query = query.filter(Course.course_code.like("CSE%"))
    elif division == "liberal":
        query = query.filter(~Course.course_code.like("CSE%"))
    if is_english is not None:
        query = query.filter(Course.is_english == is_english)
    query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()


@router.get("/code/{course_code}", response_model=CourseResponse)
def get_course_by_code(course_code: str, db: Session = Depends(get_db)):
    course = (
        db.query(Course)
        .options(
            joinedload(Course.professor).joinedload(Professor.details),
            joinedload(Course.details),
        )
        .filter(Course.course_code == course_code)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    return course


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = (
        db.query(Course)
        .options(
            joinedload(Course.professor).joinedload(Professor.details),
            joinedload(Course.details),
        )
        .filter(Course.course_id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    return course
