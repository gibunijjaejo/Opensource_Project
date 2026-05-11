-- 005: 다중 교수("A, B, C") row 를 컴공 department 에서 교양으로 이동
-- "팀티칭" 형태로 한 강의에 여러 교수가 묶인 row 는 컴공 교수 프로필 페이지에서 의미가 없음.
-- import 가 CSE 과목 만나면 컴공으로 넣었지만, name 에 ", " 가 포함되면 개인 프로필이 아니므로 교양으로 옮긴다.
-- 향후 import 도 동일 정책을 따르도록 import_courses.py 의 _department_for 도 같이 갱신할 것.

UPDATE professors
SET department = '교양'
WHERE department = '컴퓨터공학과'
  AND name LIKE '%, %';

-- 검증:
--   SELECT department, COUNT(*) FROM professors GROUP BY department;
--   SELECT name FROM professors WHERE department='컴퓨터공학과' AND name LIKE '%, %';  -- 0건이어야
