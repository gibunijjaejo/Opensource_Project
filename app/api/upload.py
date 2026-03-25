# app/api/upload.py

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from fastapi.responses import JSONResponse
from app.dependencies import get_current_student_id
import shutil
import os

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/course-image")
async def upload_course_image(
    file: UploadFile = File(...),
    semester: int = Form(...),
    student_id: int = Depends(get_current_student_id)
):
    allowed_extensions = ["jpg", "jpeg", "png"]
    file_ext = file.filename.split(".")[-1].lower()

    if file_ext not in allowed_extensions:
        return JSONResponse(
            status_code=400,
            content={"message": "이미지 파일(jpg, jpeg, png)만 업로드 가능합니다."},
            headers={"Content-Type": "application/json; charset=utf-8"}
        )

    student_dir = os.path.join(UPLOAD_DIR, str(student_id))
    os.makedirs(student_dir, exist_ok=True)

    file_name = f"{student_id}_{semester}.{file_ext}"
    file_path = os.path.join(student_dir, file_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    return JSONResponse(
        content={
            "filename": file_name,
            "student_id": student_id,
            "semester": semester,
            "status": "success",
            "message": f"{semester}학기 시간표 업로드 완료!"
        },
        headers={"Content-Type": "application/json; charset=utf-8"}
    )