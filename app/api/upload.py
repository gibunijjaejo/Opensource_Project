from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import shutil
import os

# 우리가 만든 DB 관련 도구들 가져오기
from app.database import get_db
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/course-image") 
async def upload_course_image(
    file: UploadFile = File(...), 
    semester: int = Form(...),
    db: Session = Depends(get_db)
):
    # 1. 확장자 체크
    allowed_extensions = ["jpg", "jpeg", "png"]
    file_ext = file.filename.split(".")[-1].lower()
    
    if file_ext not in allowed_extensions:
        return JSONResponse(
            status_code=400,
            content={"message": "이미지 파일만 업로드 가능합니다."}
        )

    # 2. DB에서 유저 정보 조회 
    # 임시로 20221234 학번 사용
    # 나중에 하연이가 로그인 기능을 완성하면 세션에서 유저 정보를 가져오게 바꿀 예정
    current_user_id = 20221234 
    user = db.query(User).filter(User.student_id == current_user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 2. 학번 폴더 경로 설정 (예: static/uploads/20221234)
    user_folder = os.path.join(UPLOAD_DIR, str(user.student_id))

    # 3. 폴더가 없으면 새로 생성, 있으면 그대로 통과
    os.makedirs(user_folder, exist_ok=True)

    # 3. 파일명 생성: 학번_학기.확장자 (예: 20221234_3.png)
    file_ext = file.filename.split(".")[-1].lower()
    file_name = f"{user.student_id}_{semester}.{file_ext}"
    file_path = os.path.join(user_folder, file_name)

    # 4. 파일 저장
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    # 5. 결과 반환
    return JSONResponse(
        content={
            "saved_folder": user_folder,
            "filename": file_name,
            "status": "success",
            "message": f"{user.student_id} 폴더에 {file_name} 저장 완료!"
        },
        headers={"Content-Type": "application/json; charset=utf-8"}
    )