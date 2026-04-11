# 서간표 운영 Runbook

> 장애 발생 시 이 문서를 먼저 확인하세요.
> Discord 알림 → 해당 섹션으로 이동 → 체크리스트 순서대로 실행.

---

## 1. 서비스 개요

| 컨테이너 | 포트 | 역할 |
|---|---|---|
| seoganpyo-frontend | 3000 | Next.js 프론트엔드 |
| seoganpyo-api | 8080 | FastAPI 백엔드 |
| seoganpyo-redis | 6379 | 인증 OTP 임시 저장 (3분 TTL) |
| seoganpyo-ocr | 8001 | PaddleOCR 시간표 인식 |
| PostgreSQL (외부) | 5432 | 163.239.77.77 / DB: seoganpyo |

**CI/CD 흐름:**
```
Push → GitHub Actions (Lint + Test) → Jenkins
  → SonarQube → Pre-Deploy → Docker Compose → Post-Deploy
  → Discord 알림 (성공/실패)
```

---

## 2. Discord 알림 해석 방법

Jenkins 빌드 결과는 Discord에 **Embed 카드** 형태로 전송됩니다.

### ✅ 배포 성공 카드
```
✅ 빌드 #42 배포 성공
─────────────────────────────
🌿 브랜치        | 🐳 컨테이너
main             | api · frontend · redis · ocr 정상 기동
─────────────────────────────
배포 완료: 2026-04-11 09:32:01 KST
```
→ 별도 조치 불필요

### ❌ 빌드 실패 카드
```
❌ 빌드 #43 실패 — Deploy 단계
─────────────────────────────
🌿 브랜치        | 🚨 실패 단계
main             | Deploy
─────────────────────────────
📋 에러 로그 미리보기
  [seoganpyo-api] ERROR: Connection refused (port 5432)
  ...
─────────────────────────────
🤖 AI 장애 분석
  [핵심 원인] PostgreSQL 연결 실패 — DB_HOST 환경변수 오설정 또는 DB 서버 다운
  [영향 범위] 로그인, 강의 조회, 모든 인증 필요 API 불가
  [즉시 조치] 1. .env DB_HOST 확인  2. DB 서버 ping  3. docker compose restart backend
  [재발 방지] DB 헬스체크를 pre-deploy.sh에 추가
─────────────────────────────
빌드 시각: 2026-04-11 09:35:22 KST
```

**실패 단계별 의미:**

| 실패 단계 | 의미 | 담당 |
|----------|------|------|
| CI - Lint & Check | Python ruff 오류 또는 프론트 빌드 실패 | 코드 작성자 |
| Test & Coverage | pytest 테스트 실패 | 코드 작성자 |
| SonarQube Analysis | 정적 분석 서버 오류 | DevOps |
| Quality Gate | 코드 품질 기준 미달 | 코드 작성자 |
| Pre-Deploy Check | .env 누락 또는 Docker 미실행 | DevOps |
| Deploy | 컨테이너 빌드/실행 실패 | DevOps |
| Post-Deploy Check | 배포 후 헬스체크 실패 | DevOps |

---

## 3. 초기 대응 체크리스트 (5분 이내)

장애 알림 수신 즉시 아래 순서로 확인합니다.

```bash
# 1. 컨테이너 상태 확인 (30초)
docker compose ps

# 2. 에러 로그 확인 (1분)
docker compose logs seoganpyo-api --tail=50
docker compose logs seoganpyo-frontend --tail=30

# 3. 헬스체크 (30초)
curl -s http://localhost:8080/ | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/

# 4. DB 연결 확인 (1분)
docker compose exec -T seoganpyo-api python -c \
  "from app.database import engine; engine.connect(); print('DB OK')"

# 5. Redis 확인 (30초)
docker compose exec -T seoganpyo-redis redis-cli ping
```

---

## 4. 컨테이너별 트러블슈팅

### 4-1. seoganpyo-api (백엔드) 장애

**증상:** `/api/v1/*` 응답 없음, 500 오류

```bash
# 로그 확인
docker compose logs seoganpyo-api --tail=100 -f

# 재시작
docker compose restart seoganpyo-api

# 환경변수 확인
docker compose exec -T seoganpyo-api env | grep -E "DB_|SECRET|GROQ|REDIS"

# 강제 재빌드
docker compose up --build -d seoganpyo-api
```

### 4-2. seoganpyo-frontend (프론트엔드) 장애

**증상:** 화면이 안 뜸, 빈 화면

```bash
docker compose logs seoganpyo-frontend --tail=50
docker compose build --no-cache seoganpyo-frontend
docker compose up -d seoganpyo-frontend
```

### 4-3. seoganpyo-redis (Redis) 장애

**증상:** 이메일 인증번호가 작동 안 함

```bash
docker compose restart seoganpyo-redis
docker compose restart seoganpyo-api   # 백엔드도 재시작 필요
docker compose exec -T seoganpyo-redis redis-cli ping  # PONG 응답 확인
```

### 4-4. seoganpyo-ocr (OCR 서비스) 장애

**증상:** 시간표 이미지 업로드 실패

```bash
docker compose logs seoganpyo-ocr --tail=50
docker compose restart seoganpyo-ocr
# OCR은 시작에 30~60초 소요 (PaddleOCR 모델 로딩)
sleep 60 && curl -s http://localhost:8001/health
```

---

## 5. 자주 발생하는 장애 사례

### CASE 1. 로그인/회원가입이 안 될 때
**원인:** `users` 테이블 컬럼 누락
```bash
docker compose exec -T seoganpyo-api python -c "
from app.database import engine
import sqlalchemy as sa
with engine.connect() as conn:
    conn.execute(sa.text(\"ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT DEFAULT ''\"))
    conn.execute(sa.text(\"ALTER TABLE users ADD COLUMN IF NOT EXISTS target_careers TEXT DEFAULT ''\"))
    conn.commit()
    print('done')
"
```

### CASE 2. 게시글 등록이 안 될 때
**원인:** `posts` 테이블 컬럼 누락
```bash
docker compose exec -T seoganpyo-api python -c "
from app.database import engine
import sqlalchemy as sa
with engine.connect() as conn:
    conn.execute(sa.text(\"ALTER TABLE posts ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)\"))
    conn.execute(sa.text(\"ALTER TABLE posts ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)\"))
    conn.execute(sa.text(\"ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE\"))
    conn.commit()
    print('done')
"
```

### CASE 3. 강의계획서 버튼이 안 뜰 때
**원인:** `data/syllabi/`에 PDF가 있지만 DB에 hash 미등록
```bash
docker compose exec -T seoganpyo-api python -c "
import hashlib, re
from pathlib import Path
from app.database import engine
import sqlalchemy as sa

with engine.connect() as conn:
    for f in sorted(Path('data/syllabi').glob('*.pdf')):
        m = re.search(r'(CSE\d{4})', f.name)
        if not m: continue
        row = conn.execute(sa.text(\"SELECT course_id FROM courses WHERE course_code=:c AND year=2026 AND semester=1\"), {'c': m.group(1)}).first()
        if not row: continue
        h = hashlib.sha256(f.read_bytes()).hexdigest()
        exists = conn.execute(sa.text('SELECT 1 FROM course_details WHERE course_id=:id'), {'id': row[0]}).first()
        if exists:
            conn.execute(sa.text('UPDATE course_details SET pdf_hash=:h WHERE course_id=:id'), {'h': h, 'id': row[0]})
        else:
            conn.execute(sa.text('INSERT INTO course_details (course_id, pdf_hash) VALUES (:id, :h)'), {'id': row[0], 'h': h})
        conn.commit()
        print(f'OK: {m.group(1)}')
"
```

### CASE 4. OTP 인증번호가 안 올 때
1. `.env`의 `SENDER_EMAIL`, `SENDER_PASSWORD` 확인
2. Redis 컨테이너 상태 확인: `docker compose ps seoganpyo-redis`
3. Redis 재시작: `docker compose restart seoganpyo-redis && docker compose restart seoganpyo-api`

### CASE 5. DB 연결 실패 (ConnectionRefused / OperationalError)
```bash
# DB 서버 도달 가능 여부 확인
ping 163.239.77.77
nc -zv 163.239.77.77 5432

# .env DB 설정 재확인
cat .env | grep DB_

# 백엔드 재시작
docker compose restart seoganpyo-api
```

### CASE 6. Groq API 오류 (강의계획서 요약 실패)
```bash
# API 키 유효 여부 확인
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | python3 -m json.tool | head -5

# 키 만료 시 → console.groq.com에서 새 키 발급 후 .env 업데이트
```

---

## 6. 로그 확인 명령어 모음

```bash
# 전체 로그 실시간
docker compose logs -f

# 특정 컨테이너 최근 N줄
docker compose logs seoganpyo-api --tail=100
docker compose logs seoganpyo-frontend --tail=50
docker compose logs seoganpyo-ocr --tail=50

# 에러만 필터
docker compose logs seoganpyo-api 2>&1 | grep -iE "error|exception|traceback|critical"

# AI 로그 분석 (로컬 실행)
python3 scripts/analyze_logs.py \
  --build-number manual \
  --branch $(git branch --show-current) \
  --failed-stage "Manual Check" \
  --webhook "$DISCORD_WEBHOOK" \
  --containers seoganpyo-api seoganpyo-frontend seoganpyo-ocr
```

---

## 7. 배포 체크리스트

### 배포 전
- [ ] `.env` 파일 존재 및 필수값 (`DB_*`, `SENDER_*`, `GROQ_API_KEY`) 확인
- [ ] `data/syllabi/`, `static/uploads/posts/` 디렉토리 존재 확인
- [ ] DB 스키마 변경 시 `ALTER TABLE` 먼저 실행
- [ ] Docker 데몬 실행 중인지 확인: `docker ps`

### 배포 후
- [ ] `http://localhost:8080/` → `{"message": "서간표 통합 서버가 준비되었습니다"}` 확인
- [ ] `http://localhost:3000/` 프론트엔드 로딩 확인
- [ ] 로그인 → 과목 검색 → 게시판 글 작성 동작 확인
- [ ] `docker compose ps` 전체 컨테이너 `Up` 상태 확인

---

## 8. 전체 서비스 명령어

```bash
# 전체 시작
docker compose up -d

# 코드 변경 후 재빌드 (전체)
docker compose up --build -d

# 특정 서비스만 재빌드
docker compose up --build -d seoganpyo-api
docker compose up --build -d seoganpyo-frontend

# 중지
docker compose down

# 완전 초기화 (볼륨 포함 삭제 — 주의)
docker compose down -v --remove-orphans
```

---

## 9. 에스컬레이션 기준

| 상황 | 대응 |
|------|------|
| 컨테이너 재시작으로 해결됨 | 본인 처리 후 Discord에 조치 내용 공유 |
| DB 서버(외부) 다운 | 팀 전체 공지 + DB 관리자(학교 측) 연락 |
| 데이터 유실 의심 | 즉시 `docker compose stop` 후 팀 리더에게 에스컬레이션 |
| 보안 키/비밀번호 노출 의심 | `.env` 즉시 교체 + 팀 전체 공유 |
| 2회 이상 반복 장애 | GitHub Issue 생성 후 근본 원인 분석 |

---

## 10. Jenkins 수동 분석 (긴급 시)

Discord AI 분석 카드를 받지 못했거나 직접 분석하고 싶을 때:

```bash
# 로컬에서 수동으로 AI 분석 실행
DISCORD_WEBHOOK="your-webhook-url" \
python3 scripts/analyze_logs.py \
  --build-number 0 \
  --branch main \
  --failed-stage "Manual" \
  --containers seoganpyo-api seoganpyo-frontend seoganpyo-ocr
```

> ⚠️ `GROQ_API_KEY`가 `.env`에 있어야 실행됩니다.
