"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, LayoutDashboard, Users, Flag, Activity, GraduationCap, FileText, LogOut, MessageSquare } from "lucide-react"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

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

  useEffect(() => {
    if (pathname === "/admin/login") return
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
  }, [pathname])

  if (pathname === "/admin/login") return <>{children}</>

  const handleLogout = () => {
    document.cookie = "admin_token=; path=/; max-age=0"
    router.replace("/admin/login")
  }

  const NAV = [
    { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true, badge: 0 },
    { href: "/admin/users", label: "사용자 관리", icon: Users, exact: false, badge: 0 },
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
          <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
          <span className="text-sm font-semibold">서간표 관리자</span>
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
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
