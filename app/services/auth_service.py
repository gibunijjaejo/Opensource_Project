import random
import redis
from app.services.email_service import send_verification_email

# 도커 컴포즈의 서비스 이름 'redis'로 연결
redis_client = redis.StrictRedis(host='redis', port=6379, db=0, decode_responses=True)

def request_email_verification(email: str, background_tasks):
    auth_code = f"{random.randint(0, 999999):06d}"
    redis_client.set(email, auth_code, ex=180) # 3분 만료
    background_tasks.add_task(send_verification_email, email, auth_code)

def verify_auth_code(email: str, code: str):
    saved_code = redis_client.get(email)
    if saved_code == code:
        redis_client.delete(email)
        return {"success": True, "message": "인증에 성공했습니다!"}
    return {"success": False, "message": "인증번호가 일치하지 않거나 만료되었습니다."}