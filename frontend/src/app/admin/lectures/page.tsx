"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Sparkles, CheckCircle, XCircle, AlertCircle, MinusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  const [logs, setLogs] = useState<LogEntry[]>([])

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
      .catch(console.error)
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
            // 시작 — UI에 total 표시 등 (CP4에서 progress bar 추가 예정)
          } else if (ev.type === "progress") {
            setLogs((prev) => [...prev, { filename: ev.filename, status: "running" }])
          } else if (ev.type === "done") {
            setLogs((prev) => prev.map((l) => l.filename === ev.filename ? { ...l, status: "done", message: ev.message } : l))
          } else if (ev.type === "skip") {
            setLogs((prev) => {
              const exists = prev.some((l) => l.filename === ev.filename)
              const entry: LogEntry = { filename: ev.filename, status: "skip", message: ev.reason }
              return exists
                ? prev.map((l) => l.filename === ev.filename ? entry : l)
                : [...prev, entry]
            })
          } else if (ev.type === "warn") {
            setLogs((prev) => prev.map((l) => l.filename === ev.filename ? { ...l, status: "warn", message: ev.message } : l))
          } else if (ev.type === "fail") {
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
    } catch (e) {
      console.error(e)
    } finally {
      setSummaryingId(null)
    }
  }

  const summaryCount = lectures.filter((l) => l.has_summary).length
  const pdfCount = lectures.filter((l) => l.has_pdf).length

  const filtered = lectures.filter((l) => {
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
              {filtered.map((l) => (
                <tr key={l.course_id} className="hover:bg-muted/30 transition-colors">
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
                  <td className="px-4 py-3 text-right">
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
