# 서간표 운영 Runbook

## 서비스 구성

| 컨테이너 | 포트 | 역할 |
|---|---|---|
| seoganpyo-frontend | 3000 | Next.js 프론트엔드 |
| seoganpyo-api | 8080 | FastAPI 백엔드 (--reload) |
| seoganpyo-redis | 6379 | 인증 OTP 임시 저장 (3분 TTL) |
| seoganpyo-ocr | 8001 | PaddleOCR 시간표 인식 |
| PostgreSQL (외부) | 5432 | 163.239.77.77 / DB: seoganpyo |

---

## 자주 쓰는 명령어

```bash
# 전체 시작
docker compose up -d

# 코드 변경 후 재빌드
docker compose up --build -d
docker compose up --build -d frontend   # 프론트만
docker compose up --build -d backend    # 백엔드만

# 중지
docker compose down

# 로그
docker compose logs backend --tail=50 -f
docker compose logs frontend --tail=50 -f

# 컨테이너 상태
docker compose ps
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

## 배포 체크리스트

### 배포 전
- [ ] `.env` 파일 존재 및 필수값(`DB_*`, `SENDER_*`) 확인
- [ ] `data/syllabi/`, `static/uploads/posts/` 디렉토리 존재 확인
- [ ] DB 스키마 변경 시 `ALTER TABLE` 먼저 실행

### 배포 후
- [ ] `http://localhost:8080/` → `{"message": "서간표 통합 서버가 준비되었습니다"}` 확인
- [ ] `http://localhost:3000/` 프론트엔드 로딩 확인
- [ ] 로그인 → 과목 검색 → 게시판 글 작성 동작 확인
- [ ] `docker compose ps` 전체 컨테이너 `Up` 상태 확인
