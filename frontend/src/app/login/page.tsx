"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const token = await authApi.login(email, password)
      localStorage.setItem("access_token", token.access_token)
      router.push("/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="flex h-14 items-center justify-center">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">CourseScope</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground">로그인</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              학교 이메일로 로그인하세요
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.ac.kr"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-foreground">
                  비밀번호
                </label>
                <button
                  type="button"
                  className="text-xs hover:underline"
                  style={{ color: "#B0232A" }}
                >
                  비밀번호 찾기
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-10"
              style={{ backgroundColor: "#B0232A" }}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          {/* SSO Button */}
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={() => router.push("/")}
          >
            학교 SSO로 로그인
          </Button>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-medium hover:underline" style={{ color: "#B0232A" }}>
              회원가입
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <p className="text-xs text-muted-foreground/60 text-center">
          CourseScope - 2026년 1학기
        </p>
      </footer>
    </div>
  )
}
