-- 002: professors_professor_id_seq 동기화
-- 기존 31명 교수가 시퀀스를 거치지 않고 들어가 있어 nextval 이 1 부터 시작 → PK 충돌.
-- setval(seq, MAX(id)) 한 번이면 다음 nextval 부터 MAX+1 로 시작.
-- 실행: PYTHONPATH=. python scripts/run_migration.py scripts/migrations/002_resync_professors_sequence.sql

SELECT setval(
    'public.professors_professor_id_seq',
    COALESCE((SELECT MAX(professor_id) FROM professors), 1)
);
