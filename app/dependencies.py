from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError
from app.services import user_service

bearer_scheme = HTTPBearer()

def get_current_student_id(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> int:
    try:
        return user_service.decode_token(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
