-- 003: courses.course_category 정규화 (전공/교양 2값만)
-- 기존에 NULL, "전공필수", "전공선택" 같은 값들 섞여 있는 걸 prefix 기준으로 일괄 backfill.
-- 룰: course_code 가 CSE 로 시작 → "전공", 그 외 → "교양".
-- IS DISTINCT FROM 으로 멱등 (같은 값이면 UPDATE 안 함).
-- 실행: PYTHONPATH=. python scripts/run_migration.py scripts/migrations/003_normalize_course_category.sql

UPDATE courses
SET course_category = '전공'
WHERE course_code LIKE 'CSE%'
  AND course_category IS DISTINCT FROM '전공';

UPDATE courses
SET course_category = '교양'
WHERE course_code NOT LIKE 'CSE%'
  AND course_category IS DISTINCT FROM '교양';

-- 검증 쿼리:
--   SELECT course_category, COUNT(*) FROM courses GROUP BY course_category;
