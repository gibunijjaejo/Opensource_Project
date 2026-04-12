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
type ModalType = "terms" | "privacy" | null

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("form")
  const [modal, setModal] = useState<ModalType>(null)
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
                    placeholder="김서강"
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
                    placeholder="20221234"
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
            <button className="underline hover:text-foreground" onClick={() => setModal("terms")}>이용약관</button> 및{" "}
            <button className="underline hover:text-foreground" onClick={() => setModal("privacy")}>개인정보처리방침</button>에 동의하는 것으로 간주됩니다.
          </p>

          {/* 이용약관 / 개인정보처리방침 모달 */}
          {modal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg max-h-[80vh] flex flex-col">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  {modal === "terms" ? "이용약관" : "개인정보처리방침"}
                </h2>
                <div className="overflow-y-auto flex-1 text-xs text-muted-foreground space-y-3 leading-relaxed">
                  {modal === "terms" ? (
                    <>
                      <p><strong className="text-foreground">1. 서비스 목적</strong><br />서간표는 서강대학교 재학생을 대상으로 수강 이력 관리 및 시간표 구성을 지원하는 서비스입니다.</p>
                      <p><strong className="text-foreground">2. 이용 대상</strong><br />서강대학교 재학생(@sogang.ac.kr 이메일 보유자)만 가입할 수 있습니다.</p>
                      <p><strong className="text-foreground">3. 금지 행위</strong><br />타인의 계정 도용, 허위 정보 입력, 서비스 운영 방해 행위를 금지합니다.</p>
                      <p><strong className="text-foreground">4. 서비스 변경 및 중단</strong><br />운영 사정에 따라 서비스 내용이 변경되거나 중단될 수 있습니다.</p>
                      <p><strong className="text-foreground">5. 면책</strong><br />서비스 이용 중 발생한 손해에 대해 운영팀은 책임을 지지 않습니다.</p>
                    </>
                  ) : (
                    <>
                      <p><strong className="text-foreground">1. 수집 항목</strong><br />이름, 학번, 학교 이메일, 수강 이력</p>
                      <p><strong className="text-foreground">2. 수집 목적</strong><br />회원 식별 및 서비스 제공 (시간표 관리, 강의 추천)</p>
                      <p><strong className="text-foreground">3. 보유 기간</strong><br />회원 탈퇴 시까지 보유 후 즉시 파기합니다.</p>
                      <p><strong className="text-foreground">4. 제3자 제공</strong><br />수집된 개인정보는 제3자에게 제공되지 않습니다.</p>
                      <p><strong className="text-foreground">5. 문의</strong><br />개인정보 관련 문의는 운영팀에 연락해주세요.</p>
                    </>
                  )}
                </div>
                <Button className="mt-4 h-9" style={{ backgroundColor: "#B0232A" }} onClick={() => setModal(null)}>
                  확인
                </Button>
              </div>
            </div>
          )}

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
