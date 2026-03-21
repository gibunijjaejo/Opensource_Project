# app/main.py
from fastapi import FastAPI
from app.api import upload, auth # 분리한 파일들 가져오기
from app.database import engine, Base
from app.models import user  # User 모델을 임포트해야 테이블이 생성됩니다.

# 서버 실행 시 DB 테이블 생성 (이미 있으면 건너뜀)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# 분리된 기능들을 app에 등록합니다.
# /upload/course-image 식으로 주소가 만들어집니다.
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(auth.router, prefix="/auth", tags=["Auth"])

@app.get("/")
async def root():
    return {"message": "서간표 통합 서버가 돌아가고 있습니다!"}