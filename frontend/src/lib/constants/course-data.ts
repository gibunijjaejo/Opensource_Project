// UI 컴포넌트용 Course 타입 (API Course 타입과 별개)
export interface Course {
  id: string
  code: string
  name: string
  professor: string
  department: string
  schedule: string
  category: "전공필수" | "전공선택" | "교양" | "일반선택"
  days?: string | null
  startTime?: string | null
  endTime?: string | null
}

// 관심 분야 (졸업 후 희망 분야)
export const interestOptions = [
  "소프트웨어 개발",
  "데이터·AI",
  "보안·시스템",
  "게임 개발",
  "임베디드·IoT",
  "연구·대학원",
  "창업",
  "금융·핀테크",
]
