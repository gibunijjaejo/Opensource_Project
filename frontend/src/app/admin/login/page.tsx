"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`${BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || "로그인에 실패했습니다.")
      }
      const { access_token } = await res.json()
      document.cookie = `admin_token=${access_token}; path=/; SameSite=Strict; max-age=${60 * 60 * 24}`
      router.replace("/admin")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-md px-4">
          <div className="flex h-14 items-center justify-center gap-2">
            <BookOpen className="h-5 w-5" style={{ color: "#B0232A" }} />
            <span className="text-xl font-semibold font-logo">서간표 관리자</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground">관리자 로그인</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">관리자 계정으로 로그인하세요</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sogang.ac.kr"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-10"
              style={{ backgroundColor: "#B0232A" }}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
