"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, BookMarked, User, Upload, ChevronRight, Settings, GraduationCap, LogOut, Users, Sparkles } from "lucide-react"
import { WishlistCard } from "@/components/features/wishlist-card"
import { BrowseCourses } from "@/components/features/browse-courses"
import { TimetableGrid } from "@/components/features/timetable-grid"
import type { Course } from "@/lib/constants/course-data"
import { coursesApi, cartApi, usersApi, historyApi } from "@/lib/api"
import { getCurrentSemester } from "@/lib/utils"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import type { Course as ApiCourse, CartItem } from "@/types"

// API 응답 → 컴포넌트가 기대하는 Course 타입으로 변환
function mapApiCourse(c: ApiCourse): Course {
  const categoryMap: Record<string, Course["category"]> = {
    전공필수: "전공필수",
    전공선택: "전공선택",
    교양: "교양",
    일반선택: "일반선택",
  }
  return {
    id: String(c.course_id),
    code: c.course_code,
    name: c.course_name,
    professor: c.professor?.name ?? "-",
    department: c.course_category ?? "",
    schedule: [c.class_days, c.class_start_time, c.class_end_time]
      .filter(Boolean)
      .join(" "),
    category: categoryMap[c.course_category ?? ""] ?? "일반선택",
    days: c.class_days,
    startTime: c.class_start_time,
    endTime: c.class_end_time,
  }
}

const TARGET_YEAR = 2026
const TARGET_SEMESTER = 1

// Query key factory — 다른 페이지에서도 동일 키로 캐시 공유 가능.
const QK = {
  courses: (year: number, semester: number, division: "major" | "liberal") =>
    ["courses", { year, semester, division }] as const,
  cart: ["cart"] as const,
  me: ["users", "me"] as const,
  myHistories: ["histories", "me"] as const,
}

const fetchCourses = (division: "major" | "liberal") =>
  coursesApi
    .list({ year: TARGET_YEAR, semester: TARGET_SEMESTER, division })
    .then((data) => data.map(mapApiCourse))

export default function DashboardPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [liberalRequested, setLiberalRequested] = useState(false)

  // 인증 가드 — 토큰 없으면 로그인 페이지로
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) router.replace("/login")
  }, [router])

  // React Query 가 mount/unmount 무관하게 캐시를 유지하므로 페이지 이동 후 돌아와도 즉시 hit.
  const majorQuery = useQuery({
    queryKey: QK.courses(TARGET_YEAR, TARGET_SEMESTER, "major"),
    queryFn: () => fetchCourses("major"),
  })
  const liberalQuery = useQuery({
    queryKey: QK.courses(TARGET_YEAR, TARGET_SEMESTER, "liberal"),
    queryFn: () => fetchCourses("liberal"),
    // 사용자가 교양 토글을 누른 적이 있을 때만 활성화. prefetch 가 미리 캐시를 채워놓으므로 hit.
    enabled: liberalRequested,
  })
  const meQuery = useQuery({ queryKey: QK.me, queryFn: () => usersApi.me() })
  const cartQuery = useQuery({ queryKey: QK.cart, queryFn: () => cartApi.get() })
  const historiesQuery = useQuery({
    queryKey: QK.myHistories,
    queryFn: () => historyApi.getMyHistories(),
  })

  // 전공 fetch 끝나면 교양도 백그라운드 prefetch (캐시에 채워두기)
  useEffect(() => {
    if (majorQuery.isSuccess) {
      queryClient.prefetchQuery({
        queryKey: QK.courses(TARGET_YEAR, TARGET_SEMESTER, "liberal"),
        queryFn: () => fetchCourses("liberal"),
      })
    }
  }, [majorQuery.isSuccess, queryClient])

  const majorCourses = majorQuery.data ?? []
  const liberalCourses = liberalQuery.data ?? []
  const loadingDivision: "major" | "liberal" | null = majorQuery.isPending
    ? "major"
    : liberalCourses.length === 0 &&
      (liberalQuery.isFetching ||
        queryClient.isFetching({
          queryKey: QK.courses(TARGET_YEAR, TARGET_SEMESTER, "liberal"),
        }) > 0)
    ? "liberal"
    : null

  const fetchLiberalIfNeeded = useCallback(() => {
    setLiberalRequested(true)
  }, [])

  const userName = meQuery.data?.name ?? ""
  const userInterests = useMemo(
    () =>
      meQuery.data?.interests
        ? meQuery.data.interests.split(",").filter(Boolean)
        : [],
    [meQuery.data?.interests],
  )
  const cartItems = cartQuery.data ?? []
  const histories = historiesQuery.data ?? []

  const wishlistIds = useMemo(
    () => new Set(cartItems.map((item) => String(item.course_id))),
    [cartItems],
  )
  const cartIdMap = useMemo(
    () => new Map(cartItems.map((item) => [String(item.course_id), item.id])),
    [cartItems],
  )

  const wishlistedCourses = useMemo<Course[]>(
    () =>
      cartItems
        .filter((item) => item.course)
        .map((item) => mapApiCourse(item.course!)),
    [cartItems],
  )
  const timetableCourses = useMemo<Course[]>(
    () =>
      cartItems
        .slice()
        .sort((a, b) => a.id - b.id)
        .filter((item) => item.course)
        .map((item) => mapApiCourse(item.course!)),
    [cartItems],
  )

  const addToWishlist = async (id: string) => {
    if (!localStorage.getItem("access_token")) return
    try {
      const newItem = await cartApi.add(Number(id))
      queryClient.setQueryData<CartItem[]>(QK.cart, (prev) =>
        prev ? [...prev, newItem] : [newItem],
      )
    } catch {/* 이미 추가됨 등 */}
  }

  const removeFromWishlist = async (id: string) => {
    const cartId = cartIdMap.get(id)
    if (cartId == null) return
    try {
      await cartApi.remove(cartId)
      queryClient.setQueryData<CartItem[]>(QK.cart, (prev) =>
        prev?.filter((item) => item.id !== cartId) ?? [],
      )
    } catch {}
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    document.cookie = "access_token=; path=/; max-age=0"
    // 캐시 비움 — 다른 사용자가 로그인했을 때 이전 사용자 데이터 누수 방지
    queryClient.clear()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-xl font-semibold text-foreground tracking-tight font-logo">서간표</span>
              <span className="hidden sm:inline text-xs text-muted-foreground border-l border-border pl-2.5 ml-0.5">
                {getCurrentSemester().label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{userName || "프로필"}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
              <div className="flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5" style={{ color: "#B0232A" }} />
                <span className="text-xs font-medium text-muted-foreground">
                  {wishlistIds.size}개 저장
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-10">

          {/* Intro */}
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground text-balance">
              수강 계획 대시보드
            </h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              관심 과목을 저장하고, 강의계획서와 교수 연구 분야를 확인하세요.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Link
              href="/profile"
              className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-xs font-medium text-muted-foreground">프로필</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-sm font-medium text-foreground">{userName || "로그인 필요"}</p>
              <p className="mt-1 text-xs text-muted-foreground">프로필 설정</p>
            </Link>

            <Link
              href="/timetable"
              className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-xs font-medium text-muted-foreground">시간표</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-sm font-medium text-foreground">시간표 업로드</p>
              <p className="mt-1 text-xs text-muted-foreground">이미지 자동 인식</p>
            </Link>

            <Link
              href="/graduation"
              className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-xs font-medium text-muted-foreground">이수 현황</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {histories.reduce((sum, h) => sum + (h.course?.credits ?? 0), 0)}학점 이수
              </p>
              <p className="mt-1 text-xs text-muted-foreground">졸업 요건 확인</p>
            </Link>
            <Link
              href="/professors"
              className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-xs font-medium text-muted-foreground">교수님</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-sm font-medium text-foreground">프로필 보러가기</p>
              <p className="mt-1 text-xs text-muted-foreground">연구 분야 탐색</p>
            </Link>
          </div>

          {/* Portfolio (AI 평가) Section */}
          <Link
            href="/portfolio"
            className="group rounded-lg border border-border bg-card p-5 hover:shadow-sm transition-shadow flex items-center gap-4"
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(176, 35, 42, 0.1)" }}
            >
              <Sparkles className="h-5 w-5" style={{ color: "#B0232A" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">내 포트폴리오</h2>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "rgba(176, 35, 42, 0.1)", color: "#B0232A" }}
                >
                  AI 평가
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                교내·교외활동, 자격증, 수상내역, 프로젝트를 기록하고 AI에게 진로 평가를 받으세요.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
          </Link>

          {/* Community Board Section */}
          <section className="rounded-lg border border-border bg-muted/30 p-6">
            <h2 className="text-sm font-semibold text-foreground mb-1">내 커뮤니티 게시판</h2>
            <p className="text-xs text-muted-foreground mb-4">선택한 분야의 게시판으로 바로 이동할 수 있습니다.</p>
            {userInterests.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">관심 분야를 선택하면 게시판이 표시됩니다.</p>
                <Link
                  href="/profile"
                  className="text-xs text-muted-foreground/70 mt-1 inline-block hover:text-foreground transition-colors"
                >
                  프로필에서 설정하기 →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userInterests.map((item) => (
                  <Link
                    key={item}
                    href={`/community/${encodeURIComponent(item)}`}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    style={{ borderColor: "#B0232A", color: "#B0232A" }}
                  >
                    {item} →
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Timetable Preview */}
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">내 시간표</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                관심 과목으로 추가하면 아래 시간표에 자동으로 표시됩니다.
              </p>
            </div>
            <TimetableGrid courses={timetableCourses} />
          </section>

          {/* Wishlist Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">내 관심 과목</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {wishlistedCourses.length === 0
                    ? "아직 저장된 과목이 없습니다 - 아래에서 과목을 추가하세요."
                    : `${wishlistedCourses.length}개 과목 저장됨`}
                </p>
              </div>
            </div>

            {wishlistedCourses.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
                <BookMarked className="mx-auto h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">관심 과목 목록이 비어있습니다.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  아래 목록에서 과목을 검색하고 <strong>추가</strong> 버튼을 눌러주세요.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {wishlistedCourses.map((course) => (
                  <WishlistCard
                    key={course.id}
                    course={course}
                    onRemove={removeFromWishlist}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="border-t border-border" />

          {/* Browse Section */}
          <BrowseCourses
            majorCourses={majorCourses}
            liberalCourses={liberalCourses}
            wishlistIds={wishlistIds}
            onAdd={addToWishlist}
            onLiberalRequested={fetchLiberalIfNeeded}
            loadingDivision={loadingDivision}
          />
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            서간표 - {getCurrentSemester().label}
          </p>
        </div>
      </footer>
    </div>
  )
}
