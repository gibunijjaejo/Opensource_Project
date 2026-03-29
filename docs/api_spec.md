# API 명세서 (API Specification)

## 1. 개요
- **Base URL:** `http://localhost:8000`
- **Content-Type:** `application/json`
- **인증 방식:** JWT (Bearer Token)

## 2. API 상세 목록

### [인증 - /auth]
- `POST /auth/send-email`: 서강대 이메일로 인증번호 발송
- `POST /auth/verify-code`: 인증번호 검증
- `POST /auth/register`: 회원가입 (학번, 이름, 이메일, 비밀번호 등)
- `POST /auth/login`: 로그인 (Access Token 반환)

### [강의 - /api/v1/courses]
- `GET /api/v1/courses`: 강의 목록 조회 및 검색
  - Query Params: `q` (검색어), `year`, `semester`, `category`, `is_english`
- `GET /api/v1/courses/{course_id}`: 특정 강의 상세 정보 조회

### [사용자 - /api/v1/users]
- `GET /api/v1/users/me`: 현재 로그인한 사용자 정보 조회 (JWT 필요)

### [장바구니 - /api/v1]
- `GET /api/v1/cart`: 내 장바구니 목록 조회 (JWT 필요)
- `POST /api/v1/cart`: 장바구니에 강의 추가 (JWT 필요)
- `DELETE /api/v1/cart/{cart_id}`: 장바구니에서 강의 삭제 (JWT 필요)
- `GET /api/v1/users/{student_id}/cart`: 특정 학생의 장바구니 조회 (관리용)
- `POST /api/v1/users/{student_id}/cart`: 특정 학생의 장바구니에 추가 (관리용)
- `DELETE /api/v1/users/{student_id}/cart/{cart_id}`: 특정 학생의 장바구니 삭제 (관리용)

### [수강 이력 - /history & /api/v1]
- `GET /history/me`: 내 모든 수강 이력 조회 (JWT 필요)
- `POST /history`: 수강 이력 수동 추가 (JWT 필요)
- `PATCH /history/{history_id}`: 수강 이력 수정 (JWT 필요)
- `DELETE /history/{history_id}`: 수강 이력 삭제 (JWT 필요)
- `GET /api/v1/users/{student_id}/history`: 특정 학생의 수강 이력 조회 (관리용)
- `POST /api/v1/users/{student_id}/history`: 특정 학생의 수강 이력 추가 (관리용)
- `DELETE /api/v1/users/{student_id}/history/{history_id}`: 특정 학생의 수강 이력 삭제 (관리용)

### [업로드 - /upload]
- `POST /upload/course-image`: 시간표 이미지 업로드 및 OCR 처리 (JWT 필요)
  - Form-data: `file` (이미지), `semester`, `year`

## 3. 공통 응답 구조
### 성공 (Success)
```json
{
  "success": true,
  "data": {},
  "message": "성공 메시지"
}
```
*(참고: FastAPI 기본 설정에 따라 일부 엔드포인트는 데이터 객체를 직접 반환할 수 있습니다.)*

### 에러 (Error)
```json
{
  "detail": "에러 상세 내용"
}
```
*(FastAPI HTTPException 기본 형식)*
