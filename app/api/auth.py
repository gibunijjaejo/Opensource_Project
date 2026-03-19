from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.services import auth_service

# 1. 요청 데이터 규격 정의 (Pydantic 모델)
# 이 모델을 사용해야 Swagger에서 422 에러(입구 컷)가 안 납니다!
class EmailRequest(BaseModel):
    email: str

class VerifyRequest(BaseModel):
    email: str
    code: str

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