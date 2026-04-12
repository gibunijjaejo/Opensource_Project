# API 명세서 (API Specification)

## 개요

- **Base URL:** `http://localhost:8000`
- **Content-Type:** `application/json`
- **인증 방식:** JWT Bearer Token (`Authorization: Bearer <token>`)
- **관리자 인증:** `X-Admin-Key` 헤더 (관리자 전용 엔드포인트)

---

## 인증 `/auth`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/auth/send-email` | - | 서강대 이메일로 인증번호 발송 (3분 유효) |
| POST | `/auth/verify-code` | - | 인증번호 검증 |
| POST | `/auth/register` | - | 회원가입 |
| POST | `/auth/login` | - | 로그인 → JWT 반환 |
| POST | `/auth/reset-password/send-email` | - | 비밀번호 재설정 인증번호 발송 |
| POST | `/auth/reset-password` | - | 비밀번호 재설정 |

**POST `/auth/register` Body**
```json
{
  "student_id": 20251234,
  "name": "홍길동",
  "email": "user@sogang.ac.kr",
  "password": "string",
  "current_semester": 3,
  "major_credits": 0,
  "common_credits": 0,
  "total_credits": 0,
  "total_english": 0
}
```

---

## 강의 `/api/v1/courses`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/api/v1/courses` | - | 강의 목록 조회 / 검색 |
| GET | `/api/v1/courses/{course_id}` | - | 강의 상세 조회 (교수 정보 포함) |
| GET | `/api/v1/courses/code/{course_code}` | - | 강의코드로 강의 조회 |

**GET `/api/v1/courses` Query Params**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `q` | string | 강의명 / 강의코드 / 교수명 검색 |
| `year` | int | 연도 필터 |
| `semester` | int | 학기 필터 (1 or 2) |
| `category` | string | 이수구분 필터 |
| `is_english` | bool | 영어강의 여부 필터 |

---

## 강의계획서 `/api/v1/syllabus`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/api/v1/syllabus/summarize` | - | PDF 업로드 → LLM 요약 (캐시 활용) |
| GET | `/api/v1/syllabus/{course_id}` | - | 저장된 강의계획서 요약 조회 |
| GET | `/api/v1/syllabus/{course_id}/pdf` | - | 강의계획서 PDF 원본 다운로드 |

---

## 커뮤니티 `/api/v1/community`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/api/v1/community/{category}` | - | 카테고리별 게시글 목록 |
| POST | `/api/v1/community/{category}` | JWT | 게시글 작성 (파일 첨부 가능) |
| GET | `/api/v1/community/{category}/{post_id}` | - | 게시글 상세 조회 (댓글 포함) |
| DELETE | `/api/v1/community/{category}/{post_id}` | JWT | 게시글 삭제 (본인만) |
| POST | `/api/v1/community/{category}/{post_id}/like` | JWT | 좋아요 토글 |
| POST | `/api/v1/community/{category}/{post_id}/comments` | JWT | 댓글 작성 |
| DELETE | `/api/v1/community/{category}/{post_id}/comments/{comment_id}` | JWT | 댓글 삭제 (본인만) |

**POST 게시글 Form-data**

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 제목 |
| `content` | string | 내용 |
| `is_anonymous` | bool | 익명 여부 (기본 false) |
| `file` | File | 첨부파일 (jpg/png/gif/pdf/zip/txt/docx/pptx, 선택) |

---

## 사용자 `/api/v1/users`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/api/v1/users/me` | JWT | 내 정보 조회 |

---

## 장바구니 `/api/v1/cart`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/api/v1/cart` | JWT | 내 장바구니 조회 |
| POST | `/api/v1/cart` | JWT | 장바구니에 강의 추가 |
| DELETE | `/api/v1/cart/{cart_id}` | JWT | 장바구니 항목 삭제 |
| GET | `/api/v1/users/{student_id}/cart` | - | 특정 학생 장바구니 조회 (관리용) |
| POST | `/api/v1/users/{student_id}/cart` | - | 특정 학생 장바구니 추가 (관리용) |
| DELETE | `/api/v1/users/{student_id}/cart/{cart_id}` | - | 특정 학생 장바구니 삭제 (관리용) |

**POST Body**
```json
{ "course_id": 1 }
```

---

## 수강이력 `/history`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/history/me` | JWT | 내 수강이력 전체 조회 |
| POST | `/history` | JWT | 수강이력 수동 추가 |
| PATCH | `/history/{history_id}` | JWT | 수강이력 수정 |
| DELETE | `/history/{history_id}` | JWT | 수강이력 삭제 |
| GET | `/api/v1/users/{student_id}/history` | - | 특정 학생 수강이력 조회 (관리용) |
| POST | `/api/v1/users/{student_id}/history` | - | 특정 학생 수강이력 추가 (관리용) |
| DELETE | `/api/v1/users/{student_id}/history/{history_id}` | - | 특정 학생 수강이력 삭제 (관리용) |

**POST `/history` Body**
```json
{
  "course_code": "CSE1001",
  "year": 2024,
  "semester": 1,
  "is_retake": false
}
```

---

## 업로드 `/upload`

| Method | Path | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/upload/course-image` | JWT | 시간표 이미지 업로드 → OCR 처리 (비동기, 202 반환) |

**Form-data**

| 필드 | 타입 | 설명 |
|------|------|------|
| `file` | File | 이미지 (jpg, jpeg, png) |
| `year` | int | 해당 연도 |
| `semester` | int | 해당 학기 (1 or 2) |

---

## 관리자 `/admin`

> `X-Admin-Key` 헤더 필요

| Method | Path | 설명 |
|--------|------|------|
| POST | `/admin/crawl/professors` | 교수 상세정보 크롤링 및 DB 갱신 |
| GET | `/admin/crawl/professors/test?url=` | 단일 교수 페이지 파싱 테스트 (DB 저장 없음) |
| POST | `/admin/professors/summarize-all` | 전체 교수 AI 요약 재생성 |
| POST | `/admin/professors/{professor_id}/summarize` | 특정 교수 AI 요약 재생성 |

**POST Body (summarize)**
```json
{ "prompt_override": null }
```

---

## 공통 에러 형식

```json
{ "detail": "에러 상세 내용" }
```
