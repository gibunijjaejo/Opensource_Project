from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course, CourseDetail
from app.schemas.syllabus import SyllabusSummaryResponse
from app.services import syllabus_service

router = APIRouter(prefix="/api/v1/syllabus", tags=["Syllabus"])


def _build_response(detail: CourseDetail, course: Course, cached: bool) -> SyllabusSummaryResponse:
    return SyllabusSummaryResponse(
        course_id=detail.course_id,
        course_code=course.course_code if course else None,
        year=course.year if course else None,
        semester=course.semester if course else None,
        overview=detail.overview,
        goals=detail.required_skills,
        evaluation_method=detail.evaluation_method,
        cached=cached,
    )


@router.post("/summarize", response_model=SyllabusSummaryResponse, status_code=200)
async def summarize_syllabus(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다")

    file_bytes = await file.read()
    detail, course, cached = syllabus_service.process_syllabus(db, file_bytes)
    return _build_response(detail, course, cached)


@router.get("/{course_id}", response_model=SyllabusSummaryResponse)
def get_syllabus_summary(course_id: int, db: Session = Depends(get_db)):
    detail = db.query(CourseDetail).filter(CourseDetail.course_id == course_id).first()
    if not detail or not detail.overview:
        raise HTTPException(status_code=404, detail="저장된 요약이 없습니다")

    course = db.query(Course).filter(Course.course_id == course_id).first()
    return _build_response(detail, course, cached=True)
