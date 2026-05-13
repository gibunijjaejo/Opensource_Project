import type { HistoryItem } from "@/types"

// 학사 일정 순서: 1학기(봄) → 하계(3) → 2학기(가을) → 동계(4)
const SEMESTER_RANK: Record<number, number> = { 1: 0, 3: 1, 2: 2, 4: 3 }

export function chronoKey(year: number | null, semester: number | null): number {
  const yr = year ?? 0
  const sem = semester == null ? 99 : SEMESTER_RANK[semester] ?? semester
  return yr * 4 + sem
}

/**
 * 같은 (학생, course_code) 그룹에서 시간순 가장 최근 row 한 개만 남긴다.
 * 재수강은 학점 합산에 중복 카운트되지 않도록 dedup 하는 용도.
 */
export function dedupHistoriesByCode(histories: HistoryItem[]): HistoryItem[] {
  const latest = new Map<string, HistoryItem>()
  for (const h of histories) {
    const prev = latest.get(h.course_code)
    if (!prev || chronoKey(h.year, h.semester) > chronoKey(prev.year, prev.semester)) {
      latest.set(h.course_code, h)
    }
  }
  return Array.from(latest.values())
}

/**
 * 졸업요건 페이지와 동일한 규칙으로 총 이수 학점을 계산한다.
 * - 같은 과목코드는 1번만 카운트 (재수강 제외)
 * - 학점은 그룹의 최신 row 의 `course.credits` 우선, 없으면 3 폴백
 */
export function totalCreditsFor(histories: HistoryItem[]): number {
  return dedupHistoriesByCode(histories).reduce(
    (sum, h) => sum + (h.course?.credits ?? 3),
    0,
  )
}
