"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Flag, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminApi, AdminReport } from "@/lib/api"

type ReportStatus = "pending" | "resolved" | "dismissed"
type ReasonTab = "전체" | "욕설" | "스팸" | "기타"

interface Counts {
  total: number
  욕설: number
  스팸: number
  기타: number
}

const REASON_TABS: ReasonTab[] = ["전체", "욕설", "스팸", "기타"]

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "대기중",
  resolved: "처리됨",
  dismissed: "기각됨",
}

const STATUS_COLOR: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-muted text-muted-foreground",
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [counts, setCounts] = useState<Counts>({ total: 0, 욕설: 0, 스팸: 0, 기타: 0 })
  const [reports, setReports] = useState<AdminReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<ReasonTab>("전체")
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "">("pending")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      setCounts(await adminApi.getReportCounts())
    } catch {}
  }, [])

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await adminApi.getReports({
        status: statusFilter || undefined,
        reason: selectedTab !== "전체" ? selectedTab : undefined,
      })
      setReports(data)
    } catch {}
    setIsLoading(false)
  }, [statusFilter, selectedTab])

  useEffect(() => {
    fetchCounts()
    fetchReports()
  }, [fetchCounts, fetchReports])

  const handleResolve = async (report: AdminReport) => {
    const targetLabel = report.target_type === "post" ? "게시글" : "댓글"
    if (!confirm(`신고된 ${targetLabel}을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) return
    setActioningId(report.id)
    try {
      await adminApi.resolveReport(report.id)
      await Promise.all([fetchCounts(), fetchReports()])
    } catch {}
    setActioningId(null)
  }

  const handleDismiss = async (reportId: number) => {
    setActioningId(reportId)
    try {
      await adminApi.dismissReport(reportId)
      await Promise.all([fetchCounts(), fetchReports()])
    } catch {}
    setActioningId(null)
  }

  const tabCount = (tab: ReasonTab) => {
    if (tab === "전체") return counts.total
    return counts[tab as keyof Omit<Counts, "total">]
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">신고 관리</h1>
          {counts.total > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
              <Flag className="h-3 w-3" />
              미처리 {counts.total}건
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">사용자 신고를 검토하고 처리합니다.</p>
      </div>

      {/* 탭 + 상태 필터 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {REASON_TABS.map((tab) => {
            const count = tabCount(tab)
            const active = selectedTab === tab
            return (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {count > 0 && (
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      active ? "bg-red-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(["pending", "resolved", "dismissed", ""] as const).map((s) => {
            const label = s === "" ? "전체" : STATUS_LABEL[s as ReportStatus]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 transition-colors border-l first:border-l-0 border-border ${
                  statusFilter === s ? "text-white" : "text-muted-foreground hover:bg-muted"
                }`}
                style={statusFilter === s ? { backgroundColor: "#B0232A" } : {}}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 신고 목록 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Flag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">해당 조건의 신고가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((report) => {
            const expanded = expandedId === report.id
            const actioning = actioningId === report.id
            const status = report.status as ReportStatus
            return (
              <div key={report.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                >
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: report.reason === "욕설" ? "#EF4444" : report.reason === "스팸" ? "#F97316" : "#6B7280" }}
                  >
                    {report.reason}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {report.reporter_name ?? `#${report.reporter_id}`}
                  </span>
                  <span className="text-xs text-foreground flex-shrink-0">
                    {report.target_type === "post" ? "게시글" : "댓글"} #{report.target_id}
                  </span>
                  {report.target_title && (
                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{report.target_title}</span>
                  )}
                  {!report.target_title && report.target_content && (
                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{report.target_content}</span>
                  )}
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border px-4 py-3 bg-muted/10 flex flex-col gap-3">
                    <div className="rounded-md border border-border bg-card px-4 py-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-foreground">
                          신고된 {report.target_type === "post" ? "게시글" : "댓글"}
                        </span>
                        {report.target_category && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {report.target_category}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">#{report.target_id}</span>
                      </div>
                      {report.target_title && (
                        <p className="text-sm font-medium text-foreground">{report.target_title}</p>
                      )}
                      {report.target_author && (
                        <p className="text-xs text-muted-foreground">{report.target_author}</p>
                      )}
                      {report.target_content ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed border-t border-border pt-2 mt-1">
                          {report.target_content}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          삭제되었거나 숨겨진 {report.target_type === "post" ? "게시글" : "댓글"}입니다.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">신고자</span>
                        <span className="text-foreground">{report.reporter_name ?? "탈퇴한 사용자"} ({report.reporter_id ?? "-"})</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">신고 사유</span>
                        <span className="text-foreground">{report.reason}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">접수일시</span>
                        <span className="text-foreground">{new Date(report.created_at).toLocaleString("ko-KR")}</span>
                      </div>
                    </div>
                    {report.detail && (
                      <div className="rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                        <p className="font-medium text-muted-foreground mb-1">상세 사유</p>
                        <p className="whitespace-pre-wrap">{report.detail}</p>
                      </div>
                    )}
                    {status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          style={{ backgroundColor: "#B0232A" }}
                          onClick={() => handleResolve(report)}
                          disabled={actioning}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {actioning ? "삭제 중..." : "게시글 삭제"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleDismiss(report.id)}
                          disabled={actioning}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          기각
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
