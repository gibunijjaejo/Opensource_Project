"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Trash2, Ban, CheckCircle, Loader2, ShieldCheck, Pencil, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

type UserItem = {
  student_id: number
  name: string
  email: string
  role: string
  can_post: boolean
  current_semester: number | null
}

type EditForm = {
  name: string
  email: string
  current_semester: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionId, setActionId] = useState<number | null>(null)

  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", current_semester: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState("")

  const token = getAdminToken()

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    fetchUsers()
  }, [])

  const fetchUsers = (q?: string) => {
    setIsLoading(true)
    const url = q ? `${BASE_URL}/admin/users?q=${encodeURIComponent(q)}` : `${BASE_URL}/admin/users`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then(setUsers)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(search)
  }

  const toggleCanPost = async (student_id: number) => {
    setActionId(student_id)
    await fetch(`${BASE_URL}/admin/users/${student_id}/can-post`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchUsers(search || undefined)
    setActionId(null)
  }

  const deleteUser = async (student_id: number, name: string) => {
    if (!confirm(`${name} 유저를 탈퇴 처리하겠습니까?`)) return
    setActionId(student_id)
    await fetch(`${BASE_URL}/admin/users/${student_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchUsers(search || undefined)
    setActionId(null)
  }

  const openEdit = (user: UserItem) => {
    setEditTarget(user)
    setEditForm({
      name: user.name,
      email: user.email,
      current_semester: user.current_semester != null ? String(user.current_semester) : "",
    })
    setEditError("")
  }

  const handleEditSave = async () => {
    if (!editTarget || !token) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError("이름과 이메일은 필수입니다.")
      return
    }
    setIsSaving(true)
    setEditError("")
    const res = await fetch(`${BASE_URL}/admin/users/${editTarget.student_id}/info`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        current_semester: editForm.current_semester ? Number(editForm.current_semester) : null,
      }),
    })
    if (res.ok) {
      setEditTarget(null)
      await fetchUsers(search || undefined)
    } else {
      const data = await res.json().catch(() => ({}))
      setEditError(data.detail || "수정에 실패했습니다.")
    }
    setIsSaving(false)
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <h1 className="text-lg font-bold text-foreground">사용자 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">유저 목록을 조회하고 권한을 관리합니다.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button type="submit" size="sm" style={{ backgroundColor: "#B0232A" }}>검색</Button>
      </form>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">학번</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">학기</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">권한</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">게시글</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.student_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{user.student_id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.current_semester ?? "-"}학기</td>
                  <td className="px-4 py-3">
                    {user.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B0232A]">
                        <ShieldCheck className="h-3 w-3" /> 관리자
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">일반</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.can_post ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" /> 허용
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500">
                        <Ban className="h-3 w-3" /> 제한
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="정보 수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {user.role !== "admin" && (
                        <>
                          <button
                            onClick={() => toggleCanPost(user.student_id)}
                            disabled={actionId === user.student_id}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            {user.can_post ? "게시 제한" : "제한 해제"}
                          </button>
                          <button
                            onClick={() => deleteUser(user.student_id, user.name)}
                            disabled={actionId === user.student_id}
                            className="text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    유저가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 사용자 정보 수정 모달 */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                사용자 정보 수정 <span className="text-muted-foreground font-normal">({editTarget.student_id})</span>
              </h3>
              <button onClick={() => setEditTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">이름</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">이메일</label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-9 text-sm"
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">현재 학기</label>
                <Input
                  value={editForm.current_semester}
                  onChange={(e) => setEditForm((f) => ({ ...f, current_semester: e.target.value }))}
                  className="h-9 text-sm"
                  type="number"
                  min={1}
                  max={16}
                  placeholder="예: 5"
                />
              </div>
            </div>

            {editError && (
              <p className="text-xs text-red-500">{editError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditTarget(null)}>
                취소
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                style={{ backgroundColor: "#B0232A" }}
                onClick={handleEditSave}
                disabled={isSaving}
              >
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
