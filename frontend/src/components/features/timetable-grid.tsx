"use client"

import type { Course } from "@/lib/constants/course-data"

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const
const START_HOUR = 9
const END_HOUR = 21
const ROW_HEIGHT = 56

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

export function TimetableGrid({ courses }: { courses: Course[] }) {
  const blocks = buildBlocks(courses)
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const gridHeight = (END_HOUR - START_HOUR) * ROW_HEIGHT

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Day header */}
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: `40px repeat(${DAYS.length}, minmax(0, 1fr))` }}
      >
        <div />
        {DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: `40px repeat(${DAYS.length}, minmax(0, 1fr))`,
          height: gridHeight,
        }}
      >
        {/* Hour labels column */}
        <div className="relative border-r border-border bg-muted/20">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 text-[10px] text-muted-foreground text-center pt-0.5"
              style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Day columns with hour grid lines */}
        {DAYS.map((d, di) => (
          <div key={d} className="relative border-r border-border last:border-r-0">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-b border-border/60"
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}
            {blocks
              .filter((b) => b.dayIdx === di)
              .map((b) => {
                const top = (b.startH - START_HOUR) * ROW_HEIGHT
                const height = (b.endH - b.startH) * ROW_HEIGHT
                const color = pickColor(b.course.id)
                return (
                  <div
                    key={`${b.course.id}-${b.dayIdx}`}
                    className="absolute left-1 right-1 rounded-md px-1.5 py-1 text-[11px] leading-tight overflow-hidden"
                    style={{
                      top,
                      height,
                      backgroundColor: color.bg,
                      color: color.fg,
                    }}
                    title={`${b.course.name} (${b.course.code})`}
                  >
                    <div className="font-semibold break-words [overflow-wrap:anywhere]">
                      {b.course.name}
                    </div>
                    <div className="break-words opacity-80 [overflow-wrap:anywhere]">
                      {b.course.code}
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
