"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { BookOpen, LayoutDashboard, Users, Flag, Activity, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const NAV = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "사용자 관리", icon: Users },
  { href: "/admin/reports", label: "신고 관리", icon: Flag },
  { href: "/admin/monitoring", label: "모니터링", icon: Activity },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === "/admin/login") return <>{children}</>

  const handleLogout = () => {
    document.cookie = "admin_token=; path=/; max-age=0"
    router.replace("/admin/login")
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
          <span className="text-sm font-semibold">서간표 관리자</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
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
                {label}
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
