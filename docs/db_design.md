# 데이터베이스 설계서 (DB Design)

## 1. Entity Relationship Diagram (ERD)

- 주요 관계:
    - `User` 1 : N `History` (수강 이력)
    - `User` 1 : N `Cart` (장바구니)
    - `Professor` 1 : N `Course` (강의)
    - `Course` 1 : 1 `CourseDetail` (강의 상세)
    - `Professor` 1 : 1 `ProfessorDetail` (교수 상세)
    - `Course` N : 1 `Professor`

## 2. 테이블 정의

### Users (사용자)

- `student_id` (PK): Integer - 학번
- `name`: String(50) - 이름
- `email` (Unique): String(100) - 이메일
- `password`: String(255) - 해싱된 비밀번호
- `current_semester`: SmallInteger - 현재 학기
- `major_credits`: Integer - 전공 이수 학점
- `common_credits`: Integer - 교양 이수 학점
- `total_credits`: Integer - 총 이수 학점
- `total_english`: SmallInteger - 영어 강의 이수 수

### Courses (강의)

- `course_id` (PK): Integer - 고유 ID
- `course_code`: String(20) - 과목 코드
- `course_name`: String(255) - 과목명
- `credits`: Integer - 학점
- `target_grade`: String(20) - 대상 학년
- `is_english`: Boolean - 영어 강의 여부
- `class_days`: String(50) - 강의 요일
- `class_start_time`: String(10) - 시작 시간
- `class_end_time`: String(10) - 종료 시간
- `professor_id` (FK): Integer - 담당 교수 ID
- `year`: Integer - 개설 년도
- `semester`: Integer - 개설 학기
- `course_category`: String(50) - 이수 구분

### Course Details (강의 상세)

- `course_id` (PK, FK): Integer - 강의 ID
- `required_skills`: Text - 선수 지식
- `evaluation_method`: String(100) - 평가 방법
- `teaching_method`: String(50) - 교수법
- `track_id` (FK): Integer - 관련 트랙 ID
- `keyword`: String(255) - 키워드

### Professors (교수)

- `professor_id` (PK): Integer - 교수 고유 ID
- `name`: String(100) - 이름
- `course_name`: String(255) - 주요 담당 과목
- `lab`: String(100) - 연구실

### Histories (수강 이력)

- `id` (PK): Integer - 고유 ID
- `student_id` (FK): Integer - 학번
- `course_code`: String(20) - 과목 코드
- `year`: Integer - 수강 년도
- `semester`: Integer - 수강 학기
- `is_retake`: Boolean - 재수강 여부

### Carts (장바구니)

- `id` (PK): Integer - 고유 ID
- `student_id` (FK): Integer - 학번
- `course_id` (FK): Integer - 강의 ID

### Tracks (트랙)

- `track_id` (PK): Integer - 트랙 고유 ID
- `track_name`: String(100) - 트랙 이름
