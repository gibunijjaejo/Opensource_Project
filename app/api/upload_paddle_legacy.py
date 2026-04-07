import logging
import os
import shutil
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.database import SessionLocal
from app.dependencies import get_current_student_id
from app.services.history_service import save_histories
from app.services.image_service import (
    build_course_candidates,
    extract_text_blocks,
    match_courses_to_db,
    merge_nearby_blocks,
)

router = APIRouter(prefix="/upload", tags=["Upload"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "static/uploads"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _process_and_save(file_path: str, student_id: int, year: int, semester: int):
    """백그라운드: OCR 처리 후 수강이력 저장. 연도·학기는 사용자 입력값을 사용."""
    # 1단계: OCR + 텍스트 처리 (DB 세션 불필요, 시간이 오래 걸림)
    try:
        raw_blocks = extract_text_blocks(file_path)
        merged_blocks = merge_nearby_blocks(raw_blocks)
        candidates = build_course_candidates(raw_blocks, merged_blocks)
    except Exception as e:
        logger.error("OCR 처리 실패 [%s]: %s", file_path, e, exc_info=True)
        return

    # 2단계: DB 매칭 + 저장 (OCR 완료 후 세션 열기 → 유휴 커넥션 타임아웃 방지)
    db = SessionLocal()
    try:
        matched_courses, _ = match_courses_to_db(candidates, db, year=year, semester=semester)
        if matched_courses:
            save_histories(
                db=db,
                student_id=student_id,
                matched_courses=matched_courses,
                year=year,
                semester=semester,
            )
    except Exception as e:
        db.rollback()
        logger.error("DB 저장 실패 [%s]: %s", file_path, e, exc_info=True)
    finally:
        db.close()


@router.post("/course-image", status_code=202)
async def upload_course_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    year: int = Form(...),
    semester: int = Form(...),
    student_id: int = Depends(get_current_student_id),
):
    """
    시간표 이미지 1장을 업로드합니다.
    연도·학기는 폼 파라미터로 직접 전달합니다.
    파일 저장 후 즉시 202를 반환하고, OCR 및 수강이력 저장은 백그라운드에서 처리됩니다.
    """
    if not file.filename:
        return JSONResponse(status_code=400, content={"error": "파일명이 올바르지 않습니다."})

    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"error": "이미지 파일(jpg, jpeg, png)만 업로드 가능합니다."},
        )

    if semester not in (1, 2):
        return JSONResponse(status_code=400, content={"error": "학기는 1 또는 2여야 합니다."})

    student_dir = os.path.join(UPLOAD_DIR, str(student_id))
    os.makedirs(student_dir, exist_ok=True)

    file_name = f"{student_id}_{uuid.uuid4().hex[:12]}.{file_ext}"
    file_path = os.path.join(student_dir, file_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"파일 저장 중 오류가 발생했습니다: {str(e)}"},
        )

    background_tasks.add_task(_process_and_save, file_path, student_id, year, semester)

    return JSONResponse(
        status_code=202,
        content={
            "student_id": student_id,
            "year": year,
            "semester": semester,
            "saved_as": file_name,
            "message": "업로드 완료. 백그라운드에서 OCR 처리 후 수강이력에 반영됩니다.",
        },
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
