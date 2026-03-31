"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, GraduationCap, CheckCircle2, BookOpen, Clock, Loader2 } from "lucide-react"
import { historyApi } from "@/lib/api"
import type { HistoryItem } from "@/types"

const OCR_PENDING_KEY = "ocrPending"
const OCR_TIMEOUT_MS = 5 * 60 * 1000 // 5분

export default function GraduationPage() {
  const router = useRouter()
  const [histories, setHistories] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [ocrPending, setOcrPending] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialCountRef = useRef<number>(0)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
      setIsLoading(false)
      return
    }

    const raw = localStorage.getItem(OCR_PENDING_KEY)

    historyApi
      .getMyHistories()
      .then((data) => {
        setHistories(data)
        setIsLoading(false)

        if (!raw) return

        const { ts } = JSON.parse(raw) as { ts: number }
        if (Date.now() - ts >= OCR_TIMEOUT_MS) {
          localStorage.removeItem(OCR_PENDING_KEY)
          return
        }

        setOcrPending(true)
        initialCountRef.current = data.length

        pollingRef.current = setInterval(() => {
          historyApi
            .getMyHistories()
            .then((fresh) => {
              const elapsed = Date.now() - ts
              if (fresh.length !== initialCountRef.current || elapsed >= OCR_TIMEOUT_MS) {
                setHistories(fresh)
                setOcrPending(false)
                localStorage.removeItem(OCR_PENDING_KEY)
                if (pollingRef.current) clearInterval(pollingRef.current)
              }
            })
            .catch(() => {})
        }, 10_000)
      })
      .catch(() => setIsLoading(false))

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const totalCredits = histories.reduce((sum: number, h: HistoryItem) => sum + (h.course?.credits ?? 3), 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>대시보드</span>
            </Link>
            <span className="text-border text-muted-foreground/40">/</span>
            <span className="text-xs text-foreground font-medium">이수 현황</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-8">
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              나의 이수 현황
              <GraduationCap className="h-5 w-5" style={{ color: "#B0232A" }} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              지금까지 이수한 과목과 총 학점을 확인하세요.
            </p>
          </div>

          {/* OCR 진행 중 배너 */}
          {ocrPending && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                이수 과목 인식 중입니다. 잠시 후 자동으로 반영됩니다.
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">총 이수 학점</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {totalCredits} <span className="text-sm font-normal text-muted-foreground">학점</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4" style={{ color: "#B0232A" }} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">이수 과목 수</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {histories.length} <span className="text-sm font-normal text-muted-foreground">과목</span>
              </p>
            </div>
          </div>

          {/* History List */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 px-1">상세 이수 내역</h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {isLoading ? (
                <div className="py-20 text-center text-sm text-muted-foreground">
                  로딩 중...
                </div>
              ) : histories.length === 0 ? (
                <div className="py-20 text-center text-sm text-muted-foreground">
                  이수 내역이 없습니다. 시간표를 업로드해보세요!
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {histories.map((h: HistoryItem) => (
                    <div key={h.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-sm font-medium text-foreground">
                          {h.course?.course_name || "알 수 없는 과목"}
                        </h3>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {h.course_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{h.year}년 {h.semester}학기</span>
                        </div>
                        <div className="flex items-center gap-1 border-l border-border pl-3">
                          <span>{h.course?.credits ?? 3}학점</span>
                        </div>
                        {h.is_retake && (
                          <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                            재수강
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            CourseScope - Graduation Status
          </p>
        </div>
      </footer>
    </div>
  )
}
