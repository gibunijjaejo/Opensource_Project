"use client"

import { useState, useEffect, useRef } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, GraduationCap, CheckCircle2, BookOpen, Clock,
  Loader2, Plus, Pencil, Trash2, X, Search, RotateCcw,
} from "lucide-react"
import { historyApi, coursesApi } from "@/lib/api"
import type { HistoryItem, Course } from "@/types"

const OCR_PENDING_KEY = "ocrPending"
const OCR_TIMEOUT_MS = 5 * 60 * 1000

type SemesterGroup = {
  year: number | null
  semester: number | null
  items: HistoryItem[]
}

type ModalState = {
  mode: "add" | "edit"
  historyId?: number
  year: number | null
  semester: number | null
  initIsRetake?: boolean
}

export default function GraduationPage() {
  const router = useRouter()
  const [histories, setHistories] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [ocrPending, setOcrPending] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialCountRef = useRef<number>(0)

  // ── 모달 상태 ──────────────────────────────────────────
  const [modal, setModal] = useState<ModalState | null>(null)
  const [modalCourses, setModalCourses] = useState<Course[]>([])
  const [modalSearch, setModalSearch] = useState("")
  const [modalSelected, setModalSelected] = useState<Course | null>(null)
  const [modalIsRetake, setModalIsRetake] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)

  // ── 삭제 확인 상태 ─────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // ── 초기 로드 + OCR 폴링 ───────────────────────────────
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

  // ── 모달 열릴 때 과목 목록 로드 ───────────────────────
  useEffect(() => {
    if (!modal) return
    setModalSearch("")
    setModalSelected(null)
    setModalIsRetake(modal.initIsRetake ?? false)
    setModalLoading(true)

    const params: { year?: number; semester?: number } = {}
    if (modal.year != null) params.year = modal.year
    if (modal.semester != null) params.semester = modal.semester

    coursesApi
      .list(params)
      .then(setModalCourses)
      .catch(() => setModalCourses([]))
      .finally(() => setModalLoading(false))
  }, [modal])

  // ── 모달 저장 ──────────────────────────────────────────
  const handleModalSave = async () => {
    if (!modal || !modalSelected || modalSaving) return
    setModalSaving(true)
    try {
      if (modal.mode === "edit" && modal.historyId != null) {
        await historyApi.remove(modal.historyId)
      }
      await historyApi.add({
        course_code: modalSelected.course_code,
        year: modal.year ?? new Date().getFullYear(),
        semester: modal.semester ?? 1,
        is_retake: modalIsRetake,
      })
      const fresh = await historyApi.getMyHistories()
      setHistories(fresh)
      setModal(null)
    } catch (e) {
      console.error(e)
    } finally {
      setModalSaving(false)
    }
  }

  // ── 삭제 ──────────────────────────────────────────────
  const handleDelete = async (historyId: number) => {
    try {
      await historyApi.remove(historyId)
      setHistories((prev: HistoryItem[]) => prev.filter((h: HistoryItem) => h.id !== historyId))
    } catch (e) {
      console.error(e)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  // ── 그룹핑 ────────────────────────────────────────────
  const totalCredits = histories.reduce(
    (sum: number, h: HistoryItem) => sum + (h.course?.credits ?? 3),
    0
  )

  const groupMap = histories.reduce((acc: Record<string, SemesterGroup>, h: HistoryItem) => {
    const key = `${h.year ?? "null"}-${h.semester ?? "null"}`
    if (!acc[key]) acc[key] = { year: h.year, semester: h.semester, items: [] }
    acc[key].items.push(h)
    return acc
  }, {} as Record<string, SemesterGroup>)

  const semesterGroups: SemesterGroup[] = (Object.values(groupMap) as SemesterGroup[]).sort(
    (a: SemesterGroup, b: SemesterGroup) => {
      if (a.year === null) return 1
      if (b.year === null) return -1
      if (a.year !== b.year) return a.year - b.year
      if (a.semester === null) return 1
      if (b.semester === null) return -1
      return a.semester - b.semester
    }
  )

  // ── 모달 과목 필터 ─────────────────────────────────────
  const filtered = modalSearch.trim()
    ? modalCourses.filter(
        (c: Course) =>
          c.course_name.includes(modalSearch) ||
          c.course_code.toLowerCase().includes(modalSearch.toLowerCase())
      )
    : modalCourses

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
            <span className="text-xs text-foreground font-medium">전공 수업 이수 현황</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-8">
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              나의 전공 수업 이수 현황
              <GraduationCap className="h-5 w-5" style={{ color: "#B0232A" }} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              지금까지 이수한 전공 수업 과목과 총 학점을 확인하세요.
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
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  총 이수 학점
                </span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {totalCredits}{" "}
                <span className="text-sm font-normal text-muted-foreground">학점</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4" style={{ color: "#B0232A" }} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  이수 과목 수
                </span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {histories.length}{" "}
                <span className="text-sm font-normal text-muted-foreground">과목</span>
              </p>
            </div>
          </div>

          {/* History List */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 px-1">상세 이수 내역</h2>
            {isLoading ? (
              <div className="rounded-lg border border-border bg-card py-20 text-center text-sm text-muted-foreground">
                로딩 중...
              </div>
            ) : histories.length === 0 ? (
              <div className="rounded-lg border border-border bg-card py-20 text-center text-sm text-muted-foreground">
                이수 내역이 없습니다. 시간표를 업로드해보세요!
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {semesterGroups.map((group, idx) => (
                  <div
                    key={`${group.year}-${group.semester}`}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    {/* 학기 헤더 */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {idx + 1}학기
                        </span>
                        {group.year && group.semester && (
                          <span className="text-xs text-muted-foreground">
                            ({group.year}년 {group.semester}학기)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {group.items.reduce((s, h) => s + (h.course?.credits ?? 3), 0)}학점 ·{" "}
                          {group.items.length}과목
                        </span>
                        <button
                          onClick={() =>
                            setModal({
                              mode: "add",
                              year: group.year,
                              semester: group.semester,
                            })
                          }
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-2 py-0.5 hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                          추가
                        </button>
                      </div>
                    </div>

                    {/* 과목 목록 */}
                    <div className="divide-y divide-border">
                      {group.items.map((h: HistoryItem) => (
                        <div
                          key={h.id}
                          className="px-4 py-2.5 hover:bg-muted/20 transition-colors"
                        >
                          {/* 1줄 레이아웃: 과목정보 | 버튼 */}
                          <div className="flex items-center gap-2 min-w-0">
                            {/* 과목명 */}
                            <span className="text-sm font-medium text-foreground truncate min-w-0 flex-shrink">
                              {h.course?.course_name || "알 수 없는 과목"}
                            </span>
                            {/* 과목코드 */}
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                              {h.course_code}
                            </span>
                            {/* 학점 */}
                            <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {h.course?.credits ?? 3}학점
                            </span>
                            {/* 카테고리 */}
                            {h.course?.course_category && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline">
                                {h.course.course_category}
                              </span>
                            )}
                            {/* 재수강 */}
                            {h.is_retake && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex-shrink-0">
                                재수강
                              </span>
                            )}

                            {/* 수정/삭제 버튼 (오른쪽 끝) */}
                            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                              {confirmDeleteId === h.id ? (
                                <>
                                  <button
                                    onClick={() => handleDelete(h.id)}
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    삭제확인
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border transition-colors"
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      setModal({
                                        mode: "edit",
                                        historyId: h.id,
                                        year: h.year,
                                        semester: h.semester,
                                        initIsRetake: h.is_retake,
                                      })
                                    }
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 rounded transition-colors border border-border"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    수정
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(h.id)}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors border border-border"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    삭제
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            서간표 - {getCurrentSemester().label}
          </p>
        </div>
      </footer>

      {/* ── 과목 선택 모달 ───────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => e.target === e.currentTarget && !modalSaving && setModal(null)}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl flex flex-col max-h-[85vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {modal.mode === "add" ? "과목 추가" : "과목 수정"}
                </h3>
                {modal.year && modal.semester && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modal.year}년 {modal.semester}학기
                  </p>
                )}
              </div>
              <button
                onClick={() => !modalSaving && setModal(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 검색 */}
            <div className="px-5 py-3 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="과목명 또는 과목코드 검색"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[#B0232A]"
                  autoFocus
                />
              </div>
            </div>

            {/* 과목 목록 */}
            <div className="flex-1 overflow-y-auto">
              {modalLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>과목 목록 로딩 중...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {modalSearch ? "검색 결과가 없습니다." : "해당 학기 과목이 없습니다."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((course) => {
                    const isSelected = modalSelected?.course_id === course.course_id
                    return (
                      <button
                        key={course.course_id}
                        onClick={() => setModalSelected(isSelected ? null : course)}
                        className={`w-full text-left px-5 py-3 transition-colors hover:bg-muted/40 ${
                          isSelected ? "bg-red-50 border-l-2 border-l-[#B0232A]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isSelected ? "text-[#B0232A]" : "text-foreground"
                              }`}
                            >
                              {course.course_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono text-muted-foreground">
                                {course.course_code}
                              </span>
                              {course.professor?.name && (
                                <span className="text-xs text-muted-foreground">
                                  {course.professor.name}
                                </span>
                              )}
                              {course.course_category && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                  {course.course_category}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {course.credits ?? 3}학점
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 재수강 토글 + 저장 */}
            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={modalIsRetake}
                  onClick={() => setModalIsRetake((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
                    modalIsRetake ? "bg-amber-400" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      modalIsRetake ? "translate-x-4" : ""
                    }`}
                  />
                </button>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  재수강
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => !modalSaving && setModal(null)}
                  className="flex-1 h-9 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  disabled={modalSaving}
                >
                  취소
                </button>
                <button
                  onClick={handleModalSave}
                  disabled={!modalSelected || modalSaving}
                  className="flex-1 h-9 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#B0232A" }}
                >
                  {modalSaving ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      저장 중
                    </span>
                  ) : (
                    modal.mode === "add" ? "추가" : "수정 완료"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
