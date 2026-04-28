"use client"

import { useState, useEffect, useRef } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, User, Save, Check, X, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { interestOptions } from "@/lib/constants/course-data"
import { usersApi, contactApi } from "@/lib/api"

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: "",
    studentId: "",
    major: "컴퓨터공학과",
    semester: 1,
    interests: [] as string[],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const isLoaded = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 문의하기 모달
  const [showContact, setShowContact] = useState(false)
  const [contactSubject, setContactSubject] = useState("")
  const [contactContent, setContactContent] = useState("")
  const [contactSending, setContactSending] = useState(false)
  const [contactDone, setContactDone] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    usersApi.me()
      .then((u) => {
        const sem = u.current_semester || 1
        const interests = u.interests ? u.interests.split(",").filter(Boolean) : []
        setProfile((prev) => ({ ...prev, name: u.name, studentId: String(u.student_id), semester: sem, interests }))
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

  const toggleInterest = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await usersApi.update({ interests: profile.interests })
      setSaved(true)
    } catch {
    } finally {
      setIsSaving(false)
    }
  }

  const handleContactSubmit = async () => {
    if (!contactSubject.trim() || !contactContent.trim()) return
    setContactSending(true)
    try {
      await contactApi.send(contactSubject.trim(), contactContent.trim())
      setContactDone(true)
      setTimeout(() => {
        setShowContact(false)
        setContactSubject("")
        setContactContent("")
        setContactDone(false)
      }, 2000)
    } catch {
    } finally {
      setContactSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center relative">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>이전</span>
            </button>
            <Link
              href="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-sm font-semibold text-foreground tracking-tight">서간표</span>
            </Link>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="ml-auto h-8 gap-1.5"
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
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">기본 정보</h2>
                  <p className="text-xs text-muted-foreground">학적 정보는 수정할 수 없습니다</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                style={{ color: "#B0232A", borderColor: "#B0232A" }}
                onClick={() => setShowContact(true)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                문의하기
              </Button>
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

      {/* 문의하기 모달 */}
      {showContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowContact(false) }}
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-foreground">문의하기</h3>
              <button
                onClick={() => setShowContact(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {contactDone ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Check className="h-8 w-8" style={{ color: "#B0232A" }} />
                <p className="text-sm text-foreground font-medium">문의가 접수되었습니다</p>
                <p className="text-xs text-muted-foreground">빠른 시일 내에 답변 드리겠습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">제목</label>
                  <Input
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="문의 제목을 입력하세요"
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">내용</label>
                  <textarea
                    value={contactContent}
                    onChange={(e) => setContactContent(e.target.value)}
                    placeholder="문의 내용을 입력하세요"
                    rows={5}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
                <Button
                  onClick={handleContactSubmit}
                  disabled={contactSending || !contactSubject.trim() || !contactContent.trim()}
                  className="w-full h-9 text-sm"
                  style={{ backgroundColor: "#B0232A" }}
                >
                  {contactSending ? "전송 중..." : "제출하기"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
