// UI 컴포넌트용 Course 타입 (API Course 타입과 별개)
export interface Course {
  id: string
  code: string
  name: string
  professor: string
  department: string
  schedule: string
  category: "전공필수" | "전공선택" | "교양" | "일반선택"
}

// 프로필 페이지 상수 (추후 API 연동 전까지 사용)
export const careerOptions = [
  "AI/ML 엔지니어",
  "데이터 사이언티스트",
  "백엔드 개발자",
  "프론트엔드 개발자",
  "풀스택 개발자",
  "클라우드 엔지니어",
  "보안 엔지니어",
  "블록체인 개발자",
  "UX 디자이너",
  "프로덕트 매니저",
  "프로덕트 분석가",
  "MLOps 엔지니어",
]

export const interestOptions = [
  "인공지능",
  "머신러닝",
  "딥러닝",
  "데이터분석",
  "보안",
  "암호학",
  "분산시스템",
  "클라우드",
  "웹개발",
  "모바일",
  "UX/UI",
  "블록체인",
]
