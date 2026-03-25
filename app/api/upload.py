import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_student_id
from app.services.history_service import save_histories
from app.services.image_service import (
    DEFAULT_MATCH_THRESHOLD,
    process_timetable_image,
    save_ocr_result_json,
)

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/course-image")
async def upload_course_image(
    file: UploadFile = File(...),
    semester: int = Form(...),
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    allowed_extensions = {"jpg", "jpeg", "png"}

    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 올바르지 않습니다.")

    file_ext = file.filename.split(".")[-1].lower()

    if file_ext not in allowed_extensions:
        return JSONResponse(
            status_code=400,
            content={"message": "이미지 파일(jpg, jpeg, png)만 업로드 가능합니다."},
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

    if semester <= 0:
        raise HTTPException(status_code=400, detail="semester는 1 이상의 정수여야 합니다.")

    student_dir = os.path.join(UPLOAD_DIR, str(student_id))
    os.makedirs(student_dir, exist_ok=True)

    file_name = f"{student_id}_{semester}.{file_ext}"
    file_path = os.path.join(student_dir, file_name)

    # 학기당 1개의 시간표만 업로드 가능
    # 이미지 파일이 이미 있거나, OCR json이 이미 있으면 중복 업로드로 간주
    json_dir = os.path.join("data", "timetable_ocr", str(student_id))
    json_path = os.path.join(json_dir, f"{student_id}_{semester}.json")

    if os.path.exists(file_path) or os.path.exists(json_path):
        raise HTTPException(
            status_code=400,
            detail=f"{semester}학기 시간표는 이미 업로드되어 있습니다.",
        )

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류가 발생했습니다: {str(e)}")

    try:
        # 1) OCR + 과목 매칭
        ocr_result = process_timetable_image(
            image_path=file_path,
            db=db,
            threshold=DEFAULT_MATCH_THRESHOLD,
        )

        # 2) OCR 결과 JSON 저장
        saved_json_path = save_ocr_result_json(
            student_id=student_id,
            semester=semester,
            result=ocr_result,
        )

        # 3) 전공으로 판단된 과목만 histories 저장
        saved_histories = save_histories(
            db=db,
            student_id=student_id,
            matched_courses=ocr_result["matched_courses"],
        )

        return JSONResponse(
            content={
                "filename": file_name,
                "student_id": student_id,
                "semester": semester,
                "status": "success",
                "message": f"{semester}학기 시간표 업로드 및 OCR 처리 완료!",
                "image_path": file_path,
                "ocr_json_path": saved_json_path,
                "threshold": DEFAULT_MATCH_THRESHOLD,
                "matched_count": len(ocr_result["matched_courses"]),
                "saved_count": len(saved_histories),
                "matched_courses": ocr_result["matched_courses"],
                "saved_histories": saved_histories,
                "ignored_candidates": ocr_result["ignored_candidates"],
            },
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 처리 중 오류가 발생했습니다: {str(e)}")