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
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              대시보드
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link href="/" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground">서간표</span>
            </Link>
          </div>
          <ThemeToggle />
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
                className="group relative rounded-lg border border-border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                style={{ aspectRatio: "3 / 4" }}
              >
                {/* 상단 빨간 밴드 + 아바타 */}
                <div
                  className="relative flex-shrink-0"
                  style={{ height: "55%", backgroundColor: "#B0232A" }}
                >
                  {/* 아바타 (빨간 영역 안에 완전히 포함) */}
                  <div
                    className="absolute left-1/2 top-1/2 flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-md"
                    style={{ width: "62%" }}
                  >
                    <UserCircle
                      className="text-muted-foreground/80"
                      style={{ width: "82%", height: "82%" }}
                      strokeWidth={1.25}
                    />
                  </div>
                </div>

                {/* 하단 흰색 영역 */}
                <div className="flex flex-1 flex-col px-3 pt-3 pb-2 min-h-0">
                  {/* 이름 */}
                  <p className="text-base font-semibold text-foreground truncate text-center">
                    {prof.name}
                  </p>

                  {/* 빨간 바 + 전공 */}
                  <div className="mt-2 flex items-stretch gap-1.5 self-center max-w-full">
                    <span
                      className="w-0.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: "#B0232A" }}
                    />
                    <p
                      className="min-w-0 text-sm text-muted-foreground line-clamp-3 leading-snug text-left"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {prof.details?.specialty ?? "세부전공 정보 없음"}
                    </p>
                  </div>

                  {/* 브랜드 */}
                  <p
                    className="mt-auto text-center text-[10px] font-bold tracking-[0.2em]"
                    style={{ color: "#B0232A" }}
                  >
                    sogang
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
