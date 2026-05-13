"use client"

import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Sparkles, CheckCircle, XCircle, AlertCircle, MinusCircle, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isMajorCourse } from "@/lib/constants/course-data"

type Division = "major" | "liberal"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

type Lecture = {
  course_id: number
  course_code: string
  course_name: string
  year: number
  semester: number
  professor_name: string | null
  has_summary: boolean
  has_pdf: boolean
}

type SummarizeStats = {
  ok: number
  skip: number
  warn: number
  fail: number
  total: number
}

type JobState =
  | { type: "idle" }
  | { type: "running"; label: string }
  | { type: "done"; result: SummarizeStats }
  | { type: "error"; message: string }

type LogEntry = {
  filename: string
  status: "running" | "done" | "skip" | "warn" | "fail"
  message?: string
}

type LectureDetail = {
  course_id: number
  course_code: string
  course_name: string
  year: number
  semester: number
  professor_name: string | null
  overview: string | null
  goals: string | null
  evaluation_method: string | null
  teaching_method: string | null
  track_id: number | null
  keyword: string | null
  recommendation: string | null
  has_summary: boolean
  has_pdf_hash: boolean
}

const TRACK_NAMES: Record<number, string> = {
  1: "데이터분석", 2: "데이터관리", 3: "백엔드", 4: "프론트엔드", 5: "웹/앱",
  6: "AI", 7: "DevOps", 8: "네트워크", 9: "보안", 10: "QA",
  11: "게임", 12: "임베디드", 13: "IT컨설팅", 14: "컴퓨터교육",
}

const SEMESTERS = [
  { year: 2026, semester: 1 },
  { year: 2026, semester: 2 },
  { year: 2025, semester: 1 },
  { year: 2025, semester: 2 },
]

export default function AdminLecturesPage() {
  const router = useRouter()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [year, setYear] = useState(2026)
  const [semester, setSemester] = useState(1)
  const [job, setJob] = useState<JobState>({ type: "idle" })
  const [summaryingId, setSummaryingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("전체")
  const [division, setDivision] = useState<Division>("major")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailMap, setDetailMap] = useState<Record<number, LectureDetail>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null)

  const token = getAdminToken()

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    fetchLectures(year, semester)
  }, [])

  const fetchLectures = (y: number, s: number) => {
    setIsLoading(true)
    fetch(`${BASE_URL}/admin/lectures?year=${y}&semester=${s}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setLectures)
      .catch((e: unknown) => setJob({ type: "error", message: e instanceof Error ? e.message : "강의 목록을 불러오지 못했습니다." }))
      .finally(() => setIsLoading(false))
  }

  const onSemesterChange = (value: string) => {
    const [y, s] = value.split("-").map(Number)
    setYear(y)
    setSemester(s)
    fetchLectures(y, s)
  }

  const runSummarizeAll = async () => {
    setJob({ type: "running", label: `${year}-${semester}학기 강의계획서 요약 생성 중...` })
    setLogs([])
    setProgress(null)
    try {
      const res = await fetch(`${BASE_URL}/admin/lectures/summarize-all/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ year, semester }),
      })
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const ev = JSON.parse(line.slice(6))
          if (ev.type === "start") {
            setProgress({ current: 0, total: ev.total })
          } else if (ev.type === "progress") {
            setLogs((prev) => [...prev, { filename: ev.filename, status: "running" }])
          } else if (ev.type === "done") {
            setProgress({ current: ev.index, total: ev.total })
            setLogs((prev) => prev.map((l) => l.filename === ev.filename ? { ...l, status: "done", message: ev.message } : l))
          } else if (ev.type === "skip") {
            setProgress({ current: ev.index, total: ev.total })
            setLogs((prev) => {
              const exists = prev.some((l) => l.filename === ev.filename)
              const entry: LogEntry = { filename: ev.filename, status: "skip", message: ev.reason }
              return exists
                ? prev.map((l) => l.filename === ev.filename ? entry : l)
                : [...prev, entry]
            })
          } else if (ev.type === "warn") {
            setProgress({ current: ev.index, total: ev.total })
            setLogs((prev) => prev.map((l) => l.filename === ev.filename ? { ...l, status: "warn", message: ev.message } : l))
          } else if (ev.type === "fail") {
            setProgress({ current: ev.index, total: ev.total })
            setLogs((prev) => prev.map((l) => l.filename === ev.filename ? { ...l, status: "fail", message: ev.message } : l))
          } else if (ev.type === "complete") {
            setJob({
              type: "done",
              result: { ok: ev.ok, skip: ev.skip, warn: ev.warn, fail: ev.fail, total: ev.total },
            })
            fetchLectures(year, semester)
          }
        }
      }
    } catch (e: unknown) {
      setJob({ type: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" })
    }
  }

  const toggleExpand = async (courseId: number) => {
    if (expandedId === courseId) {
      setExpandedId(null)
      return
    }
    setExpandedId(courseId)
    // 펼칠 때마다 새로 fetch (재요약으로 변경된 내용을 즉시 반영)
    setDetailLoadingId(courseId)
    try {
      const res = await fetch(`${BASE_URL}/admin/lectures/${courseId}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      const data: LectureDetail = await res.json()
      setDetailMap((prev) => ({ ...prev, [courseId]: data }))
    } catch (e: unknown) {
      setJob({ type: "error", message: e instanceof Error ? e.message : "상세 정보를 불러오지 못했습니다." })
    } finally {
      setDetailLoadingId(null)
    }
  }

  const runSummarizeSingle = async (courseId: number) => {
    setSummaryingId(courseId)
    try {
      const res = await fetch(`${BASE_URL}/admin/lectures/${courseId}/summarize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      })
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      fetchLectures(year, semester)
      // 펼친 상태면 detail도 다시 로드
      if (expandedId === courseId) {
        setDetailMap((prev) => {
          const next = { ...prev }
          delete next[courseId]
          return next
        })
        setDetailLoadingId(courseId)
        try {
          const detailRes = await fetch(`${BASE_URL}/admin/lectures/${courseId}/detail`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (detailRes.ok) {
            const data: LectureDetail = await detailRes.json()
            setDetailMap((prev) => ({ ...prev, [courseId]: data }))
          }
        } finally {
          setDetailLoadingId(null)
        }
      }
    } catch (e: unknown) {
      setJob({ type: "error", message: e instanceof Error ? e.message : "요약 생성에 실패했습니다." })
    } finally {
      setSummaryingId(null)
    }
  }

  const summaryCount = lectures.filter((l) => l.has_summary).length
  const pdfCount = lectures.filter((l) => l.has_pdf).length

  const filtered = lectures.filter((l) => {
    const isMajor = isMajorCourse(l.course_code)
    if (division === "major" && !isMajor) return false
    if (division === "liberal" && isMajor) return false
    const matchSearch =
      search === "" ||
      l.course_code.toLowerCase().includes(search.toLowerCase()) ||
      l.course_name.includes(search) ||
      (l.professor_name && l.professor_name.includes(search))
    const matchFilter =
      filter === "전체" ? true :
      filter === "요약 미완료" ? !l.has_summary :
      filter === "PDF 있음" ? l.has_pdf :
      filter === "PDF 없음" ? !l.has_pdf :
      true
    return matchSearch && matchFilter
  })

  return (
    <div>
      {/* 헤더 + 액션 */}
      <div className="flex items-start justify-between mb-8">
        <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
          <h1 className="text-lg font-bold text-foreground">강의계획서</h1>
          <p className="mt-1 text-sm text-muted-foreground">data/syllabi/ 디렉토리의 PDF를 학기별로 일괄 요약합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchLectures(year, semester)}
            disabled={isLoading}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Button
            size="sm"
            onClick={runSummarizeAll}
            disabled={job.type === "running"}
            className="gap-1.5 h-8 text-xs text-white"
            style={{ backgroundColor: "#B0232A" }}
          >
            {job.type === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            전체 요약 생성
          </Button>
        </div>
      </div>

      {/* 통계 + 학기/검색/필터 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">전체</p>
            <p className="text-2xl font-bold text-foreground">{lectures.length}</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">PDF 있음</p>
            <p className="text-2xl font-bold text-foreground">
              {pdfCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {lectures.length}</span>
            </p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">요약 완료</p>
            <p className="text-2xl font-bold text-foreground">
              {summaryCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {pdfCount}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={`${year}-${semester}`}
            onChange={(e) => onSemesterChange(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SEMESTERS.map((s) => (
              <option key={`${s.year}-${s.semester}`} value={`${s.year}-${s.semester}`}>
                {s.year}-{s.semester}학기
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-md border border-border overflow-hidden flex-shrink-0">
            {([
              { value: "major", label: "전공" },
              { value: "liberal", label: "교양" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDivision(opt.value)}
                className={`px-3 h-8 text-xs font-medium transition-colors ${
                  division === opt.value
                    ? "text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                style={division === opt.value ? { backgroundColor: "#B0232A" } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="강의코드/명/교수"
            className="h-8 w-44 text-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="전체">전체</option>
            <option value="요약 미완료">요약 미완료</option>
            <option value="PDF 있음">PDF 있음</option>
            <option value="PDF 없음">PDF 없음</option>
          </select>
        </div>
      </div>

      {/* 작업 상태 + 실시간 로그 */}
      {job.type === "running" && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground border-b border-border">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            {job.label}
          </div>
          {progress && progress.total > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>진행률</span>
                <span>
                  {progress.current} / {progress.total}{" "}
                  ({Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    backgroundColor: "#B0232A",
                  }}
                />
              </div>
            </div>
          )}
          {logs.length > 0 && (
            <div className="px-4 py-3 space-y-1 max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {log.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0 mt-0.5" />}
                  {log.status === "done" && <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />}
                  {log.status === "skip" && <MinusCircle className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />}
                  {log.status === "warn" && <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />}
                  {log.status === "fail" && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <span className={
                      log.status === "done" ? "text-foreground" :
                      log.status === "fail" ? "text-red-500" :
                      log.status === "warn" ? "text-yellow-600" :
                      log.status === "skip" ? "text-muted-foreground" :
                      "text-muted-foreground"
                    }>{log.filename}</span>
                    {log.message && (
                      <span className="ml-2 text-muted-foreground">— {log.message}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {job.type === "done" && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" /> 요약 생성 완료
          </div>
          <div className="flex gap-4 text-muted-foreground text-xs">
            <span>성공: <strong className="text-foreground">{job.result.ok}</strong></span>
            <span>스킵: <strong className="text-foreground">{job.result.skip}</strong></span>
            <span>경고: <strong className="text-yellow-600">{job.result.warn}</strong></span>
            <span>실패: <strong className="text-red-500">{job.result.fail}</strong></span>
            <span>전체: <strong className="text-foreground">{job.result.total}</strong></span>
          </div>
        </div>
      )}

      {job.type === "error" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {job.message}
        </div>
      )}

      {/* 강의 목록 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">강의코드</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">강의명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">학기</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">교수</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">PDF</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">요약</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((l) => {
                const isExpanded = expandedId === l.course_id
                const detail = detailMap[l.course_id]
                return (
                  <Fragment key={l.course_id}>
                    <tr
                      key={l.course_id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(l.course_id)}
                    >
                      <td className="pl-3 pr-1">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{l.course_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{l.course_name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">#{l.course_id}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {l.year}-{l.semester}
                      </td>
                      <td className="px-4 py-3 text-xs">{l.professor_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {l.has_pdf
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3">
                        {l.has_summary
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {l.has_pdf && (
                          <button
                            onClick={() => runSummarizeSingle(l.course_id)}
                            disabled={summaryingId === l.course_id || job.type === "running"}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                          >
                            {summaryingId === l.course_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Sparkles className="h-3.5 w-3.5" />}
                            {l.has_summary ? "재요약" : "요약"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${l.course_id}-detail`} className="bg-muted/20">
                        <td colSpan={8} className="px-6 py-4">
                          {detailLoadingId === l.course_id && !detail ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중...
                            </div>
                          ) : detail ? (
                            <div className="space-y-3 text-xs">
                              <DetailField label="강의 개요 (overview)" value={detail.overview} />
                              <DetailField label="목표 (goals)" value={detail.goals} />
                              <DetailField label="평가 방식" value={detail.evaluation_method} />
                              <DetailField label="수업 방식" value={detail.teaching_method} />
                              <DetailField
                                label="트랙"
                                value={detail.track_id ? `${detail.track_id}: ${TRACK_NAMES[detail.track_id] ?? "-"}` : null}
                              />
                              <DetailField label="키워드" value={detail.keyword} />
                              <DetailField label="AI 추천 (recommendation)" value={detail.recommendation} />
                              <div className="text-muted-foreground pt-1 border-t border-border">
                                hash 저장: {detail.has_pdf_hash ? "✓" : "✗"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">데이터를 불러올 수 없습니다.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {lectures.length === 0 ? "강의 데이터가 없습니다." : "검색 결과가 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="text-muted-foreground font-medium">{label}</div>
      <div className="text-foreground whitespace-pre-wrap break-words">
        {value && value.trim() ? value : <span className="text-muted-foreground italic">(없음)</span>}
      </div>
    </div>
  )
}
