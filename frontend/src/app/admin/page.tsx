"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Users, FileText, Flag, CheckCircle, XCircle, Loader2 } from "lucide-react"

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

export default function AdminDashboard() {
  const router = useRouter()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const token = getAdminToken()
    if (!token) { router.replace("/admin/login"); return }
    fetch(`${BASE_URL}/admin/health`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error("인증 실패"); return res.json() })
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [router])

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <h1 className="text-lg font-bold text-foreground">대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">서버 상태 및 주요 지표를 확인합니다.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {health && (
        <>
          {/* 서버 상태 */}
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 w-fit">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">서버 정상</span>
            <span className="text-xs text-muted-foreground">· 관리자: {health.admin}</span>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <StatCard icon={Users} label="전체 사용자" value={health.stats.users} color="#3B82F6" />
            <StatCard icon={FileText} label="전체 게시글" value={health.stats.posts} color="#8B5CF6" actionHref="/admin/posts" actionLabel="보기" />
            <StatCard icon={Flag} label="미처리 신고" value={health.stats.pending_reports} color="#EF4444" />
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  actionHref,
  actionLabel,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-md p-1.5" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {actionHref && (
          <Link
            href={actionHref}
            className="ml-auto text-xs font-medium hover:underline"
            style={{ color }}
          >
            {actionLabel ?? "보기"}
          </Link>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
    </div>
  )
}
