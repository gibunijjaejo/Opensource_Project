"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BookOpen, BookMarked, User, Upload, ChevronRight, Settings, GraduationCap, LogOut } from "lucide-react"
import { WishlistCard } from "@/components/features/wishlist-card"
import { BrowseCourses } from "@/components/features/browse-courses"
import type { Course } from "@/lib/constants/course-data"
import { coursesApi, cartApi, usersApi, historyApi } from "@/lib/api"
import type { Course as ApiCourse, CartItem, HistoryItem } from "@/types"

// API 응답 → 컴포넌트가 기대하는 Course 타입으로 변환
function mapApiCourse(c: ApiCourse): Course {
  const categoryMap: Record<string, Course["category"]> = {
    전공필수: "전공필수",
    전공선택: "전공선택",
    교양: "교양",
    일반선택: "일반선택",
  }
  return {
    id: c.course_code,
    code: c.course_code,
    name: c.course_name,
    professor: c.professor?.name ?? "-",
    department: c.course_category ?? "",
    schedule: [c.class_days, c.class_start_time, c.class_end_time]
      .filter(Boolean)
      .join(" "),
    category: categoryMap[c.course_category ?? ""] ?? "일반선택",
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [userName, setUserName] = useState<string>("")
  const [histories, setHistories] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
      return
    }

    coursesApi.list()
      .then((data) => setCourses(data.map(mapApiCourse)))
      .catch(() => {})
      .finally(() => setIsLoading(false))

    usersApi.me()
      .then((u) => setUserName(u.name))
      .catch(() => {})
    cartApi.get()
      .then(setCartItems)
      .catch(() => {})
    historyApi.getMyHistories()
      .then(setHistories)
      .catch(() => {})
  }, [router])

  const wishlistIds = new Set(
    cartItems.map((item) => item.course?.course_code ?? String(item.course_id))
  )
  // cartId 역조회용 맵 (courseCode → cartItemId)
  const cartIdMap = new Map(
    cartItems.map((item) => [
      item.course?.course_code ?? String(item.course_id),
      item.id,
    ])
  )

  const wishlistedCourses = courses.filter((c) => wishlistIds.has(c.id))

  const addToWishlist = async (id: string) => {
    const apiCourse = courses.find((c) => c.id === id)
    if (!apiCourse) return
    const token = localStorage.getItem("access_token")
    if (!token) return
    try {
      const fullCourseList = await coursesApi.list()
      const found = fullCourseList.find((c) => c.course_code === id)
      if (!found) return
      const newItem = await cartApi.add(found.course_id)
      setCartItems((prev) => [...prev, newItem])
    } catch {/* 이미 추가됨 등 */}
  }

  const removeFromWishlist = async (id: string) => {
    const cartId = cartIdMap.get(id)
    if (cartId == null) return
    try {
      await cartApi.remove(cartId)
      setCartItems((prev) => prev.filter((item) => item.id !== cartId))
    } catch {}
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">CourseScope</span>
              <span className="hidden sm:inline text-xs text-muted-foreground font-mono border-l border-border pl-2.5 ml-0.5">
                2026년 1학기
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
          <div className="grid gap-3 sm:grid-cols-3">
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
          </div>

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
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">강의 목록 로딩 중...</p>
          ) : (
            <BrowseCourses
              courses={courses}
              wishlistIds={wishlistIds}
              onAdd={addToWishlist}
            />
          )}
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            CourseScope - 2026년 1학기
          </p>
        </div>
      </footer>
    </div>
  )
}
