# 아키텍처 및 기술 명세 (Architecture & Technical Specification)

## 1. 서비스 개요

서강대학교 학생이 수강 이력을 기반으로 시간표를 구성하고,
강의계획서를 열람할 수 있는 풀스택 웹 서비스.

- **서비스명** : 서간표 (Seoganpyo)
- **팀원** : Minji, Hyungwoo, Yuhwan, Hayeon
- **서버 환경** : Ubuntu 22.04 (VD17, 163.239.77.77)

---

## 2. 기술 스택 (Tech Stack)

### 백엔드
| 기술 | 용도 |
|------|------|
| FastAPI | REST API 서버 |
| SQLAlchemy | ORM (DB 모델 및 쿼리) |
| PostgreSQL | 운영 데이터베이스 |
| Redis (alpine) | OTP 임시 저장 (TTL 3분) |
| Uvicorn | ASGI 웹 서버 |
| pypdf | 강의계획서 PDF 텍스트 추출 |
| httpx | 외부 HTTP 요청 (크롤링) |
| BeautifulSoup4 | HTML 파싱 |
| RapidFuzz | 이름 퍼지 매칭 (유사도 기반) |
| passlib[bcrypt] | 비밀번호 해싱 (bcrypt==4.0.1 고정) |
| PyJWT | JWT 발급 및 검증 |

### 프론트엔드
| 기술 | 용도 |
|------|------|
| Next.js 16.x | 프론트엔드 프레임워크 (App Router) |
| React 19.x | UI 컴포넌트 |
| TypeScript | 타입 안전성 |
| pnpm 10.x | 패키지 매니저 |
| Tailwind CSS | 스타일링 |

### AI / 외부 서비스
| 기술 | 용도 |
|------|------|
| Groq API (llama-3.3-70b) | 강의계획서 PDF 분석 및 구조화 |
| Ollama (qwen3.5:4b) | 교수 연구분야 한국어 AI 요약 |
| Gmail SMTP | 이메일 인증번호 발송 |

### 인프라 / DevOps
| 기술 | 용도 |
|------|------|
| Docker + docker compose | 컨테이너화 및 멀티 서비스 배포 |
| Jenkins | CI/CD 파이프라인 오케스트레이션 |
| SonarQube (lts-community) | 정적 코드 분석 및 품질 게이트 |
| Ruff | Python 코드 Lint |
| pytest + pytest-cov | 단위 테스트 및 커버리지 |

---

## 3. 시스템 아키텍처

### 전체 구성도

```
[ 사용자 브라우저 ]
        ↓ HTTP
[ Next.js Frontend  :3000 ]
        ↓ REST API
[ FastAPI Backend   :8080 ]
        ├── PostgreSQL            ← 운영 DB
        ├── Redis         :6379   ← OTP 임시 저장
        └── OCR Service   :8001   ← PaddleOCR 마이크로서비스
```

### Docker 컨테이너 구성

```
docker compose
├── seoganpyo-frontend    (Next.js,    3000:3000)
├── seoganpyo-api         (FastAPI,    8080:8000)
├── seoganpyo-redis       (Redis,      6379:6379)
└── seoganpyo-ocr         (PaddleOCR,  8001:8000)
```

### 백엔드 레이어 구조

```
app/
├── main.py          → FastAPI 앱 진입점, 라우터 등록, CORS 설정
├── database.py      → DB 연결 (PostgreSQL + SQLAlchemy)
├── dependencies.py  → 공통 의존성 (JWT → student_id 추출)
├── api/             → 라우터 (HTTP 요청/응답 처리)
│   ├── auth.py      → 이메일 인증 / 회원가입 / 로그인 / 비밀번호 찾기
│   ├── courses.py   → 강의 목록 조회 / 검색
│   ├── cart.py      → 장바구니 CRUD
│   ├── syllabus.py  → 강의계획서 업로드 및 조회
│   ├── upload.py    → 시간표 이미지 업로드 + OCR
│   ├── history.py   → 수강이력 CRUD
│   ├── posts.py     → 커뮤니티 게시판
│   ├── users.py     → 사용자 정보
│   └── admin.py     → 관리자 전용 (크롤링 트리거)
├── models/          → SQLAlchemy ORM 모델 (테이블 정의)
├── schemas/         → Pydantic 스키마 (요청/응답 유효성 검증)
└── services/        → 비즈니스 로직 (DB 접근, 외부 API 호출)
    ├── auth_service.py      → Redis OTP 생성/검증
    ├── user_service.py      → 비밀번호 해싱, JWT 발급
    ├── crawl_service.py     → 교수 정보 크롤링 + Ollama 요약
    ├── syllabus_service.py  → PDF 텍스트 추출 + Groq AI 분석
    ├── image_service.py     → PaddleOCR 시간표 이미지 처리
    ├── history_service.py   → 수강이력 저장/조회
    └── email_service.py     → SMTP 이메일 발송
```

---

## 4. 주요 기능별 아키텍처

### 4-1. 인증 (이메일 OTP + JWT)

```
POST /auth/send-email
  └─ 6자리 OTP 생성 → Redis 저장 (키: {email}, TTL 3분)
     → Gmail SMTP 이메일 발송 (BackgroundTask, 비동기)

POST /auth/verify-code
  └─ Redis 값과 비교 → 일치 시 캐시 삭제

POST /auth/register
  └─ bcrypt 비밀번호 해싱 → PostgreSQL 저장

POST /auth/login
  └─ 비밀번호 검증 → JWT 발급 (student_id 포함)
```

### 4-2. 비밀번호 찾기

```
POST /auth/reset-password/send-email
  └─ DB 가입 여부 확인 → OTP 생성
     → Redis 저장 (키: reset:{email}, TTL 3분, 회원가입과 키 분리)
     → 이메일 발송 (BackgroundTask)

POST /auth/reset-password
  └─ Redis 값 비교 → 일치 시 bcrypt 재해싱 → DB 업데이트
     → Redis 캐시 삭제 (재사용 방지)
```

### 4-3. 데이터 수집

```
(1) 강의계획서 PDF 수집 (브라우저 매크로)
  └─ 수강신청 시스템 접속
     → 과목 목록 순회 (매크로 자동 클릭)
     → 강의계획서 PDF 다운로드
     → data/syllabi/ 저장 (파일명: 2026-1학기__CSE코드_분반.pdf)

(2) Course DB 구축 (배치 스크립트)
  └─ scripts/summarize_syllabi.py --year 2026 --semester 1
     → PDF 순회 → SHA-256 해시 중복 확인 (있으면 SKIP)
     → pypdf 텍스트 추출
     → Groq AI (llama-3.3-70b) 분석
       - 추출 항목: 강의코드, 개요, 목표, 평가방식, 수업방식, 직무트랙
     → 교수명 퍼지 매칭으로 정확한 분반 특정
     → course_details 테이블 upsert
     → API 과부하 방지: 처리 간 3초 대기

(3) 교수 정보 크롤링 (관리자 API)
  └─ POST /admin/crawl/professors (X-Admin-Key 인증)
     → 서강대 CS 홈페이지 크롤링 (httpx + BeautifulSoup4)
     → 교수 목록/상세 페이지 파싱 (이름/이메일/연구분야/홈페이지)
     → RapidFuzz 퍼지 매칭 (유사도 85% 이상) → DB 교수 매핑
     → 연구분야 변경 시에만 Ollama AI 요약 생성
     → professor_details 테이블 upsert
```

### 4-4. 과목검색 & 장바구니

```
GET /api/v1/courses?q=...&year=...&semester=...&category=...
  └─ SQLAlchemy ilike 부분 일치 검색
     → 과목명 / 과목코드 / 교수명 복합 검색
     → 연도/학기/카테고리/영어강의 여부 필터
     → joinedload로 교수 정보 JOIN

POST /api/v1/cart (JWT 인증)
  └─ JWT → student_id 추출 (의존성 주입)
     → 중복 담기 확인 (409 반환)
     → 존재하지 않는 강의 확인 (404 반환)
     → carts 테이블 저장

프론트엔드 (browse-courses.tsx)
  └─ Enter 키 또는 버튼 클릭으로 검색 실행
     → 10개씩 페이지네이션
     → 장바구니 추가 시 즉시 체크 아이콘으로 상태 전환
```

### 4-5. 강의계획서 열람

```
POST /api/v1/syllabus/summarize (PDF 업로드)
  └─ SHA-256 해시 → 캐시 확인 (있으면 즉시 반환, AI 호출 없음)
     → pypdf 텍스트 추출
     → Groq AI 분석 → JSON 파싱
     → 강의코드로 DB 과목 매칭
     → course_details 저장

GET /api/v1/syllabus/{course_id}/pdf
  └─ pdf_hash로 data/syllabi/ 파일 조회
     → PDF 인라인 응답 (한글 파일명 UTF-8 RFC 5987 인코딩)
```

---

## 5. 데이터베이스 설계

> 테이블 상세 컬럼 정의는 [db_design.md](db_design.md) 참고

### ERD 관계

```
User ──< History
User ──< Cart ──> Course
Professor ──< Course ──── CourseDetail
Professor ──── ProfessorDetail
CourseDetail >── Track
```

---

## 6. CI/CD 파이프라인

### 트리거

Poll SCM (`H/5 * * * *`) — 5분 주기로 GitHub 변경사항 감지
> 학교 방화벽으로 GitHub Webhook 수신 불가 → 폴링 방식 채택

### 파이프라인 단계

```
1. Checkout
   └─ 소스코드 체크아웃

2. CI - Lint & Check (병렬 실행)
   ├── Backend Lint  : python3 -m venv → Ruff 코드 품질 점검
   └── Frontend Build: pnpm install → pnpm build 빌드 검증

3. Test & Coverage
   └─ pytest (SQLite 격리 DB, SECRET_KEY=ci-test-secret)
      → JUnit XML 리포트 생성 → Jenkins 연동
      → pytest-cov 커버리지 측정

4. SonarQube Analysis + Quality Gate
   └─ sonar-scanner 실행 → SonarQube 서버로 분석 결과 전송
      → Quality Gate 통과 여부 확인 (실패 시 파이프라인 중단)

5. Pre-Deploy Check
   └─ scripts/pre-deploy.sh 실행

6. Deploy
   └─ docker compose down --remove-orphans
      → docker compose up --build -d

7. Post-Deploy Health Check
   └─ scripts/post-deploy.sh 실행
      → 백엔드/프론트엔드 응답 대기 (MAX_RETRY=24, WAIT=5s)
      → /api/v1/courses 엔드포인트 200 응답 확인
      → docker compose ps 컨테이너 상태 확인
```

### 인프라 구성

```
Ubuntu VD17 (163.239.77.77)
├── Jenkins     :9090   ← systemd override로 8080 충돌 해결
├── SonarQube   :9000   ← Docker 컨테이너 (lts-community)
└── docker compose
    ├── seoganpyo-api       :8080
    ├── seoganpyo-frontend  :3000
    ├── seoganpyo-redis     :6379
    └── seoganpyo-ocr       :8001
```

---

## 7. 보안 설계

| 항목 | 구현 방식 |
|------|-----------|
| 비밀번호 저장 | bcrypt 해싱 (bcrypt==4.0.1 고정) |
| 인증 방식 | JWT Bearer Token (student_id 포함) |
| OTP 보안 | Redis TTL 3분, 인증 성공 즉시 삭제 (재사용 방지) / 회원가입·비밀번호 찾기 키 분리 |
| 이메일 제한 | @sogang.ac.kr 도메인만 허용 |
| 관리자 API | X-Admin-Key 헤더 인증 |
| 민감 정보 | .env 파일 관리 (.gitignore 등록, GitHub 미노출) |
| Webhook URL | Jenkins Credentials 암호화 저장 |

---

## 8. 브랜치 전략 & 개발 규칙

### 브랜치 구조

```
upstream (gibunijjaejo/Opensource_Project) ← 팀 공식 저장소
  └── dev  ← 통합 개발 브랜치 (모든 PR 대상)
        └── main  ← 배포용

origin (yuhwani/Opensource_Project) ← 개인 포크 저장소
  └── feat/기능명  ← 기능 개발 브랜치
```

### 작업 흐름 (Fork 기반)

```
1. upstream/dev 최신화
     git fetch upstream
     git merge upstream/dev

2. 기능 브랜치 생성
     git checkout -b feat/기능명

3. 작업 후 개인 포크에 푸시
     git push origin feat/기능명

4. GitHub에서 PR 생성
     origin/feat/기능명  →  upstream/dev

5. 팀원 코드 리뷰 후 upstream/dev 에 머지
```

> **upstream에 직접 push 금지** — 반드시 PR을 통해 머지

### Remote 구성

| 이름 | URL | 역할 |
|------|-----|------|
| origin | https://github.com/yuhwani/Opensource_Project.git | 개인 포크 |
| upstream | https://github.com/gibunijjaejo/Opensource_Project.git | 팀 공식 |

### 커밋 컨벤션

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새로운 기능 추가 |
| `fix:` | 버그 수정 |
| `refactor:` | 코드 리팩토링 |
| `docs:` | 문서 수정 |
| `chore:` | 빌드/설정 변경 |

### 코드 스타일

- Python : PEP8, snake_case (함수/변수), PascalCase (클래스)
- TypeScript : PascalCase (컴포넌트), camelCase (훅/유틸)
- API : `/api/v1/<리소스>` 형태
- 프론트엔드 API 호출 : `src/lib/api.ts` 집중 관리

---

## 9. Discord 연동 알림

### git-log 채널 — GitHub 연동

- **트리거** : upstream 저장소에 push 또는 PR 이벤트 발생 시
- **연동** : GitHub → Discord Webhook (GitHub 설정에서 직접 연동)
- **알림 내용**
  - push : 커밋한 브랜치명, 커밋 메시지, 작성자, GitHub 링크
  - PR open : PR 제목, 작성자, base/head 브랜치, PR 링크
  - PR merge : 머지된 PR 제목, 머지한 사람
- **용도** : 팀원의 코드 변경사항을 실시간으로 공유

### jenkins-log 채널 — Jenkins CI/CD 연동

- **트리거** : Jenkins 파이프라인 완료 시 (성공 또는 실패)
- **연동** : Jenkinsfile `post` 블록 → Discord Webhook
  (Webhook URL은 Jenkins Credentials에 암호화 저장)

**성공 알림** (`analyze_logs.py --mode success`)

| 항목 | 내용 |
|------|------|
| 제목 | ✅ 빌드 #{번호} 배포 성공 |
| 브랜치 | 빌드된 브랜치명 |
| 컨테이너 | `docker ps` 실시간 조회 (🟢/🔴 아이콘으로 상태 표시) |
| 푸터 | 배포 완료 시각 (KST) |

**실패 알림** (`analyze_logs.py --mode failure`)

| 항목 | 내용 |
|------|------|
| 제목 | ❌ 빌드 #{번호} 실패 — {실패 단계} |
| 브랜치 | 빌드된 브랜치명 |
| 실패 단계 | 어느 stage에서 실패했는지 (FAILED_STAGE 변수) |
| 에러 로그 | 컨테이너 로그에서 에러 키워드 필터링 후 최대 5줄 미리보기 |
| AI 장애 분석 | Claude Agent SDK 분석 결과 4개 항목 |
| 푸터 | 빌드 시각 (KST) |

AI 장애 분석 항목:
- `[핵심 원인]` 에러 근본 원인 1~2문장
- `[영향 범위]` 영향받는 기능/API
- `[즉시 조치]` 당장 해야 할 조치 (최대 3개)
- `[재발 방지]` 재발 방지 한 줄 권고

**실제 수신 예시**
```
❌ 빌드 #99 실패 — Deploy 단계
🌿 브랜치    : test
🚨 실패 단계 : Deploy
📋 에러 로그 미리보기
   [seoganpyo-ocr] C++ Traceback (most recent call last):
   [seoganpyo-ocr] FatalError: Termination signal is detected
🤖 AI 장애 분석
   [핵심 원인] 운영체제로부터 종료 시그널(SIGTERM/SIGKILL)이 수신되어
               seoganpyo-ocr C++ 프로세스 강제 종료.
               OOM(메모리 초과) 또는 컨테이너 리소스 제한 초과 추정.
   [영향 범위] seoganpyo-ocr 서비스 전체 중단,
               OCR 처리 API 및 문서 인식 기능 모두 중단.
   [즉시 조치]
     1. dmesg, journalctl로 OOM Killer 발생 여부 확인
     2. 컨테이너 재시작 후 정상 복구 여부 확인
     3. 메모리·CPU 사용량 모니터링 지표 확인
   [재발 방지] 컨테이너 메모리 한도 상향 조정 및
               OOM 발생 시 자동 재시작 정책(restart policy) 설정
```

**Fallback** (`analyze_logs.py` 실패 시)

curl로 단순 텍스트 메시지 전송
- 성공: `✅ 배포 성공 — 빌드 #{번호} | {브랜치}`
- 실패: `❌ 빌드 실패 — 빌드 #{번호} | {브랜치} | 실패 단계: {단계}`
