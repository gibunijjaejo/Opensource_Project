# 서간표 (Seoganpyo) - CLAUDE.md

학생 시간표 담기 및 강의 추천 기능을 제공하는 웹 서비스 백엔드 프로젝트.

## 프로젝트 개요

- **서비스명**: 서간표
- **목적**: 학생이 수강 이력을 기반으로 시간표를 구성하고, 맞춤 강의를 추천받는 웹 서비스
- **팀원**: Minji, Hyungwoo, Yuhwan, Hayeon
- **백엔드 스택**: FastAPI + SQLAlchemy + PostgreSQL + Redis

## 디렉토리 구조

```
app/
├── main.py               # FastAPI 앱 진입점, 라우터 등록
├── database.py           # DB 연결 설정 (PostgreSQL + SQLAlchemy)
├── dependencies.py       # 공통 의존성 (get_current_student_id - JWT 검증)
├── api/                  # API 라우터
│   ├── auth.py           # 이메일 인증 / 회원가입 / 로그인
│   ├── upload.py         # 시간표 이미지 업로드 + OCR 처리
│   ├── courses.py        # 강의 목록 조회 / 검색
│   ├── cart.py           # 장바구니 CRUD
│   └── history.py        # 수강이력 CRUD (JWT 인증 필요)
├── models/               # SQLAlchemy ORM 모델
│   ├── user.py           # User (학생)
│   ├── course.py         # Course, CourseDetail
│   ├── professor.py      # Professor, ProfessorDetail
│   └── activity.py       # Track, History, Cart
├── schemas/              # Pydantic 스키마
│   ├── auth.py           # EmailRequest, VerifyRequest
│   ├── user.py           # UserCreate, UserLogin, UserResponse, Token
│   ├── course.py         # CourseResponse
│   ├── cart.py           # CartCreate, CartResponse, HistoryCreate, HistoryResponse
│   └── history.py        # HistoryCreate, HistoryResponse, HistoryUpdate
└── services/             # 비즈니스 로직
    ├── auth_service.py   # Redis OTP 생성/검증
    ├── email_service.py  # SMTP 이메일 발송
    ├── user_service.py   # 비밀번호 해싱, JWT 발급, 유저 CRUD
    ├── history_service.py# 수강이력 저장/조회/수정/삭제
    └── image_service.py  # PaddleOCR 기반 시간표 이미지 처리 + 과목 매칭
```

## 개발 규칙

### 브랜치 전략
- `main`: 배포용 브랜치
- `dev`: 통합 개발 브랜치 (기능 브랜치는 dev에 머지)
- `feat/<기능명>`: 기능 개발 브랜치
- PR은 항상 `dev` 브랜치로 보낼 것

### 커밋 컨벤션
- `feat:` - 새로운 기능 추가
- `fix:` - 버그 수정
- `refactor:` - 코드 리팩토링
- `docs:` - 문서 수정
- `chore:` - 빌드/설정 변경

### 코드 스타일
- Python: PEP8 준수
- 함수/변수명: snake_case
- 클래스명: PascalCase
- API 엔드포인트: `/api/v1/<리소스>` 형태 권장

## API 엔드포인트 목록

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/auth/send-email` | ✗ | 이메일 인증번호 발송 |
| POST | `/auth/verify-code` | ✗ | 인증번호 확인 |
| POST | `/auth/register` | ✗ | 회원가입 |
| POST | `/auth/login` | ✗ | 로그인 → JWT 발급 |
| POST | `/upload/course-image` | ✓ | 시간표 이미지 업로드 + OCR |
| GET | `/api/v1/courses` | ✗ | 강의 목록 조회 (검색/필터) |
| GET | `/api/v1/courses/{id}` | ✗ | 강의 상세 조회 |
| GET | `/api/v1/users/{id}/cart` | ✗ | 장바구니 조회 |
| POST | `/api/v1/users/{id}/cart` | ✗ | 장바구니 추가 |
| DELETE | `/api/v1/users/{id}/cart/{cart_id}` | ✗ | 장바구니 삭제 |
| GET | `/history/me` | ✓ | 내 수강이력 조회 |
| POST | `/history` | ✓ | 수강이력 수동 추가 |
| PATCH | `/history/{id}` | ✓ | 수강이력 수정 |
| DELETE | `/history/{id}` | ✓ | 수강이력 삭제 |

인증(✓): `Authorization: Bearer <token>` 헤더 필요

## DB 모델 요약

| 테이블 | 설명 |
|---|---|
| `users` | 학생 정보 (학번, 이름, 이메일, 학기, 이수학점 등) |
| `courses` | 강의 정보 (강의코드, 시간, 학점, 영어강의 여부 등) |
| `course_details` | 강의 상세 (필요역량, 평가방식, 트랙 등) |
| `professors` | 교수 정보 |
| `professor_details` | 교수 상세 (이메일, 연구실 등) |
| `tracks` | 트랙 정보 |
| `histories` | 학생 수강 이력 (연도, 학기, 재수강 여부 포함) |
| `carts` | 학생 시간표 장바구니 |

## 환경 변수 (.env)

```
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=
SECRET_KEY=        # JWT 서명 키
```

## 주요 기능 (구현 현황)

- [x] 회원가입 / 로그인 (JWT 인증)
- [x] 이메일 인증 (Redis OTP, 3분 TTL)
- [x] 시간표 이미지 업로드 (학번_학기.확장자로 저장, static/uploads/{학번}/ 폴더)
- [x] PaddleOCR 기반 시간표 OCR + 과목 매칭
- [x] 수강이력 자동 저장 (OCR 결과 기반)
- [x] 수강이력 CRUD (JWT 인증)
- [x] 장바구니 CRUD
- [x] 강의 목록 조회 / 검색 (강의명, 코드, 연도, 학기, 카테고리, 영어강의 필터)
- [x] DB 모델 구축 (강의, 교수, 수강이력, 장바구니)
- [ ] 강의 추천 로직

## 이미지 저장 경로

```
static/uploads/{student_id}/{student_id}_{semester}.{ext}
```
- 학기당 1개만 허용 (중복 업로드 시 400 반환)
- Docker 컨테이너 외부에서 접근 시 볼륨 마운트 필요

## 로컬 실행

```bash
# 의존성 설치
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload
```

## 주의사항

- `.env` 파일은 커밋하지 않는다.
- DB 테이블은 `Base.metadata.create_all()`로 자동 생성된다.
- `professors` 테이블 FK는 `"professors.professor_id"` — `course.py`, `professor.py` 양쪽 모두 복수형으로 통일.
- 새 모델 추가 시 `app/main.py`의 import에 반드시 포함해야 테이블이 생성된다.
- `passlib[bcrypt]`는 bcrypt 4.x 이상과 호환되지 않아 `bcrypt==4.0.1`로 고정.
- PaddleOCR/PaddlepadDle은 설치 시간이 길고 이미지 크기가 큼 — Docker 빌드 시 주의.
