export interface User {
  student_id: number
  name: string
  email: string
  current_semester: number | null
  major_credits: number
  common_credits: number
  total_credits: number
  total_english: number
}

export interface CourseDetail {
  required_skills: string | null
  evaluation_method: string | null
  teaching_method: string | null
  keyword: string | null
}

export interface Course {
  course_id: number
  course_code: string
  course_name: string
  credits: number | null
  target_grade: string | null
  is_english: boolean
  class_days: string | null
  class_start_time: string | null
  class_end_time: string | null
  professor_id: number | null
  year: number | null
  semester: number | null
  course_category: string | null
  details: CourseDetail | null
}

export interface CartItem {
  id: number
  student_id: number
  course_id: number
  course: Course | null
}

export interface Token {
  access_token: string
  token_type: string
}

export interface HistoryItem {
  id: number
  student_id: number
  course_code: string
  year: number | null
  semester: number | null
  is_retake: boolean
  course: Course | null
}
