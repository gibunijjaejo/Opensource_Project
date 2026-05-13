"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Trash2, Ban, CheckCircle, Loader2, ShieldCheck, Pencil, X, KeyRound, Send, UserCheck, UserX } from "lucide-react"
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
  can_comment: boolean
  current_semester: number | null
}

type PendingUserItem = {
  student_id: number
  name: string
  email: string
  current_semester: number | null
}

type EditForm = {
  student_id: string
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

  const [pendingUsers, setPendingUsers] = useState<PendingUserItem[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingActionId, setPendingActionId] = useState<number | null>(null)

  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ student_id: "", name: "", email: "", current_semester: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState("")

  const [newPassword, setNewPassword] = useState("")
  const [isResettingPw, setIsResettingPw] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  const [messageTarget, setMessageTarget] = useState<UserItem | null>(null)
  const [messageContent, setMessageContent] = useState("")
  const [isSendingMsg, setIsSendingMsg] = useState(false)
  const [msgError, setMsgError] = useState("")
  const [msgSuccess, setMsgSuccess] = useState(false)

  const token = getAdminToken()

  useEffect(() => {
    if (!token) { router.replace("/admin/login"); return }
    fetchUsers()
    fetchPendingUsers()
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

  const fetchPendingUsers = () => {
    setPendingLoading(true)
    fetch(`${BASE_URL}/admin/users/pending`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then(setPendingUsers)
      .catch(console.error)
      .finally(() => setPendingLoading(false))
  }

  const approveUser = async (student_id: number, name: string) => {
    if (!confirm(`${name} 의 회원가입을 승인하겠습니까?`)) return
    setPendingActionId(student_id)
    const res = await fetch(`${BASE_URL}/admin/users/${student_id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.detail || "승인에 실패했습니다.")
    }
    await Promise.all([fetchPendingUsers(), fetchUsers(search || undefined)])
    setPendingActionId(null)
  }

  const rejectUser = async (student_id: number, name: string) => {
    if (!confirm(`${name} 의 회원가입 신청을 거절하겠습니까? (계정 삭제)`)) return
    setPendingActionId(student_id)
    const res = await fetch(`${BASE_URL}/admin/users/${student_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.detail || "거절에 실패했습니다.")
    }
    fetchPendingUsers()
    setPendingActionId(null)
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

  const toggleCanComment = async (student_id: number) => {
    setActionId(student_id)
    await fetch(`${BASE_URL}/admin/users/${student_id}/can-comment`, {
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
      student_id: String(user.student_id),
      name: user.name,
      email: user.email,
      current_semester: user.current_semester != null ? String(user.current_semester) : "",
    })
    setEditError("")
    setNewPassword("")
    setPwError("")
    setPwSuccess(false)
  }

  const openMessage = (user: UserItem) => {
    setMessageTarget(user)
    setMessageContent("")
    setMsgError("")
    setMsgSuccess(false)
  }

  const handleEditSave = async () => {
    if (!editTarget || !token) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError("이름과 이메일은 필수입니다.")
      return
    }
    const newSid = editForm.student_id ? Number(editForm.student_id) : editTarget.student_id
    if (isNaN(newSid) || newSid <= 0) {
      setEditError("올바른 학번을 입력하세요.")
      return
    }
    setIsSaving(true)
    setEditError("")
    const res = await fetch(`${BASE_URL}/admin/users/${editTarget.student_id}/info`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        new_student_id: newSid !== editTarget.student_id ? newSid : undefined,
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

  const handlePasswordReset = async () => {
    if (!editTarget || !token) return
    if (!newPassword || newPassword.length < 4) {
      setPwError("비밀번호는 4자 이상이어야 합니다.")
      return
    }
    setIsResettingPw(true)
    setPwError("")
    setPwSuccess(false)
    const sid = editForm.student_id ? Number(editForm.student_id) : editTarget.student_id
    const res = await fetch(`${BASE_URL}/admin/users/${sid}/password`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPassword }),
    })
    if (res.ok) {
      setPwSuccess(true)
      setNewPassword("")
    } else {
      const data = await res.json().catch(() => ({}))
      setPwError(data.detail || "비밀번호 초기화에 실패했습니다.")
    }
    setIsResettingPw(false)
  }

  const handleSendMessage = async () => {
    if (!messageTarget || !token) return
    if (!messageContent.trim()) {
      setMsgError("메시지 내용을 입력하세요.")
      return
    }
    setIsSendingMsg(true)
    setMsgError("")
    setMsgSuccess(false)
    const res = await fetch(`${BASE_URL}/admin/users/${messageTarget.student_id}/message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: messageContent.trim() }),
    })
    if (res.ok) {
      setMsgSuccess(true)
      setMessageContent("")
    } else {
      const data = await res.json().catch(() => ({}))
      setMsgError(data.detail || "메시지 전송에 실패했습니다.")
    }
    setIsSendingMsg(false)
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <h1 className="text-lg font-bold text-foreground">사용자 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">유저 목록을 조회하고 권한을 관리합니다.</p>
      </div>

      {/* 회원가입 승인 대기 */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="h-4 w-4" style={{ color: "#B0232A" }} />
          <h2 className="text-sm font-semibold text-foreground">회원가입 승인 대기</h2>
          {!pendingLoading && pendingUsers.length > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: "#B0232A" }}
            >
              {pendingUsers.length}
            </span>
          )}
        </div>
        {pendingLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 로딩 중...
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            승인 대기 중인 사용자가 없습니다.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">학번</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">이름</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">이메일</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">학기</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingUsers.map((u) => {
                  const busy = pendingActionId === u.student_id
                  return (
                    <tr key={u.student_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{u.student_id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.current_semester ?? "-"}학기</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            style={{ backgroundColor: "#B0232A" }}
                            onClick={() => approveUser(u.student_id, u.name)}
                            disabled={busy}
                          >
                            <UserCheck className="h-3 w-3" /> 승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 text-red-500 hover:text-red-600"
                            onClick={() => rejectUser(u.student_id, u.name)}
                            disabled={busy}
                          >
                            <UserX className="h-3 w-3" /> 거절
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">댓글</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">메시지</th>
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
                    {user.can_comment ? (
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
                    <button
                      onClick={() => openMessage(user)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title="메시지 전송"
                    >
                      <Send className="h-3 w-3" /> 보내기
                    </button>
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
                            {user.can_post ? "게시 제한" : "게시 해제"}
                          </button>
                          <button
                            onClick={() => toggleCanComment(user.student_id)}
                            disabled={actionId === user.student_id}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            {user.can_comment ? "댓글 제한" : "댓글 해제"}
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
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                사용자 정보 수정 <span className="text-muted-foreground font-normal">({editTarget.student_id})</span>
              </h3>
              <button onClick={() => setEditTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 기본 정보 */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">학번</label>
                <Input
                  value={editForm.student_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, student_id: e.target.value }))}
                  className="h-9 text-sm"
                  type="number"
                  placeholder="학번"
                />
              </div>
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

            {editError && <p className="text-xs text-red-500">{editError}</p>}

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

            {/* 비밀번호 초기화 */}
            <div className="border-t border-border pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">비밀번호 초기화</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwSuccess(false); setPwError("") }}
                  className="h-9 text-sm flex-1"
                  type="password"
                  placeholder="새 비밀번호 입력"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs flex-shrink-0"
                  onClick={handlePasswordReset}
                  disabled={isResettingPw}
                >
                  {isResettingPw ? "처리 중..." : "초기화"}
                </Button>
              </div>
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-600">비밀번호가 초기화되었습니다.</p>}
            </div>
          </div>
        </div>
      )}

      {/* 메시지 전송 모달 */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Send className="h-4 w-4" style={{ color: "#B0232A" }} />
                메시지 전송
                <span className="text-muted-foreground font-normal">
                  ({messageTarget.name} · {messageTarget.student_id})
                </span>
              </h3>
              <button onClick={() => setMessageTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">사용자가 다음 로그인 시 모달로 표시됩니다.</p>
            <textarea
              value={messageContent}
              onChange={(e) => { setMessageContent(e.target.value); setMsgSuccess(false); setMsgError("") }}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
              placeholder="메시지 내용을 입력하세요"
            />
            {msgError && <p className="text-xs text-red-500">{msgError}</p>}
            {msgSuccess && <p className="text-xs text-green-600">메시지가 전송되었습니다.</p>}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMessageTarget(null)}>
                닫기
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                style={{ backgroundColor: "#B0232A" }}
                onClick={handleSendMessage}
                disabled={isSendingMsg}
              >
                {isSendingMsg ? "전송 중..." : "전송"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
