from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.services import auth_service
from app.services import user_service
from app.schemas.auth import EmailRequest, VerifyRequest
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.database import get_db

# 라우터 설정
router = APIRouter(prefix="/auth", tags=["User Authentication"])

@router.post("/send-email")
async def send_email(request: EmailRequest, background_tasks: BackgroundTasks):
    email = request.email
    
    # 서강대 이메일 형식 체크
    if not email.endswith("@sogang.ac.kr"):
        return JSONResponse(
            status_code=400,
            content={"message": "서강대학교 이메일(@sogang.ac.kr)만 사용 가능합니다."},
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    
    # 이메일 발송 로직 호출 (백그라운드 실행)
    auth_service.request_email_verification(email, background_tasks)
    
    return JSONResponse(
        content={"message": f"{email}로 인증번호가 발송되었습니다. (3분 유효)"},
        headers={"Content-Type": "application/json; charset=utf-8"}
    )

@router.post("/verify-code")
async def verify_code(request: VerifyRequest):
    # request 바구니에서 이메일과 코드를 꺼내서 검증합니다.
    result = auth_service.verify_auth_code(request.email, request.code)

    if not result["success"]:
        return JSONResponse(
            status_code=400,
            content={"message": result["message"]},
            headers={"Content-Type": "application/json; charset=utf-8"}
        )

    return JSONResponse(
        content={"message": result["message"]},
        headers={"Content-Type": "application/json; charset=utf-8"}
    )


@router.post("/register", response_model=UserResponse, status_code=201)
def register(req: UserCreate, db: Session = Depends(get_db)):
    if user_service.get_user_by_email(db, req.email):
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")
    if user_service.get_user_by_id(db, req.student_id):
        raise HTTPException(status_code=409, detail="이미 등록된 학번입니다.")
    user = user_service.create_user(
        db,
        student_id=req.student_id,
        name=req.name,
        email=req.email,
        password=req.password,
        current_semester=req.current_semester,
        major_credits=req.major_credits,
        common_credits=req.common_credits,
        total_credits=req.total_credits,
        total_english=req.total_english,
    )
    return user


@router.post("/login", response_model=Token)
def login(req: UserLogin, db: Session = Depends(get_db)):
    user = user_service.get_user_by_email(db, req.email)
    if not user or not user_service.verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    token = user_service.create_access_token(user.student_id)
    return {"access_token": token, "token_type": "bearer"}