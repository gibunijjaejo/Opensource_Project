"use client"

import { useState, useEffect } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, User, Save, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { careerOptions, interestOptions } from "@/lib/constants/course-data"
import { usersApi } from "@/lib/api"

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "",
    studentId: "",
    major: "컴퓨터공학과",
    semester: 1,
    interests: [] as string[],
    targetCareers: [] as string[],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    usersApi.me()
      .then((u) => {
        setProfile((prev) => ({
          ...prev,
          name: u.name,
          studentId: String(u.student_id),
          semester: u.current_semester || 1,
        }))
      })
      .catch(() => {})
  }, [])

  const toggleInterest = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
    setSaved(false)
  }

  const toggleCareer = (career: string) => {
    setProfile((prev) => ({
      ...prev,
      targetCareers: prev.targetCareers.includes(career)
        ? prev.targetCareers.filter((c) => c !== career)
        : prev.targetCareers.length < 3
        ? [...prev.targetCareers, career]
        : prev.targetCareers,
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setIsSaving(false)
    setSaved(true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>대시보드</span>
              </Link>
              <span className="text-border text-muted-foreground/40">/</span>
              <span className="text-xs text-foreground font-medium">프로필 설정</span>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-8 gap-1.5"
              style={{ backgroundColor: "#B0232A" }}
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  저장됨
                </>
              ) : isSaving ? (
                "저장 중..."
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  저장
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-8">
          {/* Title */}
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground">프로필 및 관심 분야</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              관심 분야와 목표 직무를 설정하면 맞춤형 과목 추천을 받을 수 있습니다.
            </p>
          </div>

          {/* Basic Info */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">기본 정보</h2>
                <p className="text-xs text-muted-foreground">학적 정보는 수정할 수 없습니다</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">이름</label>
                <Input value={profile.name} disabled className="bg-muted/50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">학번</label>
                <Input value={profile.studentId} disabled className="bg-muted/50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">전공</label>
                <Input value={profile.major} disabled className="bg-muted/50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">현재 학기</label>
                <Input value={`${profile.semester}학기`} disabled className="bg-muted/50" />
              </div>
            </div>
          </section>

          {/* Interests */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">관심 분야</h2>
              <p className="text-xs text-muted-foreground mt-1">
                관심 있는 분야를 선택하세요 (복수 선택 가능)
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {interestOptions.map((interest) => {
                const isSelected = profile.interests.includes(interest)
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`
                      flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
                      ${
                        isSelected
                          ? "border-transparent text-white"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }
                    `}
                    style={isSelected ? { backgroundColor: "#B0232A" } : {}}
                  >
                    {interest}
                    {isSelected && <X className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>

            {profile.interests.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  선택됨: {profile.interests.join(", ")}
                </p>
              </div>
            )}
          </section>

          {/* Target Careers */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">목표 직무</h2>
              <p className="text-xs text-muted-foreground mt-1">
                희망하는 직무를 최대 3개까지 선택하세요
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {careerOptions.map((career) => {
                const isSelected = profile.targetCareers.includes(career)
                const isDisabled = !isSelected && profile.targetCareers.length >= 3
                return (
                  <button
                    key={career}
                    onClick={() => toggleCareer(career)}
                    disabled={isDisabled}
                    className={`
                      flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors text-left
                      ${
                        isSelected
                          ? "border-transparent text-white"
                          : isDisabled
                          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }
                    `}
                    style={isSelected ? { backgroundColor: "#B0232A" } : {}}
                  >
                    <span>{career}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>

            {profile.targetCareers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">선택된 목표 직무:</p>
                <div className="flex flex-wrap gap-2">
                  {profile.targetCareers.map((career) => (
                    <Badge
                      key={career}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: "#B0232A20", color: "#B0232A" }}
                    >
                      {career}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Preview */}
          {profile.targetCareers.length > 0 && (
            <section className="rounded-lg border border-border bg-muted/30 p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">과목 매칭 미리보기</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                설정을 저장하면 대시보드와 과목 상세 페이지에서{" "}
                <span className="font-medium text-foreground">
                  {profile.targetCareers.join(", ")}
                </span>{" "}
                직무와의 관련도를 확인할 수 있습니다.
              </p>
              <div className="mt-4 flex gap-3">
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href="/">대시보드에서 확인</Link>
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            서간표 - {getCurrentSemester().label}
          </p>
        </div>
      </footer>
    </div>
  )
}
