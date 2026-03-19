from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse 
import shutil
import os
from uuid import uuid4

app = FastAPI()

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def root():
    return {"message": "서간표 서버가 준비되었습니다!"}

@app.post("/upload/course-image")
async def upload_course_image(file: UploadFile = File(...)):
    allowed_extensions = ["jpg", "jpeg", "png"]
    file_ext = file.filename.split(".")[-1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="이미지 파일만 가능합니다.")

    file_name = f"{uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"filename": file_name, "status": "success"}