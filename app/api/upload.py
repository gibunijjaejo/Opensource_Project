# 시간표 업로드 API

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
import shutil
import os
from uuid import uuid4

router = APIRouter()

# 저장 경로는 최상위 폴더 기준
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/course-image") 
async def upload_course_image(
    file: UploadFile = File(...), 
    semester: int = Form(...)
):
    # 1. 확장자 체크
    allowed_extensions = ["jpg", "jpeg", "png"]
    file_ext = file.filename.split(".")[-1].lower()
    
    if file_ext not in allowed_extensions:
        return JSONResponse(
            status_code=400,
            content={"message": "이미지 파일(jpg, jpeg, png)만 업로드 가능합니다."},
            headers={"Content-Type": "application/json; charset=utf-8"}
        )

    # 2. 파일명 생성
    file_name = f"{uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    # 3. 파일 실제 저장
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    # 4. 결과 반환
    return JSONResponse(
        content={
            "filename": file_name,
            "semester": semester,
            "status": "success",
            "message": f"{semester}학기 시간표 업로드 완료!"
        },
        headers={"Content-Type": "application/json; charset=utf-8"}
    )