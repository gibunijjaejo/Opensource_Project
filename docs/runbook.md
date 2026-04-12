# 서간표 운영 Runbook

## 서비스 구성

| 컨테이너 | 포트 | 역할 |
|---|---|---|
| seoganpyo-frontend | 3000 | Next.js 프론트엔드 |
| seoganpyo-api | 8080 | FastAPI 백엔드 |
| seoganpyo-redis | 6379 | 인증 OTP 임시 저장 (3분 TTL) |
| seoganpyo-ocr | 8001 | PaddleOCR 시간표 인식 |
| PostgreSQL (외부) | 8000 | 163.239.77.77 / DB: seoganpyo |

---

## 자주 쓰는 명령어

```bash
# 로컬 개발 (--reload + HMR + 팀 DB 연결)
make dev

# VDI 배포 (pre-check → build → post-check)
make prod

# 중지
make down

# 로그 스트리밍
make logs

# 컨테이너 상태
make ps

# 특정 서비스만 재빌드
docker compose up --build -d frontend
docker compose up --build -d backend
```

---

## 장애 대응

### 로그인/회원가입이 안 될 때
원인: `users` 테이블 컬럼 누락
```bash
docker compose exec -T backend python -c "
from app.database import engine
import sqlalchemy as sa
with engine.connect() as conn:
    conn.execute(sa.text(\"ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT DEFAULT ''\"))
    conn.execute(sa.text(\"ALTER TABLE users ADD COLUMN IF NOT EXISTS target_careers TEXT DEFAULT ''\"))
    conn.commit()
    print('done')
"
```

### 게시글 등록이 안 될 때
원인: `posts` 테이블 컬럼 누락
```bash
docker compose exec -T backend python -c "
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

### 강의계획서 버튼이 안 뜰 때
원인: `data/syllabi/`에 PDF가 있지만 DB에 hash 미등록
```bash
docker compose exec -T backend python -c "
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

### OTP 인증번호가 안 올 때
- `.env`의 `SENDER_EMAIL`, `SENDER_PASSWORD` 확인
- Redis 컨테이너 상태 확인: `docker compose ps redis`
- Redis 재시작: `docker compose restart redis && docker compose restart backend`

### 프론트엔드 빌드 실패
```bash
docker compose logs frontend --tail=50
docker compose build --no-cache frontend
docker compose up -d frontend
```

---

## VDI 서버 환경 설정

### 최초 1회 설정

**1. 포트 포워딩 (외부 접근용)**
```bash
# VDI 방화벽에서 아래 포트 오픈 필요 (학교 네트워크 정책 확인)
# 3000 — Next.js 프론트엔드
# 8080 — FastAPI 백엔드
# 8001 — OCR 서비스 (내부용, 외부 오픈 불필요)
# 6379 — Redis (내부용, 외부 오픈 불필요)

# Ubuntu UFW 기준
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
sudo ufw reload
sudo ufw status
```

**2. Docker & Docker Compose 설치 확인**
```bash
docker --version        # 24.x 이상 권장
docker compose version  # v2.x 이상 권장
```

**3. 프로젝트 클론 및 환경변수 설정**
```bash
git clone https://github.com/gibunijjaejo/Opensource_Project.git
cd Opensource_Project
cp .env.example .env
# .env 편집: DB_HOST를 VDI 내부 PostgreSQL IP로 설정
```

**4. 외부 PostgreSQL 연결 확인**
```bash
# DB_HOST가 외부 서버인 경우 연결 테스트
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -c "SELECT 1"
```

**5. 최초 배포**
```bash
make prod
```

### 접속 주소

| 환경 | URL |
|------|-----|
| 프론트엔드 | `http://<VDI_IP>:3000` |
| 백엔드 API | `http://<VDI_IP>:8080` |
| API 문서 | `http://<VDI_IP>:8080/docs` |

> VDI IP는 `hostname -I` 또는 `ip addr show` 로 확인

---

## VDI 서버 환경 설정

### 최초 1회 설정

**1. 포트 포워딩 (외부 접근용)**
```bash
# VDI 방화벽에서 아래 포트 오픈 필요 (학교 네트워크 정책 확인)
# 3000 — Next.js 프론트엔드
# 8080 — FastAPI 백엔드
# 8001 — OCR 서비스 (내부용, 외부 오픈 불필요)
# 6379 — Redis (내부용, 외부 오픈 불필요)

# Ubuntu UFW 기준
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
sudo ufw reload
sudo ufw status
```

**2. Docker & Docker Compose 설치 확인**
```bash
docker --version        # 24.x 이상 권장
docker compose version  # v2.x 이상 권장
```

**3. 프로젝트 클론 및 환경변수 설정**
```bash
git clone https://github.com/gibunijjaejo/Opensource_Project.git
cd Opensource_Project
cp .env.example .env
# .env 편집: DB_HOST를 VDI 내부 PostgreSQL IP로 설정
```

**4. 외부 PostgreSQL 연결 확인**
```bash
# DB_HOST가 외부 서버인 경우 연결 테스트
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -c "SELECT 1"
```

**5. 최초 배포**
```bash
make prod
```

### 접속 주소

| 환경 | URL |
|------|-----|
| 프론트엔드 | `http://<VDI_IP>:3000` |
| 백엔드 API | `http://<VDI_IP>:8080` |
| API 문서 | `http://<VDI_IP>:8080/docs` |

> VDI IP는 `hostname -I` 또는 `ip addr show` 로 확인

---

## 배포 체크리스트

### 배포 전
- [ ] `.env` 파일 존재 및 필수값(`DB_*`, `SECRET_KEY`, `ADMIN_SECRET_KEY`, `SENDER_*`) 확인
- [ ] `data/syllabi/`, `static/uploads/posts/` 디렉토리 존재 확인
- [ ] DB 스키마 변경 시 `ALTER TABLE` 먼저 실행

### 배포 후
- [ ] `http://localhost:8080/` → `{"message": "서간표 통합 서버가 준비되었습니다"}` 확인
- [ ] `http://localhost:3000/` 프론트엔드 로딩 확인
- [ ] 로그인 → 과목 검색 → 게시판 글 작성 동작 확인
- [ ] `docker compose ps` 전체 컨테이너 `Up` 상태 확인
