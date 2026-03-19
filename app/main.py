from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
import shutil
import os
from uuid import uuid4

app = FastAPI()

# 업로드 폴더 설정 (없으면 생성)
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
async def root():
    # 한글 깨짐 방지를 위해 JSONResponse와 charset 설정 사용
    return JSONResponse(
        content={"message": "서간표 서버가 준비되었습니다, 민지님!"},
        headers={"Content-Type": "application/json; charset=utf-8"}
    )

@app.post("/upload/course-image")
async def upload_course_image(
    file: UploadFile = File(...), 
    semester: int = Form(...)  # 학기를 1, 2, 3... 숫자로 받음
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

    # 2. 파일명 생성 (중복 방지를 위해 UUID 사용)
    file_name = f"{uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    # 3. 파일 실제 저장
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    # 4. 결과 반환 (프론트엔드 친구들이 쓸 데이터 포함)
    return JSONResponse(
        content={
            "filename": file_name,
            "semester": semester,
            "status": "success",
            "message": f"{semester}학기 시간표 업로드 완료!"
        },
        headers={"Content-Type": "application/json; charset=utf-8"}
    )