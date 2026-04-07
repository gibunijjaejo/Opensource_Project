"use client"

import { useState, useEffect, useRef } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, User, Save, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { interestOptions } from "@/lib/constants/course-data"
import { usersApi } from "@/lib/api"

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "",
    studentId: "",
    major: "컴퓨터공학과",
    semester: 1,
    interests: [] as string[],
  })
  const [semesterInput, setSemesterInput] = useState("")
  const [semesterError, setSemesterError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const isLoaded = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    usersApi.me()
      .then((u) => {
        const sem = u.current_semester || 1
        const interests = u.interests ? u.interests.split(",").filter(Boolean) : []
        setProfile((prev) => ({ ...prev, name: u.name, studentId: String(u.student_id), semester: sem, interests }))
        setSemesterInput(`${sem}학기`)
        isLoaded.current = true
      })
      .catch(() => {})
  }, [])

  // 관심 분야 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      usersApi.update({ interests: profile.interests }).catch(() => {})
    }, 500)
  }, [profile.interests])

  const handleSemesterChange = (value: string) => {
    setSemesterInput(value)
    setSaved(false)
    const trimmed = value.trim().replace(/학기$/, "")
    const num = Number(trimmed)
    if (!trimmed || isNaN(num) || !Number.isInteger(num) || num < 1) {
      setSemesterError("입력이 잘못되었습니다")
    } else {
      setSemesterError("")
      setSemesterInput(`${num}학기`)
      setProfile((prev) => ({ ...prev, semester: num }))
    }
  }

  const toggleInterest = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  const handleSave = async () => {
    if (semesterError) return
    setIsSaving(true)
    try {
      await usersApi.update({ current_semester: profile.semester, interests: profile.interests })
      setSaved(true)
    } catch {
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground">프로필 및 관심 분야</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              관심 분야를 설정하면 해당 분야의 커뮤니티 게시판으로 이동할 수 있습니다.
            </p>
          </div>

          {/* 기본 정보 */}
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
                <Input
                  value={semesterInput}
                  onChange={(e) => setSemesterInput(e.target.value)}
                  onBlur={(e) => handleSemesterChange(e.target.value)}
                  placeholder="예: 3 또는 3학기"
                  className={semesterError ? "border-red-500" : ""}
                />
                {semesterError && (
                  <p className="text-xs text-red-500">{semesterError}</p>
                )}
              </div>
            </div>
          </section>

          {/* 관심 분야 */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">관심 분야</h2>
              <p className="text-xs text-muted-foreground mt-1">
                졸업 후 희망하는 분야를 선택하세요 (복수 선택 가능)
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
                      ${isSelected ? "border-transparent text-white" : "border-border bg-background text-foreground hover:bg-muted"}
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

          {/* 커뮤니티 바로가기 */}
          {profile.interests.length > 0 && (
            <section className="rounded-lg border border-border bg-muted/30 p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1">내 커뮤니티 게시판</h2>
              <p className="text-xs text-muted-foreground mb-4">선택한 분야의 게시판으로 바로 이동할 수 있습니다.</p>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((item) => (
                  <Link
                    key={item}
                    href={`/community/${encodeURIComponent(item)}`}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    style={{ borderColor: "#B0232A", color: "#B0232A" }}
                  >
                    {item} →
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

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
