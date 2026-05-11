-- 006: histories.is_retake 일괄 재계산
-- 규칙: 같은 (student_id, course_code) 그룹에서 시간순(year, semester) 가장 이른 row 한 개만 false,
--      나머지는 true. NULL year/semester 는 가장 뒤로 (재수강 취급).
-- 학기 시간순: 1학기(봄) → 하계(3) → 2학기(가을) → 동계(4).
-- 실행: PYTHONPATH=. python scripts/run_migration.py scripts/migrations/006_recompute_is_retake.sql

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY student_id, course_code
            ORDER BY
                year NULLS LAST,
                CASE semester
                    WHEN 1 THEN 1
                    WHEN 3 THEN 2
                    WHEN 2 THEN 3
                    WHEN 4 THEN 4
                    ELSE 9
                END NULLS LAST,
                id
        ) AS rn
    FROM histories
)
UPDATE histories h
SET is_retake = (r.rn > 1)
FROM ranked r
WHERE h.id = r.id
  AND h.is_retake IS DISTINCT FROM (r.rn > 1);

-- 검증:
--   SELECT student_id, course_code, year, semester, is_retake
--   FROM histories
--   WHERE (student_id, course_code) IN (
--     SELECT student_id, course_code FROM histories GROUP BY 1,2 HAVING COUNT(*) > 1
--   )
--   ORDER BY student_id, course_code, year, semester;
