# UI/UX 디자인 명세서 (UI/UX Design Specification)

## 1. 디자인 시스템 (Design System)
- **프레임워크:** Next.js 16 (App Router)
- **스타일링:** Tailwind CSS (Utility-first CSS)
- **컴포넌트 라이브러리:** Shadcn UI (Radix UI 기반)
- **아이콘:** Lucide React
- **애니메이션:** Tailwind Animate, Framer Motion (선택적)

## 2. 컬러 시스템 (Color Palette)
- **Primary:** 시스템 기본 테마 컬러 (Slate/Zinc 계열 추정)
- **Background:** 
  - Light: White (#FFFFFF)
  - Dark: Zinc-950 (#09090b)
- **Surface:** Card, Dialog 등 주요 섹션 구분용 배경색
- **Status:** 
  - Success: Green
  - Destructive: Red
  - Warning: Yellow
  - Info: Blue

## 3. 타이포그래피 (Typography)
- **기본 폰트:** Sans-serif (Geist 또는 Inter 등 시스템 폰트 권장)
- **Heading:** 
  - H1: Bold, 2.25rem (36px)
  - H2: SemiBold, 1.875rem (30px)
- **Body:** Regular, 1rem (16px)
- **UI Text:** Medium/Small, 0.875rem (14px)

## 4. 레이아웃 구조 (Layout Structure)
- **전체 레이아웃:** 
  - **Sidebar:** 네비게이션 및 핵심 기능 바로가기 (로그인, 시간표, 졸업 요건 등)
  - **Header:** 유저 프로필, 테마 전환(Toggle), 알림
  - **Main Content:** 각 페이지별 핵심 기능 노출 영역
- **반응형 설계:** 
  - Mobile (< 768px): 사이드바 Drawer 처리, 상단 햄버거 메뉴
  - Desktop (>= 768px): 고정 사이드바 또는 접이식 사이드바

## 5. 주요 UI 컴포넌트 가이드
- **Buttons:** 기본(Primary), 보조(Secondary), 파괴(Destructive), 고스트(Ghost) 스타일 활용
- **Cards:** 강의 정보, 위시리스트, 프로필 요약 정보 등에 사용
- **Forms:** Input, Select, Checkbox 등 일관된 Border-radius 및 Focus Ring 적용
- **Feedback:** Sonner (Toast), Dialog (Modal)를 통한 상태 알림

## 6. 인터랙션 및 테마
- **다크 모드:** `next-themes`를 이용한 시스템 설정 연동 및 수동 전환 지원
- **로딩 상태:** Skeleton 컴포넌트를 활용한 페이지 전환 및 데이터 페칭 경험 개선
