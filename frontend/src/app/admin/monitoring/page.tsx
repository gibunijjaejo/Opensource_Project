"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

type HealthData = {
  status: string
  admin: string
  stats: { users: number; posts: number; pending_reports: number }
}

export default function AdminMonitoringPage() {
  const router = useRouter()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [error, setError] = useState("")

  const token = getAdminToken()

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    check()
  }, [])

  const check = () => {
    setIsLoading(true)
    setError("")
    fetch(`${BASE_URL}/admin/health`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error("서버 응답 오류"); return res.json() })
      .then((data) => { setHealth(data); setLastChecked(new Date()) })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <h1 className="text-lg font-bold text-foreground">모니터링</h1>
        <p className="mt-1 text-sm text-muted-foreground">서버 상태를 실시간으로 확인합니다.</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Button size="sm" variant="outline" onClick={check} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
        {lastChecked && (
          <span className="text-xs text-muted-foreground">
            마지막 확인: {lastChecked.toLocaleTimeString("ko-KR")}
          </span>
        )}
      </div>

      <div className="grid gap-4 max-w-xl">
        {/* API 서버 상태 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">API 서버</p>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 확인 중...
            </div>
          )}
          {!isLoading && health && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-foreground">정상 운영중</p>
                <p className="text-xs text-muted-foreground mt-0.5">{BASE_URL}</p>
              </div>
            </div>
          )}
          {!isLoading && error && (
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-500">응답 없음</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* DB 상태 (헬스체크 응답으로 간접 확인) */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">데이터베이스</p>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 확인 중...
            </div>
          )}
          {!isLoading && health && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-foreground">연결됨</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  유저 {health.stats.users}명 · 게시글 {health.stats.posts}건
                </p>
              </div>
            </div>
          )}
          {!isLoading && error && (
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500">연결 실패</p>
            </div>
          )}
        </div>

        {/* Grafana 안내 */}
        <div className="rounded-lg border border-border bg-muted/30 p-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">상세 모니터링 (Grafana)</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Loki + Prometheus + Grafana 연동 후 이곳에 대시보드를 임베드할 예정입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
