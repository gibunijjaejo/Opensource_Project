import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api import auth, upload, courses, cart, history, users, admin, syllabus, posts, contact, professors
from app.database import engine, Base
from app.models import user, course, professor, activity, post, report, notice  # noqa: F401 — Base 테이블 등록용

# 서버 실행 시 DB 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(title="서간표 통합 서버")

os.makedirs("static/uploads/posts", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(courses.router)
app.include_router(cart.router)
app.include_router(history.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(syllabus.router)
app.include_router(posts.router)
app.include_router(contact.router)
app.include_router(professors.router)

@app.get("/")
async def root():
    return JSONResponse(
        content={"message": "서간표 통합 서버가 준비되었습니다"},
        headers={"Content-Type": "application/json; charset=utf-8"}
    )
