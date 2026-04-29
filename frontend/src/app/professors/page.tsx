"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  UserCircle,
} from "lucide-react"
import { professorsApi } from "@/lib/api"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import type { Professor } from "@/types"

export default function ProfessorsPage() {
  const router = useRouter()
  const [professors, setProfessors] = useState<Professor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
      return
    }
    professorsApi
      .list()
      .then(setProfessors)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Link
              href="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">서간표</span>
            </Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* 페이지 제목 */}
        <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
          <h1 className="text-lg font-bold text-foreground">교수님 프로필</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            컴퓨터공학과 교수님들의 연구 분야와 연락처를 확인하세요.
          </p>
        </div>

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card overflow-hidden flex flex-col"
                style={{ aspectRatio: "3 / 4" }}
              >
                <div className="relative flex items-center justify-center bg-muted/60" style={{ height: "55%" }}>
                  <Skeleton className="aspect-square rounded-full" style={{ width: "62%" }} />
                </div>
                <div className="flex-1 flex flex-col px-3 pt-3 gap-2">
                  <Skeleton className="h-5 w-20 self-center" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 교수 카드 그리드 */}
        {!isLoading && professors.length === 0 && (
          <p className="text-sm text-muted-foreground">등록된 교수 정보가 없습니다.</p>
        )}

        {!isLoading && professors.length > 0 && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {professors.map((prof) => (
              <Link
                key={prof.professor_id}
                href={`/professors/${prof.professor_id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card hover:shadow-lg transition-shadow"
                style={{ aspectRatio: "3 / 4" }}
              >
                {/* 상단 헤더 */}
                <div
                  className="flex flex-shrink-0 items-center gap-1.5 px-2 py-1.5"
                  style={{ backgroundColor: "#B1000E" }}
                >
                  <svg width="15" height="17" viewBox="0 0 28 32" fill="none">
                    <path
                      d="M14 1L1 6V17C1 24 6.5 30 14 32C21.5 30 27 24 27 17V6L14 1Z"
                      fill="rgba(255,255,255,0.15)"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <text x="14" y="21" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Georgia, serif">IHS</text>
                  </svg>
                  <div className="flex flex-col leading-none">
                    <span className="font-bold text-white" style={{ fontSize: 7, letterSpacing: "0.2em" }}>SOGANG</span>
                    <span className="text-white/80" style={{ fontSize: 5.5, letterSpacing: "0.25em" }}>UNIVERSITY</span>
                  </div>
                </div>

                {/* 사진 영역 */}
                <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white">
                  {/* 건물 배경 SVG */}
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 120 130"
                    preserveAspectRatio="xMidYMid slice"
                    style={{ opacity: 0.07 }}
                  >
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

                  {/* 사진 플레이스홀더 */}
                  <div
                    className="relative z-10 flex items-center justify-center border border-gray-300 bg-gray-100"
                    style={{ width: "50%", aspectRatio: "3 / 4" }}
                  >
                    <UserCircle
                      className="text-gray-400"
                      style={{ width: "76%", height: "76%" }}
                      strokeWidth={1.2}
                    />
                  </div>
                </div>

                {/* 이름 */}
                <div className="flex-shrink-0 border-t border-gray-100 bg-white px-2 py-2 text-center dark:border-gray-700 dark:bg-card">
                  <p className="truncate font-bold text-gray-800 dark:text-foreground" style={{ fontSize: 13, letterSpacing: "0.2em" }}>
                    {prof.name}
                  </p>
                  <p className="mt-0.5 truncate text-gray-400" style={{ fontSize: 9 }}>
                    {prof.details?.specialty ?? "컴퓨터공학과"}
                  </p>
                </div>

                {/* 하단 */}
                <div className="flex-shrink-0 py-1 text-center" style={{ backgroundColor: "#B1000E" }}>
                  <span className="font-medium text-white" style={{ fontSize: 7, letterSpacing: "0.22em" }}>SOGANG UNIVERSITY</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
