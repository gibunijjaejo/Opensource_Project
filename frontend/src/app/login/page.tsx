"use client"

import { useState } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"

type ResetStep = "idle" | "email" | "code" | "done"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // 비밀번호 찾기
  const [resetStep, setResetStep] = useState<ResetStep>("idle")
  const [resetEmail, setResetEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [resetNewPw, setResetNewPw] = useState("")
  const [resetMsg, setResetMsg] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

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
      setPassword("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendResetEmail = async () => {
    setResetLoading(true)
    setResetError("")
    try {
      await authApi.sendResetEmail(resetEmail)
      setResetMsg("인증번호가 발송되었습니다.")
      setResetStep("code")
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "이메일 발송에 실패했습니다.")
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setResetLoading(true)
    setResetError("")
    try {
      await authApi.resetPassword(resetEmail, resetCode, resetNewPw)
      setResetStep("done")
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다.")
    } finally {
      setResetLoading(false)
    }
  }

  const closeReset = () => {
    setResetStep("idle")
    setResetEmail("")
    setResetCode("")
    setResetNewPw("")
    setResetMsg("")
    setResetError("")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="flex h-14 items-center justify-center">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">서간표</span>
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
                  onClick={() => setResetStep("email")}
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
          서간표 - {getCurrentSemester().label}
        </p>
      </footer>

      {/* 비밀번호 찾기 모달 */}
      {resetStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg mx-4">
            <h2 className="text-base font-semibold text-foreground mb-4">비밀번호 찾기</h2>

            {resetStep === "email" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">가입한 이메일을 입력하면 인증번호를 보내드립니다.</p>
                <Input
                  type="email"
                  placeholder="student@sogang.ac.kr"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" className="flex-1" onClick={closeReset}>취소</Button>
                  <Button className="flex-1" style={{ backgroundColor: "#B0232A" }} onClick={handleSendResetEmail} disabled={resetLoading}>
                    {resetLoading ? "발송 중..." : "인증번호 발송"}
                  </Button>
                </div>
              </div>
            )}

            {resetStep === "code" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">{resetMsg}</p>
                <Input
                  placeholder="인증번호 6자리"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  maxLength={6}
                />
                <Input
                  type="password"
                  placeholder="새 비밀번호"
                  value={resetNewPw}
                  onChange={(e) => setResetNewPw(e.target.value)}
                />
                {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" className="flex-1" onClick={closeReset}>취소</Button>
                  <Button className="flex-1" style={{ backgroundColor: "#B0232A" }} onClick={handleResetPassword} disabled={resetLoading}>
                    {resetLoading ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </div>
              </div>
            )}

            {resetStep === "done" && (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-sm text-foreground">비밀번호가 변경되었습니다.</p>
                <Button style={{ backgroundColor: "#B0232A" }} onClick={closeReset}>확인</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
