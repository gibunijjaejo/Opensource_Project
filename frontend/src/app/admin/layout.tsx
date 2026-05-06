"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, LayoutDashboard, Users, Flag, Activity, GraduationCap, FileText, LogOut, MessageSquare, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
const ADMIN_PIN = "1234"

function getAdminToken() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingReports, setPendingReports] = useState(0)
  const [pendingContacts, setPendingContacts] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState("")

  useEffect(() => {
    if (pathname === "/admin/login") return
    setUnlocked(sessionStorage.getItem("admin_unlocked") === "1")
  }, [pathname])

  useEffect(() => {
    if (pathname === "/admin/login" || !unlocked) return
    const token = getAdminToken()
    if (!token) return
    fetch(`${BASE_URL}/admin/reports/counts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setPendingReports(data.total) })
      .catch(() => {})
    fetch(`${BASE_URL}/admin/contacts/counts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setPendingContacts(data.total) })
      .catch(() => {})
  }, [pathname, unlocked])

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === ADMIN_PIN) {
      sessionStorage.setItem("admin_unlocked", "1")
      setUnlocked(true)
      setPinInput("")
      setPinError("")
    } else {
      setPinError("암호가 일치하지 않습니다.")
      setPinInput("")
    }
  }

  if (pathname === "/admin/login") return <>{children}</>

  const handleLogout = () => {
    document.cookie = "admin_token=; path=/; max-age=0"
    sessionStorage.removeItem("admin_unlocked")
    router.replace("/admin/login")
  }

  const NAV = [
    { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true, badge: 0 },
    { href: "/admin/users", label: "사용자 관리", icon: Users, exact: false, badge: 0 },
    { href: "/admin/posts", label: "게시글 관리", icon: FileText, exact: false, badge: 0 },
    { href: "/admin/reports", label: "신고 관리", icon: Flag, exact: false, badge: pendingReports },
    { href: "/admin/contacts", label: "문의 관리", icon: MessageSquare, exact: false, badge: pendingContacts },
    { href: "/admin/professors", label: "교수 데이터", icon: GraduationCap, exact: false, badge: 0 },
    { href: "/admin/lectures", label: "강의계획서", icon: FileText, exact: false, badge: 0 },
    { href: "/admin/monitoring", label: "모니터링", icon: Activity, exact: false, badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: "#B0232A" }} />
          <span className="text-xl font-semibold font-logo">서간표 관리자</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-[#B0232A]/10 text-[#B0232A] font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* 메인 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className={`flex-1 p-8 ${unlocked ? "" : "blur-sm pointer-events-none select-none"}`}>{children}</main>
      </div>

      {!unlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-xs rounded-lg border border-border bg-card p-6 flex flex-col gap-4 shadow-lg"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Lock className="h-4 w-4" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold">관리자 암호 입력</span>
            </div>
            <Input
              type="password"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError("") }}
              placeholder="암호"
              className="text-center tracking-widest"
              autoFocus
            />
            {pinError && <p className="text-xs text-red-500 text-center">{pinError}</p>}
            <Button type="submit" className="h-9" style={{ backgroundColor: "#B0232A" }}>
              확인
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
