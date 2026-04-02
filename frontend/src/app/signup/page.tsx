"use client"

import { useState } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Mail, Lock, User, Eye, EyeOff, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"

type Step = "form" | "verify"

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("form")
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    currentSemester: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [verifyCode, setVerifyCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 1단계: 이메일 인증 코드 발송
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      await authApi.sendEmail(formData.email)
      setStep("verify")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "이메일 발송에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // 2단계: 인증코드 확인 후 회원가입
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      await authApi.verifyCode(formData.email, verifyCode)
      await authApi.register({
        student_id: Number(formData.studentId),
        name: formData.name,
        email: formData.email,
        password: formData.password,
        current_semester: formData.currentSemester ? Number(formData.currentSemester) : undefined,
      })
      router.push("/login")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.")
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
              <span className="text-sm font-semibold text-foreground tracking-tight">서간표</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground">
              {step === "form" ? "회원가입" : "이메일 인증"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === "form"
                ? "서간표에 가입하고 수강 계획을 시작하세요"
                : `${formData.email}로 발송된 인증번호를 입력하세요`}
            </p>
          </div>

          {/* Step 1: 회원가입 폼 */}
          {step === "form" && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-xs font-medium text-foreground">이름</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="홍길동"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="studentId" className="text-xs font-medium text-foreground">학번</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="studentId"
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => updateField("studentId", e.target.value)}
                    placeholder="2022123456"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="currentSemester" className="text-xs font-medium text-foreground">현재 학기</label>
                <select
                  id="currentSemester"
                  value={formData.currentSemester}
                  onChange={(e) => updateField("currentSemester", e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  required
                >
                  <option value="" disabled>학기 선택</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>{s}학기</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-foreground">학교 이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="student@sogang.ac.kr"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-foreground">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="8자 이상 입력"
                    className="pl-10 pr-10"
                    required
                    minLength={8}
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">비밀번호 확인</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="pl-10"
                    required
                  />
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
                )}
              </div>

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading || formData.password !== formData.confirmPassword}
                className="mt-2 h-10"
                style={{ backgroundColor: "#B0232A" }}
              >
                {isLoading ? "전송 중..." : "인증 메일 발송"}
              </Button>
            </form>
          )}

          {/* Step 2: 이메일 인증 */}
          {step === "verify" && (
            <form onSubmit={handleVerifyAndRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="verifyCode" className="text-xs font-medium text-foreground">
                  인증번호 (6자리)
                </label>
                <Input
                  id="verifyCode"
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading || verifyCode.length !== 6}
                className="mt-2 h-10"
                style={{ backgroundColor: "#B0232A" }}
              >
                {isLoading ? "가입 중..." : "인증 후 가입 완료"}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("form"); setError("") }}
                className="text-xs text-center text-muted-foreground hover:underline"
              >
                이메일 다시 입력하기
              </button>
            </form>
          )}

          <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
            가입 시{" "}
            <button className="underline hover:text-foreground">이용약관</button> 및{" "}
            <button className="underline hover:text-foreground">개인정보처리방침</button>에 동의하는 것으로 간주됩니다.
          </p>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium hover:underline" style={{ color: "#B0232A" }}>
              로그인
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-xs text-muted-foreground/60 text-center">
          서간표 - {getCurrentSemester().label}
        </p>
      </footer>
    </div>
  )
}
