from fastapi import FastAPI
from fastapi.responses import JSONResponse
from app.api import auth, upload  # 분리한 라우터들 가져오기
from app.database import engine, Base
from app.models import user, course, professor, activity 

# 서버 실행 시 DB 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(title="서간표 통합 서버")

# 라우터 등록 (prefix는 각 파일 내부 router 설정에 따름)
app.include_router(auth.router)
app.include_router(upload.router)

@app.get("/")
async def root():
    return JSONResponse(
        content={"message": "서간표 통합 서버가 준비되었습니다"},
        headers={"Content-Type": "application/json; charset=utf-8"}
    )