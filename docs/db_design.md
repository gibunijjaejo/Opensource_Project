# 데이터베이스 설계서 (DB Design)

## 1. ERD 관계 요약

| 관계 | 설명 |
|------|------|
| `professors` 1:1 `professor_details` | 교수 상세 정보 |
| `professors` 1:N `courses` | 교수가 담당하는 강의 |
| `courses` 1:1 `course_details` | 강의 상세 정보 |
| `course_details` N:1 `tracks` | 강의가 속한 트랙 |
| `users` 1:N `histories` | 학생 수강 이력 |
| `users` 1:N `carts` | 학생 장바구니 |
| `carts` N:1 `courses` | 장바구니에 담긴 강의 |
| `users` 1:N `posts` | 학생이 작성한 게시글 |
| `posts` 1:N `comments` | 게시글 댓글 |
| `posts` 1:N `post_likes` | 게시글 좋아요 |

---

## 2. 테이블 정의

### users (학생)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `student_id` | int | PK | 학번 |
| `name` | varchar(50) | NOT NULL | 이름 |
| `email` | varchar(100) | UNIQUE, NOT NULL | 이메일 |
| `password` | varchar(255) | NOT NULL | 해싱된 비밀번호 |
| `current_semester` | smallint | | 현재 학기 |
| `interests` | text | default '' | 관심사 |
| `target_careers` | text | default '' | 목표 직무 |
| `major_credits` | int | default 0 | 전공 이수 학점 |
| `common_credits` | int | default 0 | 교양 이수 학점 |
| `total_credits` | int | default 0 | 총 이수 학점 |
| `total_english` | smallint | default 0 | 영어 강의 이수 수 |

---

### professors (교수)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `professor_id` | int | PK | 교수 고유 ID |
| `name` | varchar(100) | NOT NULL | 이름 |
| `course_name` | varchar(255) | | 주요 담당 과목 |
| `lab` | varchar(100) | | 연구실 |

---

### professor_details (교수 상세)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `professor_id` | int | PK, FK → professors | 교수 ID |
| `name` | varchar(100) | | 이름 |
| `email` | varchar(100) | | 이메일 |
| `specialty` | varchar(255) | | 전공 분야 |
| `research_area` | text | | 연구 분야 |
| `research_summary` | text | | 연구 요약 |
| `homepage` | varchar(255) | | 홈페이지 URL |

---

### tracks (트랙)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `track_id` | int | PK | 트랙 고유 ID |
| `track_name` | varchar(100) | NOT NULL | 트랙 이름 (데이터분석·백엔드·프론트엔드 등 14개) |

---

### courses (강의)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `course_id` | int | PK, auto increment | 고유 ID |
| `course_code` | varchar(20) | NOT NULL | 과목 코드 |
| `course_name` | varchar(255) | NOT NULL | 과목명 |
| `credits` | int | | 학점 |
| `target_grade` | varchar(20) | | 대상 학년 |
| `is_english` | boolean | default false | 영어 강의 여부 |
| `class_days` | varchar(50) | | 강의 요일 |
| `class_start_time` | varchar(10) | | 시작 시간 |
| `class_end_time` | varchar(10) | | 종료 시간 |
| `professor_id` | int | FK → professors | 담당 교수 ID |
| `year` | int | | 개설 년도 |
| `semester` | int | | 개설 학기 |
| `course_category` | varchar(50) | | 이수 구분 |

---

### course_details (강의 상세)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `course_id` | int | PK, FK → courses | 강의 ID |
| `required_skills` | text | | 선수 지식 |
| `evaluation_method` | text | | 평가 방법 |
| `teaching_method` | text | | 교수법 |
| `track_id` | int | FK → tracks | 관련 트랙 ID |
| `keyword` | varchar(255) | | 키워드 |
| `overview` | text | | 강의 개요 |
| `pdf_hash` | varchar(64) | | 강의계획서 PDF 해시 |

---

### histories (수강 이력)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | int | PK, auto increment | 고유 ID |
| `student_id` | int | FK → users | 학번 |
| `course_code` | varchar(20) | NOT NULL | 과목 코드 |
| `year` | int | | 수강 년도 |
| `semester` | int | | 수강 학기 |
| `is_retake` | boolean | default false | 재수강 여부 |

---

### carts (장바구니)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | int | PK, auto increment | 고유 ID |
| `student_id` | int | FK → users | 학번 |
| `course_id` | int | FK → courses | 강의 ID |

---

### posts (게시글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | int | PK, auto increment | 고유 ID |
| `category` | varchar(50) | NOT NULL | 게시판 카테고리 |
| `title` | varchar(255) | NOT NULL | 제목 |
| `content` | text | NOT NULL | 내용 |
| `student_id` | int | NOT NULL, FK → users | 작성자 학번 |
| `file_path` | varchar(500) | | 첨부 파일 경로 |
| `file_name` | varchar(255) | | 첨부 파일 이름 |
| `is_anonymous` | boolean | NOT NULL, default false | 익명 여부 |
| `created_at` | datetime | | 작성 일시 |

---

### comments (댓글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | int | PK, auto increment | 고유 ID |
| `post_id` | int | NOT NULL, FK → posts | 게시글 ID |
| `content` | text | NOT NULL | 내용 |
| `student_id` | int | NOT NULL, FK → users | 작성자 학번 |
| `created_at` | datetime | | 작성 일시 |

---

### post_likes (좋아요)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | int | PK, auto increment | 고유 ID |
| `post_id` | int | NOT NULL, FK → posts | 게시글 ID |
| `student_id` | int | NOT NULL, FK → users | 학번 |

---

## 3. Relations

```
// 교수
professor_details.professor_id  ──  professors.professor_id   (1:1)

// 강의
courses.professor_id            →   professors.professor_id   (N:1)
course_details.course_id        ──  courses.course_id         (1:1)
course_details.track_id         →   tracks.track_id           (N:1)

// 학생 활동
histories.student_id            →   users.student_id          (N:1)
carts.student_id                →   users.student_id          (N:1)
carts.course_id                 →   courses.course_id         (N:1)

// 게시판
posts.student_id                →   users.student_id          (N:1)
comments.post_id                →   posts.id                  (N:1)
comments.student_id             →   users.student_id          (N:1)
post_likes.post_id              →   posts.id                  (N:1)
post_likes.student_id           →   users.student_id          (N:1)
```
