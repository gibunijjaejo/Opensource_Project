# UI/UX 디자인 명세서 (UI/UX Design Specification)

## 1. 디자인 시스템 (Design System)

- **프레임워크:** Next.js 16 (App Router)
- **스타일링:** Tailwind CSS v4 (Utility-first CSS, OKLCH 컬러)
- **컴포넌트 라이브러리:** Shadcn UI (Radix UI 기반)
- **아이콘:** Lucide React
- **애니메이션:** Tailwind Animate, Framer Motion (랜딩 페이지 스크롤 애니메이션)

## 2. 컬러 시스템 (Color Palette)

### 브랜드 컬러
- **Crimson:** `#B0232A` — 서강대 교색. 모든 강조·primary 액션·아이콘·뱃지에 사용
    - CSS 변수: `--crimson: #B0232A`
    - 다크/라이트 모드 양쪽에서 동일 (브랜드 일관성)

### 시멘틱 토큰 (자동 다크모드)
| 용도 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.99 0 0)` (거의 흰색) | `oklch(0.18 0 0)` (진한 회색) |
| `--foreground` | `oklch(0.13 0 0)` (검정에 가까움) | `oklch(0.985 0 0)` (흰색) |
| `--card` | `oklch(1 0 0)` (흰색) | `oklch(0.18 0 0)` |
| `--secondary` | `oklch(0.96 0 0)` (밝은 회색) | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.5 0 0)` | `oklch(0.708 0 0)` |
| `--border` | `oklch(0.9 0 0)` | `oklch(0.269 0 0)` |
| `--ring` | crimson `oklch(0.38 0.16 22)` | `oklch(0.439 0 0)` |

### 상태 컬러
- **Success:** Green (Tailwind emerald)
- **Destructive:** Red (Tailwind rose / `--destructive`)
- **Warning:** Yellow (Tailwind amber)
- **Info:** Blue

## 3. 타이포그래피 (Typography)

- **기본 폰트:** Noto Sans KR (`--font-noto-sans-kr`) — 한국어 본문/UI 텍스트
- **로고 폰트:** 이서윤체 (`--font-logo`, `font-logo` 유틸리티) — "서간표" 워드마크 전용
- **모노 폰트:** Geist Mono — 코드·시간표 시간 라벨

### Hierarchy
| 레벨 | 크기 | 두께 | 사용처 |
|---|---|---|---|
| Hero H1 | 5xl ~ 7xl (48~72px) | semibold | 랜딩 페이지 메인 헤드라인 |
| Section H2 | 4xl ~ 5xl (36~48px) | semibold | 랜딩 각 섹션 헤더 |
| H1 (앱 내부) | 2.25rem (36px) | bold | 페이지 제목 |
| H2 (앱 내부) | 1.875rem (30px) | semibold | 섹션 제목 |
| Body | 1rem (16px) | regular | 본문 |
| UI Text | 0.875rem (14px) | medium | 라벨·버튼 |
| Kicker | 12~14px uppercase tracking-widest | semibold (crimson) | 랜딩 섹션 위 작은 라벨 |

## 4. 레이아웃 구조 (Layout Structure)

### 4-1. 라우팅 구조
| URL | 인증 | 역할 |
|---|---|---|
| `/` | 비로그인 가능 | **랜딩 페이지** (서비스 소개, 회원가입/로그인 진입점) |
| `/login`, `/signup` | 비로그인 | 인증 |
| `/dashboard` | 로그인 필수 | **메인 대시보드** (관심 과목·시간표·포트폴리오 진입) |
| `/timetable` | 로그인 필수 | 시간표 작성 (이미지 OCR 업로드) |
| `/course/[id]` | 로그인 필수 | 강의 상세 (계획서·교수 정보) |
| `/professors/[id]` | 로그인 필수 | 교수 프로필 (연구분야 AI 요약) |
| `/portfolio` | 로그인 필수 | 활동 기록 + AI 진로 평가 |
| `/community/[category]` | 로그인 필수 | 관심분야별 게시판 (14개 트랙) |
| `/graduation` | 로그인 필수 | 졸업 요건 / 학점 이수 현황 |
| `/admin/*` | 관리자 토큰 | 운영 도구·모니터링 |

라우팅 보호는 `frontend/src/middleware.ts`에서 일괄 처리. `/`는 명시적 public.

### 4-2. 랜딩 페이지 (`/`)
애플 스타일 single-page scroll. 6개 섹션 순차 노출, 각 섹션 `py-40`(160px) 여백.

| 섹션 | 컴포넌트 | 내용 |
|---|---|---|
| Header | `<Header />` | 로고(이서윤체) · 로그인/회원가입 · ThemeToggle (sticky, backdrop-blur) |
| Hero | `<HeroSection />` | 헤드라인 + CTA "지금 시작하기" + 노트북·모바일 mockup 이미지 |
| OCR | `<FeatureOcr />` | 시간표 이미지 인식 기능 + 폰 mockup |
| AI 요약 | `<FeatureAi />` | 강의계획서 요약 + 교수 연구 분석 카드 |
| 커뮤니티 | `<FeatureCommunity />` | 관심분야 게시판 미리보기 (4개 카드) |
| CTA | `<CtaSection />` | "지금 시작해보세요" 회원가입/로그인 |
| Footer | `<Footer />` | 저작권 + GitHub 링크 |

스크롤 애니메이션은 `<FadeInSection>` 헬퍼로 모든 섹션이 viewport 진입 시 fade-up.

### 4-3. 앱 내부 (대시보드 이후)
- **Header:** 좌측 로고(BookOpen + 이서윤체) · 우측 프로필/저장개수/ThemeToggle
- **Main Content:** 페이지별 단일 컬럼, 좌측 `border-l-2` 크림슨 액센트
- **사이드바 없음** — 카드형 그리드 + 페이지간 이동은 라우팅으로

### 4-4. 반응형 설계
- Mobile (< 640px): 단일 컬럼, 햄버거 메뉴 없음 (모든 액션이 카드형)
- Tablet (640px~): 2컬럼 그리드 활성화
- Desktop (1024px~): 풀 레이아웃, 랜딩 hero mockup 최대 1024px

## 5. 주요 UI 컴포넌트 가이드

### Buttons
| 변형 | 사용처 | 스타일 |
|---|---|---|
| Primary (브랜드) | "회원가입", "지금 시작하기" 등 핵심 CTA | `bg-[#B0232A] text-white rounded-full` + 그림자 호버 |
| Secondary | 보조 액션 | `variant="outline"` + crimson 테두리 |
| Ghost | 헤더 링크 | 기본 링크 스타일 + hover 색상 변화 |
| Destructive | 삭제·탈퇴 | `bg-destructive` |

랜딩 메인 CTA는 호버 시 `-translate-y-0.5` + 그림자 강화 + 화살표 슬라이드.

### Cards
- 기본: `rounded-2xl border border-border bg-card p-6 shadow-sm`
- 호버 인터랙션: `hover:bg-secondary/30` 또는 `hover:shadow-sm`
- 강의 정보·위시리스트·게시글·AI 요약 카드에 일관 적용

### Forms
- Input·Select·Checkbox: shadcn 기본 스타일 + crimson focus ring
- Border-radius `0.375rem` 통일

### Feedback
- Toast: Sonner
- Modal: shadcn Dialog
- Skeleton: 데이터 페칭 동안 로딩 표시

## 6. 인터랙션 및 테마

- **다크 모드:** `next-themes` (`<ThemeProvider>` 루트 레이아웃에 설치). 시스템 설정 추적 비활성화(`enableSystem={false}`), 기본값 light. 헤더 우측 `<ThemeToggle>`로 수동 전환.
- **랜딩 스크롤 애니메이션:** Framer Motion `whileInView` + `viewport={{ once: true, margin: "-80px" }}`로 한 번만 트리거. easing `[0.22, 1, 0.36, 1]` (ease-out-quart 유사).
- **로딩 상태:** Skeleton 컴포넌트로 페이지 전환·데이터 페칭 경험 개선.
- **이미지 최적화:** 랜딩 mockup은 `next/image` `priority` 로 LCP 개선.
