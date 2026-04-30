"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, BookOpen, UserCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { professorsApi } from "@/lib/api"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import type { Professor } from "@/types"

const CARD_WIDTH = 170
const SPACING = 148

// Next.js 16: useSearchParams는 반드시 Suspense boundary 안에서 사용해야 빌드 통과
export default function ProfessorsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfessorsContent />
    </Suspense>
  )
}

function ProfessorsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // URL ?index=N 으로 carousel 위치 보존 — 상세 페이지에서 router.back() 시 복원용
  const initialIndex = Math.max(0, Number(searchParams.get("index") ?? 0) || 0)
  const [professors, setProfessors] = useState<Professor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) { router.replace("/login"); return }
    professorsApi.list()
      .then(setProfessors)
      .catch((err) => console.error("교수 목록 오류:", err))
      .finally(() => setIsLoading(false))
  }, [router])

  // 데이터 로드 후 잘못된 index(범위 초과) 방어
  useEffect(() => {
    if (professors.length > 0 && activeIndex >= professors.length) {
      setActiveIndex(0)
    }
  }, [professors.length, activeIndex])

  // activeIndex 변경 시마다 URL 동기화 (history entry는 추가 안 함)
  // → 상세 페이지로 push 직후 router.back() 시 carousel 위치 그대로 복원됨
  useEffect(() => {
    if (typeof window === "undefined" || professors.length === 0) return
    const currentParam = new URLSearchParams(window.location.search).get("index")
    if (currentParam !== String(activeIndex)) {
      window.history.replaceState(
        window.history.state,
        "",
        `/professors?index=${activeIndex}`,
      )
    }
  }, [activeIndex, professors.length])

  const prev = () => setActiveIndex((i) => Math.max(0, i - 1))
  const next = () => setActiveIndex((i) => Math.min(professors.length - 1, i + 1))

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    touchStartX.current = null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-14 items-center relative">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>이전</span>
            </button>
            <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">서간표</span>
            </Link>
            <div className="ml-auto"><ThemeToggle /></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
          <h1 className="text-lg font-bold text-foreground">교수님 프로필</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            카드를 클릭하거나 좌우로 넘겨 교수님을 확인하세요.
          </p>
        </div>

        {/* 학과 섹션 레이블 */}
        {!isLoading && professors.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: "#B1000E" }}
            >
              컴퓨터공학과
            </span>
            <span className="text-xs text-muted-foreground">교수 {professors.length}명</span>
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="flex items-end justify-center gap-3 h-72">
            {[0.58, 0.76, 1, 0.76, 0.58].map((s, i) => (
              <Skeleton key={i} className="rounded-xl flex-shrink-0"
                style={{ width: CARD_WIDTH * s, height: CARD_WIDTH * s * (4 / 3), opacity: s }} />
            ))}
          </div>
        )}

        {!isLoading && professors.length === 0 && (
          <p className="text-sm text-muted-foreground">등록된 교수 정보가 없습니다.</p>
        )}

        {!isLoading && professors.length > 0 && (
          <div className="flex flex-col items-center gap-5">
            {/* 캐러셀 */}
            <div
              className="relative w-full overflow-hidden select-none"
              style={{ height: 300 }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {professors.map((prof, index) => {
                const offset = index - activeIndex
                const abs = Math.abs(offset)
                if (abs > 2) return null

                const scale = abs === 0 ? 1 : abs === 1 ? 0.76 : 0.58
                const opacity = abs === 0 ? 1 : abs === 1 ? 0.68 : 0.4
                const zIndex = 20 - abs * 5
                const translateX = offset * SPACING

                return (
                  <div
                    key={prof.professor_id}
                    onClick={() => offset !== 0 ? setActiveIndex(index) : router.push(`/professors/${prof.professor_id}`)}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: CARD_WIDTH,
                      transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale})`,
                      opacity,
                      zIndex,
                      transition: "all 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col"
                      style={{
                        aspectRatio: "3/4",
                        boxShadow: abs === 0 ? "0 12px 40px rgba(0,0,0,0.22)" : "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      {/* 헤더 */}
                      <div className="flex flex-shrink-0 items-center gap-1.5 px-2.5 py-2" style={{ backgroundColor: "#B1000E" }}>
                        <svg width="15" height="17" viewBox="0 0 28 32" fill="none">
                          <path d="M14 1L1 6V17C1 24 6.5 30 14 32C21.5 30 27 24 27 17V6L14 1Z"
                            fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" />
                          <text x="14" y="21" textAnchor="middle" fill="white" fontSize="8.5"
                            fontWeight="bold" fontFamily="Georgia, serif">IHS</text>
                        </svg>
                        <div className="leading-none">
                          <p className="font-bold text-white" style={{ fontSize: 7, letterSpacing: "0.2em" }}>SOGANG</p>
                          <p className="text-white/80" style={{ fontSize: 5.5, letterSpacing: "0.25em" }}>UNIVERSITY</p>
                        </div>
                      </div>

                      {/* 사진 */}
                      <div className="relative flex flex-1 items-center justify-center bg-white overflow-hidden">
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 130"
                          preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.07 }}>
                          <rect x="25" y="5" width="70" height="125" fill="none" stroke="#B1000E" strokeWidth="2" />
                          <rect x="35" y="13" width="18" height="24" fill="none" stroke="#B1000E" strokeWidth="1.2" />
                          <rect x="67" y="13" width="18" height="24" fill="none" stroke="#B1000E" strokeWidth="1.2" />
                          <rect x="30" y="44" width="60" height="86" fill="none" stroke="#B1000E" strokeWidth="1.2" />
                          <line x1="60" y1="44" x2="60" y2="130" stroke="#B1000E" strokeWidth="0.8" />
                          <rect x="38" y="57" width="13" height="16" fill="#B1000E" />
                          <rect x="69" y="57" width="13" height="16" fill="#B1000E" />
                          <polygon points="60,0 52,5 68,5" fill="none" stroke="#B1000E" strokeWidth="1.2" />
                          <line x1="25" y1="44" x2="95" y2="44" stroke="#B1000E" strokeWidth="0.8" />
                        </svg>
                        <div className="relative z-10 flex items-center justify-center border border-gray-300 bg-gray-100"
                          style={{ width: "50%", aspectRatio: "3/4" }}>
                          <UserCircle className="text-gray-400" style={{ width: "76%", height: "76%" }} strokeWidth={1.2} />
                        </div>
                      </div>

                      {/* 이름 */}
                      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-2 py-2 text-center dark:border-gray-700 dark:bg-card">
                        <p className="truncate font-bold text-gray-800 dark:text-foreground"
                          style={{ fontSize: 12, letterSpacing: "0.2em" }}>
                          {prof.name}
                        </p>
                        <p className="mt-0.5 truncate text-gray-400" style={{ fontSize: 8.5 }}>
                          {prof.details?.specialty ?? "컴퓨터공학과"}
                        </p>
                      </div>

                      {/* 하단 */}
                      <div className="flex-shrink-0 py-1 text-center" style={{ backgroundColor: "#B1000E" }}>
                        <span className="font-medium text-white" style={{ fontSize: 6.5, letterSpacing: "0.22em" }}>
                          SOGANG UNIVERSITY
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 현재 교수 이름 */}
            <p className="text-sm font-semibold text-foreground h-5 transition-all">
              {professors[activeIndex]?.name} 교수
            </p>

            {/* PREV / NEXT */}
            <div className="flex items-center gap-4">
              <button
                onClick={prev}
                disabled={activeIndex === 0}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> PREV
              </button>
              <span className="text-xs text-muted-foreground tabular-nums w-14 text-center">
                {activeIndex + 1} / {professors.length}
              </span>
              <button
                onClick={next}
                disabled={activeIndex === professors.length - 1}
                className="flex items-center gap-1 rounded-md px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
                style={{ backgroundColor: "#B1000E" }}
              >
                NEXT <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 점 인디케이터 */}
            <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
              {professors.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === activeIndex ? 20 : 6,
                    height: 6,
                    backgroundColor: i === activeIndex ? "#B1000E" : "#D1D5DB",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
