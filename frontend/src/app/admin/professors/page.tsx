"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Download, Sparkles, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

type Professor = {
  professor_id: number
  name: string
  has_detail: boolean
  has_research_area: boolean
  has_summary: boolean
  research_summary: string | null
}

type CrawlResult = {
  updated_count: number
  not_found_count: number
  db_only_count: number
  updated: { web_name: string; db_name: string; match_type: string; crawl_error: string | null }[]
  not_found_in_db: { web_name: string }[]
}

type SummarizeResult = {
  updated_count: number
  results: { professor_id: number; name: string }[]
}

type JobState =
  | { type: "idle" }
  | { type: "running"; label: string }
  | { type: "done-crawl"; result: CrawlResult }
  | { type: "done-summarize"; result: SummarizeResult }
  | { type: "error"; message: string }

export default function AdminProfessorsPage() {
  const router = useRouter()
  const [professors, setProfessors] = useState<Professor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [job, setJob] = useState<JobState>({ type: "idle" })
  const [summaryingId, setSummaryingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("전체")
  const [logs, setLogs] = useState<{ name: string; status: "running" | "done" | "fail" }[]>([])

  const token = getAdminToken()

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    fetchProfessors()
  }, [])

  const fetchProfessors = () => {
    setIsLoading(true)
    fetch(`${BASE_URL}/admin/professors`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setProfessors)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  const runCrawl = async () => {
    setJob({ type: "running", label: "서강대 CS 교수 페이지 크롤링 중..." })
    try {
      const res = await fetch(`${BASE_URL}/admin/crawl/professors`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      const data: CrawlResult = await res.json()
      setJob({ type: "done-crawl", result: data })
      fetchProfessors()
    } catch (e: unknown) {
      setJob({ type: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" })
    }
  }

  const runSummarizeAll = async () => {
    setJob({ type: "running", label: "전체 교수 강의 요약 생성 중..." })
    setLogs([])
    try {
      const res = await fetch(`${BASE_URL}/admin/professors/summarize-all/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
          if (ev.type === "progress") {
            setLogs((prev) => [...prev, { name: ev.name, status: "running" }])
          } else if (ev.type === "done") {
            setLogs((prev) => prev.map((l) => l.name === ev.name ? { ...l, status: "done" } : l))
          } else if (ev.type === "fail") {
            setLogs((prev) => prev.map((l) => l.name === ev.name ? { ...l, status: "fail" } : l))
          } else if (ev.type === "complete") {
            setJob({ type: "done-summarize", result: { updated_count: ev.updated_count, results: [] } })
            setLogs([])
            fetchProfessors()
          }
        }
      }
    } catch (e: unknown) {
      setJob({ type: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" })
    }
  }

  const runSummarizeSingle = async (professorId: number) => {
    setSummaryingId(professorId)
    try {
      const res = await fetch(`${BASE_URL}/admin/professors/${professorId}/summarize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
      fetchProfessors()
    } catch (e) {
      console.error(e)
    } finally {
      setSummaryingId(null)
    }
  }

  const summaryCount = professors.filter((p) => p.has_summary).length
  const researchCount = professors.filter((p) => p.has_research_area).length

  const filtered = professors.filter((p) => {
    const matchSearch = search === "" || p.name.includes(search) || String(p.professor_id).includes(search)
    const matchFilter =
      filter === "전체" ? true :
      filter === "요약 미완료" ? !p.has_summary :
      filter === "연구분야 없음" ? !p.has_research_area :
      filter === "상세정보 없음" ? !p.has_detail :
      true
    return matchSearch && matchFilter
  })

  return (
    <div>
      {/* 헤더 + 액션 버튼 */}
      <div className="flex items-start justify-between mb-8">
        <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
          <h1 className="text-lg font-bold text-foreground">교수 데이터</h1>
          <p className="mt-1 text-sm text-muted-foreground">교수 정보 크롤링 및 강의 요약을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchProfessors} disabled={isLoading} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Button size="sm" variant="outline" onClick={runCrawl} disabled={job.type === "running"} className="gap-1.5 h-8 text-xs">
            {job.type === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            크롤링
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

      {/* 통계 + 검색/필터 한 줄 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">전체</p>
            <p className="text-2xl font-bold text-foreground">{professors.length}</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">연구분야</p>
            <p className="text-2xl font-bold text-foreground">
              {researchCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {professors.length}</span>
            </p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">요약 완료</p>
            <p className="text-2xl font-bold text-foreground">
              {summaryCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {researchCount}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 ID"
            className="h-8 w-40 text-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="전체">전체</option>
            <option value="요약 미완료">요약 미완료</option>
            <option value="연구분야 없음">연구분야 없음</option>
            <option value="상세정보 없음">상세정보 없음</option>
          </select>
        </div>
      </div>

      {/* 작업 상태 + 실시간 로그 */}
      {job.type === "running" && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 overflow-hidden">
          {job.type === "running" && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground border-b border-border">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              {job.label}
            </div>
          )}
          {logs.length > 0 && (
            <div className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {log.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
                  {log.status === "done" && <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />}
                  {log.status === "fail" && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                  <span className={
                    log.status === "done" ? "text-foreground" :
                    log.status === "fail" ? "text-red-500" :
                    "text-muted-foreground"
                  }>{log.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {job.type === "done-crawl" && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" /> 크롤링 완료
          </div>
          <div className="flex gap-4 text-muted-foreground text-xs">
            <span>업데이트: <strong className="text-foreground">{job.result.updated_count}명</strong></span>
            <span>DB 미존재: <strong className="text-foreground">{job.result.not_found_count}명</strong></span>
            <span>웹 미존재: <strong className="text-foreground">{job.result.db_only_count}명</strong></span>
          </div>
          {job.result.not_found_in_db.length > 0 && (
            <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded px-3 py-2">
              DB에 없는 교수: {job.result.not_found_in_db.map((p) => p.web_name).join(", ")}
            </div>
          )}
        </div>
      )}

      {job.type === "done-summarize" && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" /> 요약 생성 완료
          </div>
          <p className="text-xs text-muted-foreground">
            {job.result.updated_count}명의 요약이 생성되었습니다.
            {job.result.results.length > 0 && ` (${job.result.results.map((r) => r.name).join(", ")})`}
          </p>
        </div>
      )}

      {job.type === "error" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {job.message}
        </div>
      )}

      {/* 교수 목록 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">교수명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상세정보</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">연구분야</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">요약</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.professor_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">#{p.professor_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.has_detail
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </td>
                  <td className="px-4 py-3">
                    {p.has_research_area
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </td>
                  <td className="px-4 py-3">
                    {p.has_summary
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.has_research_area && (
                      <button
                        onClick={() => runSummarizeSingle(p.professor_id)}
                        disabled={summaryingId === p.professor_id || job.type === "running"}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      >
                        {summaryingId === p.professor_id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5" />}
                        {p.has_summary ? "재생성" : "요약"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {professors.length === 0 ? "교수 데이터가 없습니다." : "검색 결과가 없습니다."}
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
