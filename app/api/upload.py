import logging
import os
import shutil
import uuid

from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile
from fastapi.responses import JSONResponse

from app.database import SessionLocal
from app.dependencies import get_current_student_id
from app.services.history_service import save_histories
from app.services.image_service import (
    build_course_candidates,
    extract_text_blocks,
    extract_year_semester_from_blocks,
    match_courses_to_db,
    merge_nearby_blocks,
)

router = APIRouter(prefix="/upload", tags=["Upload"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "static/uploads"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _process_and_save(file_path: str, student_id: int):
    """백그라운드: OCR 처리 후 수강이력 저장

    연도·학기는 이미지 상단 텍스트에서 자동 추출합니다.
    추출에 실패하면 해당 이미지는 저장을 건너뜁니다.
    """
    # 1단계: OCR + 텍스트 처리 (DB 세션 불필요, 시간이 오래 걸림)
    try:
        raw_blocks = extract_text_blocks(file_path)
        merged_blocks = merge_nearby_blocks(raw_blocks)
        candidates = build_course_candidates(raw_blocks, merged_blocks)
        year, semester = extract_year_semester_from_blocks(raw_blocks)
    except Exception as e:
        logger.error("OCR 처리 실패 [%s]: %s", file_path, e, exc_info=True)
        return

    if year is None or semester is None:
        logger.warning("연도/학기 미감지 [%s] year=%s semester=%s — 과목은 저장 시도", file_path, year, semester)

    # 2단계: DB 매칭 + 저장 (OCR 완료 후 세션 열기 → 유휴 커넥션 타임아웃 방지)
    db = SessionLocal()
    try:
        matched_courses, _ = match_courses_to_db(candidates, db)
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


@router.post(
    "/course-images",
    status_code=202,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["files"],
                        "properties": {
                            "files": {
                                "type": "array",
                                "items": {"type": "string", "format": "binary"},
                                "description": "시간표 이미지 파일 목록 (jpg, jpeg, png)",
                            }
                        },
                    }
                }
            },
        }
    },
)
async def upload_course_images(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    student_id: int = Depends(get_current_student_id),
):
    """
    시간표 이미지 여러 장을 한 번에 업로드합니다.
    연도·학기는 이미지 내 텍스트(예: '2026년 1학기')에서 자동으로 추출합니다.
    파일 저장 후 즉시 202를 반환하고, OCR 및 수강이력 저장은 백그라운드에서 처리됩니다.
    """
    results = []

    for file in files:
        if not file.filename:
            results.append({"status": "rejected", "reason": "파일명이 올바르지 않습니다."})
            continue

        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            results.append({
                "original_filename": file.filename,
                "status": "rejected",
                "reason": "이미지 파일(jpg, jpeg, png)만 업로드 가능합니다.",
            })
            continue

        student_dir = os.path.join(UPLOAD_DIR, str(student_id))
        os.makedirs(student_dir, exist_ok=True)

        # 업로드 시점에는 연도·학기를 알 수 없으므로 UUID로 고유 파일명 생성
        file_name = f"{student_id}_{uuid.uuid4().hex[:12]}.{file_ext}"
        file_path = os.path.join(student_dir, file_name)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            results.append({
                "original_filename": file.filename,
                "status": "rejected",
                "reason": f"파일 저장 중 오류가 발생했습니다: {str(e)}",
            })
            continue

        # 파일 저장 성공 → OCR + 수강이력 저장은 백그라운드에서 처리
        background_tasks.add_task(_process_and_save, file_path, student_id)

        results.append({
            "original_filename": file.filename,
            "saved_as": file_name,
            "status": "accepted",
            "message": "업로드 완료. 백그라운드에서 OCR 처리 후 수강이력에 반영됩니다.",
        })

    accepted = sum(1 for r in results if r["status"] == "accepted")
    rejected = sum(1 for r in results if r["status"] == "rejected")

    return JSONResponse(
        status_code=202,
        content={
            "student_id": student_id,
            "total": len(files),
            "accepted": accepted,
            "rejected": rejected,
            "results": results,
        },
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
