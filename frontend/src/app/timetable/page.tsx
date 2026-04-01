"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, CheckCircle, GraduationCap, FileImage, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

const START_YEAR = 2020
const SEMESTERS = [1, 2] as const

export default function TimetablePage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [uploadCount, setUploadCount] = useState(0)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [uploaded, setUploaded] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) router.replace("/login")
  }, [router])

  const slotKey = (year: number, semester: number) => `${year}-${semester}`

  const handleFileSelect = async (year: number, semester: number, file: File) => {
    const key = slotKey(year, semester)
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["jpg", "jpeg", "png"].includes(ext ?? "")) return

    setUploading(prev => ({ ...prev, [key]: true }))
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("year", String(year))
      formData.append("semester", String(semester))

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${BASE_URL}/upload/course-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (res.status === 202 || res.ok) {
        setUploaded(prev => ({ ...prev, [key]: file.name }))
        setUploadCount(prev => prev + 1)
        localStorage.setItem("ocrPending", JSON.stringify({ ts: Date.now() }))
      }
    } catch (e) {
      console.error("Upload error:", e)
    } finally {
      setUploading(prev => ({ ...prev, [key]: false }))
      const ref = inputRefs.current[key]
      if (ref) ref.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>대시보드</span>
            </Link>
            <span className="text-border text-muted-foreground/40">/</span>
            <span className="text-xs text-foreground font-medium">시간표 인식</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground">시간표 업로드</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              학년도를 선택하고 해당 학기의 시간표 이미지를 업로드하세요.
            </p>
          </div>

          {/* Year scroll bar */}
          <div className="flex overflow-x-auto gap-2 pb-1" style={{ scrollbarWidth: "thin" }}>
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`flex-shrink-0 px-8 py-2.5 rounded text-sm font-semibold transition-colors ${
                  selectedYear === year
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                style={selectedYear === year ? { backgroundColor: "#B0232A" } : {}}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Semester upload slots */}
          <div className="grid grid-cols-2 gap-6">
            {SEMESTERS.map(semester => {
              const key = slotKey(selectedYear, semester)
              const isUploading = uploading[key] ?? false
              const isUploaded = !!uploaded[key]

              return (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex justify-center">
                    <span
                      className="px-6 py-1.5 rounded text-sm font-medium text-foreground"
                      style={{ backgroundColor: "#fecaca" }}
                    >
                      {semester}학기
                    </span>
                  </div>

                  <div
                    className={`relative flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                      isUploaded
                        ? "border-green-400 bg-green-50/20"
                        : isUploading
                        ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                        : "border-border bg-muted/40 hover:border-[#B0232A] hover:bg-muted/60 cursor-pointer"
                    }`}
                    style={{ aspectRatio: "4/3" }}
                    onClick={() => !isUploading && !isUploaded && inputRefs.current[key]?.click()}
                  >
                    {isUploading ? (
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                    ) : isUploaded ? (
                      <div className="flex flex-col items-center gap-2 px-4 text-center">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <span className="text-xs text-muted-foreground line-clamp-2">{uploaded[key]}</span>
                        <span className="text-xs font-medium text-green-600">업로드 완료</span>
                        <button
                          className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          onClick={e => {
                            e.stopPropagation()
                            setUploaded(prev => { const n = { ...prev }; delete n[key]; return n })
                          }}
                        >
                          다시 업로드
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center px-4">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">이미지 업로드</span>
                      </div>
                    )}

                    <input
                      ref={el => { inputRefs.current[key] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(selectedYear, semester, file)
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Upload count notification */}
          {uploadCount > 0 && (
            <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  총 <span className="font-bold">{uploadCount}개</span>의 시간표가 업로드 되었습니다.
                </p>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                백그라운드에서 과목을 인식 중입니다. 이수 현황 페이지에서 결과를 확인하세요.
              </p>
              <Button
                asChild
                className="w-full h-10"
                style={{ backgroundColor: "#B0232A" }}
              >
                <Link href="/graduation" className="flex items-center justify-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  이수 현황 보러가기
                </Link>
              </Button>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">업로드 안내</h3>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <FileImage className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#B0232A" }} />
                <span>학교 포털에서 해당 학기 시간표 전체 화면을 캡처해주세요.</span>
              </li>
              <li className="flex items-start gap-2">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#B0232A" }} />
                <span>과목 코드와 과목명이 명확히 보여야 정확한 인식이 가능합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#B0232A" }} />
                <span>인식 결과는 졸업요건 확인 및 수강 계획에 활용됩니다.</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            CourseScope - 2026년 1학기
          </p>
        </div>
      </footer>
    </div>
  )
}
