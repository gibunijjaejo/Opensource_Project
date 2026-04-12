# 서간표 (Seoganpyo) - CLAUDE.md

학생 시간표 담기 및 강의 추천 기능을 제공하는 웹 서비스 풀스택 프로젝트.

## 프로젝트 개요

- **서비스명**: 서간표
- **목적**: 학생이 수강 이력을 기반으로 시간표를 구성하고, 맞춤 강의를 추천받는 웹 서비스
- **팀원**: Minji, Hyungwoo, Yuhwan, Hayeon
- **백엔드 스택**: FastAPI + SQLAlchemy + PostgreSQL + Redis
- **프론트엔드 스택**: Next.js + React + TypeScript

## 디렉토리 구조

```
Opensource_Project/
├── app/                          # FastAPI 백엔드
│   ├── main.py                   # FastAPI 앱 진입점, 라우터 등록
│   ├── database.py               # DB 연결 설정 (PostgreSQL + SQLAlchemy)
│   ├── dependencies.py           # 공통 의존성 (get_current_student_id - JWT 검증)
│   ├── api/                      # API 라우터
│   │   ├── auth.py               # 이메일 인증 / 회원가입 / 로그인
│   │   ├── courses.py            # 강의 목록 조회 / 검색
│   │   ├── cart.py               # 장바구니 CRUD
│   │   ├── history.py            # 수강이력 CRUD (JWT 인증 필요)
│   │   ├── users.py              # 유저 정보 조회
│   │   ├── upload.py             # 시간표 이미지 업로드 + OCR 처리
│   │   ├── syllabus.py           # 강의계획서 요약
│   │   ├── posts.py              # 커뮤니티 게시판
│   │   └── admin.py              # 관리자 전용 (크롤링, AI 요약 재생성)
│   ├── models/                   # SQLAlchemy ORM 모델
│   │   ├── user.py               # User (학생)
│   │   ├── course.py             # Course, CourseDetail
│   │   ├── professor.py          # Professor, ProfessorDetail
│   │   ├── activity.py           # Track, History, Cart
│   │   └── post.py               # Post, Comment, PostLike
│   ├── schemas/                  # Pydantic 스키마
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── course.py
│   │   ├── cart.py
│   │   ├── history.py
│   │   ├── syllabus.py
│   │   └── post.py
│   └── services/                 # 비즈니스 로직
│       ├── auth_service.py       # Redis OTP 생성/검증
│       ├── email_service.py      # SMTP 이메일 발송
│       ├── user_service.py       # 비밀번호 해싱, JWT 발급, 유저 CRUD
│       ├── history_service.py    # 수강이력 저장/조회/수정/삭제
│       ├── image_service.py      # PaddleOCR 기반 시간표 이미지 처리 + 과목 매칭
│       ├── crawl_service.py      # 교수 상세정보 크롤링 + Ollama AI 요약
│       └── syllabus_service.py   # 강의계획서 OCR + LLM 요약
├── frontend/                     # Next.js 프론트엔드
│   └── src/
│       ├── app/                  # Next.js App Router (페이지 라우팅)
│       │   ├── layout.tsx        # 루트 레이아웃 (ThemeProvider 포함)
│       │   ├── page.tsx          # 홈 페이지
│       │   ├── globals.css       # 전역 스타일 (다크모드 포함)
│       │   ├── login/            # 로그인 페이지
│       │   ├── signup/           # 회원가입 페이지
│       │   ├── course/[id]/      # 강의 상세 페이지
│       │   ├── timetable/        # 시간표 페이지
│       │   ├── profile/          # 프로필 페이지
│       │   ├── graduation/       # 졸업요건 페이지
│       │   └── community/        # 커뮤니티 게시판
│       ├── components/           # 재사용 컴포넌트
│       │   ├── ui/               # shadcn/ui 공통 컴포넌트
│       │   ├── features/         # 기능 컴포넌트
│       │   └── layout/           # 레이아웃 (theme-provider, theme-toggle)
│       ├── hooks/                # 커스텀 훅
│       ├── lib/                  # 유틸리티
│       │   ├── api.ts            # 백엔드 API 호출 함수 모음
│       │   ├── utils.ts
│       │   └── constants/
│       └── types/
│           └── index.ts          # 공통 타입 (Course, User, Cart 등)
├── ocr-service/                  # PaddleOCR 마이크로서비스
├── scripts/                      # 배포 스크립트
│   ├── pre-deploy.sh             # 배포 전 점검
│   └── post-deploy.sh            # 배포 후 헬스체크
├── tests/                        # 백엔드 테스트
├── docs/                         # 프로젝트 문서
├── Dockerfile                    # 백엔드 (prod)
├── docker-compose.yml            # 전체 서비스 (prod)
├── docker-compose.dev.yml        # 로컬 개발용 override
└── requirements.txt
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

- Python: PEP8 준수, 함수/변수명 snake_case, 클래스명 PascalCase
- TypeScript: 컴포넌트명 PascalCase, 훅/유틸 camelCase
- API 엔드포인트: `/api/v1/<리소스>` 형태 권장
- 프론트엔드 API 호출은 `src/lib/api.ts`에 집중 관리

## 환경 변수

`.env.example`을 복사해서 `.env`로 사용:

```bash
cp .env.example .env
```

## 실행 방법

```bash
make dev     # 로컬 개발 (--reload + HMR + 로컬 PostgreSQL)
make down    # 컨테이너 종료
make prod    # VDI 배포 (pre-check → build → post-check)
make logs    # 전체 로그 스트리밍
make ps      # 컨테이너 상태 확인
```

### 직접 실행 (Docker 없이)

```bash
# 백엔드
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000

# 프론트엔드
cd frontend && pnpm install && pnpm dev   # http://localhost:3000
```

## 주의사항

- `.env` 파일은 커밋하지 않는다.
- DB 테이블은 `Base.metadata.create_all()`로 자동 생성된다.
- 새 모델 추가 시 `app/main.py`의 import에 반드시 포함해야 테이블이 생성된다.
- `passlib[bcrypt]`는 bcrypt 4.x 이상과 호환되지 않아 `bcrypt==4.0.1`로 고정.
- PaddleOCR은 설치 시간이 길고 이미지 크기가 큼 — Docker 빌드 시 주의.
- Ollama AI 요약은 `host.docker.internal:11434`로 호스트 Ollama에 접근 (Docker 내부에서).
