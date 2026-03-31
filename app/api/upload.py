import os
import shutil
import uuid

from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile
from fastapi.responses import JSONResponse

from app.database import SessionLocal
from app.dependencies import get_current_student_id
from app.services.history_service import save_histories
from app.services.image_service import DEFAULT_MATCH_THRESHOLD, process_timetable_image

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = "static/uploads"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _process_and_save(file_path: str, student_id: int):
    """백그라운드: OCR 처리 후 수강이력 저장

    연도·학기는 이미지 상단 텍스트에서 자동 추출합니다.
    추출에 실패하면 해당 이미지는 저장을 건너뜁니다.
    """
    db = SessionLocal()
    try:
        ocr_result = process_timetable_image(
            image_path=file_path,
            db=db,
            threshold=DEFAULT_MATCH_THRESHOLD,
        )

        year = ocr_result["detected_year"]
        semester = ocr_result["detected_semester"]

        # 연도·학기를 읽지 못하면 수강이력 저장 불가
        if year is None or semester is None:
            return

        save_histories(
            db=db,
            student_id=student_id,
            matched_courses=ocr_result["matched_courses"],
            year=year,
            semester=semester,
        )
    except Exception:
        pass  # 개별 실패는 조용히 처리 (필요 시 로깅 추가)
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
