-- 001: professors.department 컬럼 추가
-- 기존 교수는 전원 컴퓨터공학과로 backfill, 이후 교양 교수가 들어올 때만 '교양' 명시.
-- 실행: PYTHONPATH=. python scripts/run_migration.py scripts/migrations/001_add_professor_department.sql
-- (run_migration.py 가 engine.begin() 으로 트랜잭션을 감싸므로 BEGIN/COMMIT 은 여기 두지 않음)

-- 1) nullable로 추가
ALTER TABLE professors
    ADD COLUMN IF NOT EXISTS department VARCHAR(50);

-- 2) 기존 데이터는 모두 컴퓨터공학과로 채움
UPDATE professors
SET department = '컴퓨터공학과'
WHERE department IS NULL;

-- 3) NOT NULL 강제
ALTER TABLE professors
    ALTER COLUMN department SET NOT NULL;

-- 4) 분류 분기에 자주 쓰이므로 인덱스
CREATE INDEX IF NOT EXISTS idx_professors_department ON professors(department);

-- 검증 쿼리:
--   SELECT department, COUNT(*) FROM professors GROUP BY department;
