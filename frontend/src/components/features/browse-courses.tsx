"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Plus, Check, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Course } from "@/lib/constants/course-data"

interface BrowseCoursesProps {
  courses: Course[]
  wishlistIds: Set<string>
  onAdd: (id: string) => void
}

export function BrowseCourses({ courses, wishlistIds, onAdd }: BrowseCoursesProps) {
  const [query, setQuery] = useState("")

  const filtered = courses.filter((c) => {
    const q = query.toLowerCase()
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.professor.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q)
    )
  })

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">과목 검색</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length}개 / {courses.length}개 과목
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="과목코드, 과목명, 교수명 검색..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
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
              <th className="hidden md:table-cell px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">
                구분
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((course, i) => {
                const inWishlist = wishlistIds.has(course.id)
                return (
                  <tr
                    key={course.id}
                    className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                      i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-muted-foreground tracking-wide">
                        {course.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/course/${course.id}`}
                          className="text-xs font-medium text-foreground hover:underline flex items-center gap-1 w-fit"
                          style={{ color: "#B0232A" } as React.CSSProperties}
                        >
                          {course.name}
                          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                        </Link>
                        <span className="sm:hidden text-xs text-muted-foreground">{course.professor}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span className="text-xs text-foreground whitespace-nowrap">{course.professor}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{course.schedule}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{
                          backgroundColor: course.category === "전공필수" ? "#B0232A10" : "transparent",
                          borderColor: course.category === "전공필수" ? "#B0232A40" : undefined,
                          color: course.category === "전공필수" ? "#B0232A" : undefined,
                        }}
                      >
                        {course.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {inWishlist ? (
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#B0232A" }}>
                            <Check className="h-3 w-3" />
                            추가됨
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAdd(course.id)}
                            className="h-6 px-2 text-xs gap-1 hover:bg-accent"
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
    </section>
  )
}
