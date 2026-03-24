# 서간표 (Seoganpyo) - CLAUDE.md

학생 시간표 담기 및 강의 추천 기능을 제공하는 웹 서비스 백엔드 프로젝트.

## 프로젝트 개요

- **서비스명**: 서간표
- **목적**: 학생이 수강 이력을 기반으로 시간표를 구성하고, 맞춤 강의를 추천받는 웹 서비스
- **팀원**: Minji, Hyungwoo, Yuhwan, Hayeon
- **백엔드 스택**: FastAPI + SQLAlchemy + PostgreSQL

## 디렉토리 구조

```
app/
├── main.py           # FastAPI 앱 진입점, 라우터 등록
├── database.py       # DB 연결 설정 (PostgreSQL + SQLAlchemy)
├── api/              # API 라우터
│   ├── auth.py       # 회원가입/로그인
│   └── upload.py     # 이미지 업로드
├── models/           # SQLAlchemy ORM 모델
│   ├── user.py       # User (학생)
│   ├── course.py     # Course, CourseDetail
│   ├── professor.py  # Professor, ProfessorDetail
│   └── activity.py   # Track, History, Cart
├── schemas/          # Pydantic 스키마
│   └── auth.py
└── services/         # 비즈니스 로직
    ├── auth_service.py
    ├── email_service.py
    └── image_service.py
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

## DB 모델 요약

| 테이블 | 설명 |
|---|---|
| `users` | 학생 정보 (학번, 이름, 이메일, 학기, 이수학점 등) |
| `courses` | 강의 정보 (강의코드, 시간, 학점, 영어강의 여부 등) |
| `course_details` | 강의 상세 (필요역량, 평가방식, 트랙 등) |
| `professors` | 교수 정보 |
| `professor_details` | 교수 상세 (이메일, 연구실 등) |
| `tracks` | 트랙 정보 |
| `histories` | 학생 수강 이력 (재수강 여부 포함) |
| `carts` | 학생 시간표 장바구니 |

## 환경 변수 (.env)

```
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=
```

## 주요 기능 (구현 현황)

- [x] 회원가입 / 로그인 (JWT 인증)
- [x] 이메일 인증
- [x] 이미지 업로드
- [x] DB 모델 구축 (강의, 교수, 수강이력, 장바구니)
- [ ] 시간표 담기 (Cart CRUD)
- [ ] 강의 추천 로직
- [ ] 강의 목록 조회 / 검색

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
