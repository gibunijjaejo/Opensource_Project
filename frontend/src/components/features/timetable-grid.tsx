"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import type { Course } from "@/lib/constants/course-data"

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const
const START_HOUR = 9
const END_HOUR = 21
const ROW_HEIGHT_DESKTOP = 40
const ROW_HEIGHT_MOBILE = 32
const HOUR_COL_WIDTH_DESKTOP = 40
const HOUR_COL_WIDTH_MOBILE = 24

const PALETTE = [
  { bg: "#F8B4B4", fg: "#7A1F1F" }, // pink/red
  { bg: "#B5E2B5", fg: "#1F5A1F" }, // green
  { bg: "#A8E0D5", fg: "#1F5C50" }, // teal
  { bg: "#F4D79A", fg: "#7A551F" }, // amber
  { bg: "#F9C18A", fg: "#8A4B1F" }, // orange
  { bg: "#A9C8F0", fg: "#1F4280" }, // blue
  { bg: "#C7B8E8", fg: "#3F2A7A" }, // purple
  { bg: "#F4A8C8", fg: "#7A1F4F" }, // magenta
]

function pickColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function parseTime(t?: string | null): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
}

function parseDays(days?: string | null): number[] {
  if (!days) return []
  const out: number[] = []
  for (const ch of days) {
    const idx = DAYS.indexOf(ch as (typeof DAYS)[number])
    if (idx >= 0 && !out.includes(idx)) out.push(idx)
  }
  return out
}

type Block = {
  course: Course
  dayIdx: number
  startH: number
  endH: number
}

function buildBlocks(courses: Course[]): Block[] {
  const blocks: Block[] = []
  for (const c of courses) {
    const startH = parseTime(c.startTime)
    const endH = parseTime(c.endTime)
    const dayIdxs = parseDays(c.days)
    if (startH == null || endH == null || endH <= startH || dayIdxs.length === 0) continue
    for (const d of dayIdxs) {
      blocks.push({ course: c, dayIdx: d, startH, endH })
    }
  }
  return blocks
}

interface TimetableGridProps {
  courses: Course[]
  /** 옵셔널 — 주어지면 블록 클릭 시 ✕ 버튼이 나타나 제거 가능. 비교 모달 등에선 미전달. */
  onRemoveCourse?: (courseId: string) => void
}

export function TimetableGrid({ courses, onRemoveCourse }: TimetableGridProps) {
  const blocks = buildBlocks(courses)
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // 모바일 감지 — 작은 화면에선 행 높이/시간 컬럼 폭 축소 + 강의 없는 토/일 자동 숨김
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // 모바일이고 토/일 강의 없으면 평일만 노출 (좁은 화면 공간 활용)
  const hasWeekendCourse = blocks.some((b) => b.dayIdx >= 5)
  const visibleDays = isMobile && !hasWeekendCourse ? DAYS.slice(0, 5) : DAYS

  const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP
  const hourColWidth = isMobile ? HOUR_COL_WIDTH_MOBILE : HOUR_COL_WIDTH_DESKTOP
  const gridHeight = (END_HOUR - START_HOUR) * rowHeight
  const gridTemplate = `${hourColWidth}px repeat(${visibleDays.length}, minmax(0, 1fr))`

  // 강의 목록이 바뀌면 선택 상태 초기화 (제거 후 다른 강의가 선택된 채로 남지 않게)
  useEffect(() => {
    setSelectedCourseId(null)
  }, [courses.length])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Day header */}
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div />
        {visibleDays.map((d) => (
          <div
            key={d}
            className="py-1.5 sm:py-2 text-center text-[11px] sm:text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: gridTemplate,
          height: gridHeight,
        }}
      >
        {/* Hour labels column */}
        <div className="relative border-r border-border bg-muted/20">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 text-[9px] sm:text-[10px] text-muted-foreground text-center pt-0.5"
              style={{ top: i * rowHeight, height: rowHeight }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Day columns with hour grid lines */}
        {visibleDays.map((d, di) => (
          <div key={d} className="relative border-r border-border last:border-r-0">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-b border-border/60"
                style={{ top: i * rowHeight, height: rowHeight }}
              />
            ))}
            {blocks
              .filter((b) => b.dayIdx === di)
              .map((b) => {
                const top = (b.startH - START_HOUR) * rowHeight
                const height = (b.endH - b.startH) * rowHeight
                const color = pickColor(b.course.id)
                const isSelected = selectedCourseId === b.course.id
                const canRemove = !!onRemoveCourse
                return (
                  <div
                    key={`${b.course.id}-${b.dayIdx}`}
                    onClick={() => {
                      if (!canRemove) return
                      setSelectedCourseId(isSelected ? null : b.course.id)
                    }}
                    className={`absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded-md px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] leading-tight overflow-hidden transition-all ${
                      canRemove ? "cursor-pointer" : ""
                    } ${isSelected ? "ring-2 ring-offset-1" : ""}`}
                    style={{
                      top,
                      height,
                      backgroundColor: color.bg,
                      color: color.fg,
                      ...(isSelected ? { boxShadow: "0 0 0 2px #B0232A" } : {}),
                    }}
                    title={`${b.course.name} (${b.course.code})${canRemove ? " — 클릭해서 제거" : ""}`}
                  >
                    <div className="font-semibold break-words [overflow-wrap:anywhere]">
                      {b.course.name}
                    </div>
                    <div className="break-words opacity-80 [overflow-wrap:anywhere] hidden sm:block">
                      {b.course.code}
                    </div>

                    {/* 클릭 시 ✕ 제거 버튼 오버레이 */}
                    {isSelected && onRemoveCourse && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveCourse(b.course.id)
                          setSelectedCourseId(null)
                        }}
                        className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded bg-white/95 px-1.5 py-1 text-[10px] font-semibold shadow-sm hover:bg-white"
                        style={{ color: "#B0232A" }}
                      >
                        <X className="h-3 w-3" />
                        제거
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
