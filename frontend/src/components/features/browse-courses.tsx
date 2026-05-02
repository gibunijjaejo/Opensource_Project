"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Search, Plus, Check, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Course } from "@/lib/constants/course-data"

interface BrowseCoursesProps {
  courses: Course[]
  wishlistIds: Set<string>
  onAdd: (id: string) => void
  isLoadingAll?: boolean
}

export function BrowseCourses({ courses, wishlistIds, onAdd, isLoadingAll = false }: BrowseCoursesProps) {
  const [query, setQuery] = useState("")
  const [confirmedQuery, setConfirmedQuery] = useState("")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const tableRef = useRef<HTMLDivElement>(null)

  const filtered = courses.filter((c) => {
    const q = confirmedQuery.toLowerCase()
    if (!q) return true
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.professor.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = () => {
    setConfirmedQuery(query)
    setPage(1)
    tableRef.current?.scrollTo({ top: 0 })
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">26학년도 1학기 과목검색</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length}개 / {courses.length}개 과목
            {isLoadingAll && <span className="ml-1.5 text-muted-foreground/50">전체 로딩 중...</span>}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="과목코드, 과목명, 교수명 검색..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="h-8 px-3 text-xs flex-shrink-0"
            style={{ backgroundColor: "#B0232A" }}
            onClick={handleSearch}
          >
            검색
          </Button>
        </div>
      </div>

      <div ref={tableRef} className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">
                코드
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                과목명
              </th>
              <th className="hidden sm:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                교수
              </th>
              <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">
                시간
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">

              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              paginated.map((course, i) => {
                const inWishlist = wishlistIds.has(course.id)
                return (
                  <tr
                    key={`${course.id}-${i}`}
                    className={`h-12 border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                      i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-0">
                      <span className="font-mono text-xs font-medium text-muted-foreground tracking-wide whitespace-nowrap">
                        {course.code}
                      </span>
                    </td>
                    <td className="px-4 py-0 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/course/${course.id}`}
                          className="text-xs font-medium hover:underline flex items-center gap-1 min-w-0"
                          style={{ color: "#B0232A" } as React.CSSProperties}
                        >
                          <span className="truncate">{course.name}</span>
                          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                        </Link>
                        <span className="sm:hidden text-xs text-muted-foreground truncate flex-shrink-0">
                          · {course.professor}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-0">
                      <span className="text-xs text-foreground whitespace-nowrap truncate block">
                        {course.professor}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap truncate block">
                        {course.schedule}
                      </span>
                    </td>
                    <td className="px-4 py-0">
                      <div className="flex items-center justify-end gap-1.5">
                        {inWishlist ? (
                          <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap" style={{ color: "#B0232A" }}>
                            <Check className="h-3 w-3" />
                            추가됨
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAdd(course.id)}
                            className="h-6 px-2 text-xs gap-1 hover:bg-accent whitespace-nowrap"
                            style={{ color: "#B0232A", borderColor: "#B0232A" } as React.CSSProperties}
                          >
                            <Plus className="h-3 w-3" />
                            추가
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            이전
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === page ? "default" : "outline"}
              className="h-7 w-7 p-0 text-xs"
              style={p === page ? { backgroundColor: "#B0232A" } : {}}
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            다음
          </Button>
        </div>
      )}
    </section>
  )
}
