-- 004: professors.name 컬럼 폭 확장 (50 → 255)
-- 다중 교수("김민수, 김민준, ...")를 통째로 한 row 의 name 으로 넣는 규칙 때문에 50자 부족.
-- 실행: PYTHONPATH=. python scripts/run_migration.py scripts/migrations/004_widen_professor_name.sql

ALTER TABLE professors
    ALTER COLUMN name TYPE VARCHAR(255);
