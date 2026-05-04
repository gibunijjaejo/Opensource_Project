"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

type ContactStatus = "pending" | "resolved" | "dismissed"

interface ContactItem {
  id: number
  student_id: number | null
  sender_name: string | null
  sender_email: string | null
  subject: string
  content: string
  status: ContactStatus
  created_at: string
}

const STATUS_LABEL: Record<ContactStatus, string> = {
  pending: "대기중",
  resolved: "처리됨",
  dismissed: "기각됨",
}

const STATUS_COLOR: Record<ContactStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-muted text-muted-foreground",
}

export default function AdminContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "">("pending")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)

  const token = getAdminToken()

  const fetchCounts = useCallback(async () => {
    if (!token) return
    const res = await fetch(`${BASE_URL}/admin/contacts/counts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setPendingCount(data.total)
    }
  }, [token])

  const fetchContacts = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    const res = await fetch(`${BASE_URL}/admin/contacts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setContacts(await res.json())
    setIsLoading(false)
  }, [token, statusFilter])

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    fetchCounts()
    fetchContacts()
  }, [token, fetchCounts, fetchContacts, router])

  const handleResolve = async (id: number) => {
    if (!token) return
    setActioningId(id)
    const res = await fetch(`${BASE_URL}/admin/contacts/${id}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) await Promise.all([fetchCounts(), fetchContacts()])
    setActioningId(null)
  }

  const handleDismiss = async (id: number) => {
    if (!token) return
    setActioningId(id)
    const res = await fetch(`${BASE_URL}/admin/contacts/${id}/dismiss`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) await Promise.all([fetchCounts(), fetchContacts()])
    setActioningId(null)
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">문의 관리</h1>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
              <MessageSquare className="h-3 w-3" />
              미처리 {pendingCount}건
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">사용자 문의를 확인하고 처리합니다.</p>
      </div>

      {/* 상태 필터 */}
      <div className="flex rounded-md border border-border overflow-hidden text-xs w-fit mb-6">
        {(["pending", "resolved", "dismissed", ""] as const).map((s) => {
          const label = s === "" ? "전체" : STATUS_LABEL[s as ContactStatus]
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

      {/* 문의 목록 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">해당 조건의 문의가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((contact) => {
            const expanded = expandedId === contact.id
            const actioning = actioningId === contact.id
            return (
              <div key={contact.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : contact.id)}
                >
                  <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                    {contact.subject}
                  </span>
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {contact.sender_name ?? "-"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[contact.status]}`}>
                      {STATUS_LABEL[contact.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(contact.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    {expanded
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border px-4 py-4 bg-muted/10 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">보낸 사람</span>
                        <span className="text-foreground">{contact.sender_name ?? "-"} ({contact.student_id ?? "-"})</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">이메일</span>
                        <span className="text-foreground">{contact.sender_email ?? "-"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0">접수일시</span>
                        <span className="text-foreground">{new Date(contact.created_at).toLocaleString("ko-KR")}</span>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-card px-4 py-3">
                      <p className="text-xs font-semibold text-foreground mb-2">{contact.subject}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{contact.content}</p>
                    </div>

                    {contact.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          style={{ backgroundColor: "#B0232A" }}
                          onClick={() => handleResolve(contact.id)}
                          disabled={actioning}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {actioning ? "처리 중..." : "처리됨"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleDismiss(contact.id)}
                          disabled={actioning}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          기각됨
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
