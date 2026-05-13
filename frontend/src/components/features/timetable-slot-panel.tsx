"use client"

import { useState, useMemo, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Calendar, Columns3, Loader2, Pin, PinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimetableGrid } from "@/components/features/timetable-grid"
import { CompareModal } from "@/components/features/compare-modal"
import { timetablesApi, type SlotChar, type Timetable, SLOT_LABELS } from "@/lib/api"
import type { Course as ApiCourse } from "@/types"
import type { Course } from "@/lib/constants/course-data"

const SLOTS: SlotChar[] = ["A", "B", "C", "D"]
const PINNED_SLOT_KEY = "timetable_pinned_slot"

// 슬롯 고정/해제 시 보여줄 슬롯별 문구 (재미용)
const PIN_MESSAGES: Record<SlotChar, string> = {
    A: "퀸민디가 좋아서 춤을 춥니다.",
    B: "마여니가 웃다가 넘어집니다.",
    C: "힝우행우가 당신께 랩을 바칩니다.",
    D: "유화니가 뭐 먹고 싶은지 물어봅니다.",
}

const UNPIN_MESSAGES: Record<SlotChar, string> = {
    A: "퀸민디는 사실 몸치였습니다.",
    B: "마여니는 굴러서 당신을 피해 달아납니다.",
    C: "힝우행우가 부른 랩은 실은 디스랩이었습니다.",
    D: "유화니가 배민 주문을 다시 취소합니다.",
}

// 서간표 컬러 (#B0232A) 그라데이션 — 슬롯 고정/해제 toast 전용 스타일.
// 흰 배경에서 잘 안 보이던 문제 해결 + 브랜드 컬러 일관성.
const SLOT_TOAST_STYLE: React.CSSProperties = {
    background: "linear-gradient(135deg, #B0232A 0%, #8A1820 100%)",
    color: "#FFFFFF",
    border: "none",
    fontSize: "14px",
    fontWeight: 600,
    padding: "16px 20px",
    boxShadow: "0 10px 30px rgba(176, 35, 42, 0.35)",
}

interface TimetableSlotPanelProps {
    /** 부모(dashboard)가 fetch 한 4 슬롯 데이터 (없으면 빈 배열) */
    timetables: Timetable[]
    /** fetch 진행 중 여부 (로딩 표시용) */
    isLoading?: boolean
    /** API Course → 화면용 Course 변환 (TimetableGrid 가 받는 형태로) */
    mapApiCourse: (c: ApiCourse) => Course
}

/**
 * 4 슬롯 시간표 패널 — 핀(고정) / 시간표 비교 모달 트리거.
 *
 * 고정 슬롯은 localStorage 에 저장되어 페이지 재진입 시 자동 활성화.
 * 슬롯 본문은 시간표 그리드 한 개만 (강의 리스트·추가 UI 는 BrowseCourses 쪽으로 분리).
 */
export function TimetableSlotPanel({ timetables, isLoading, mapApiCourse }: TimetableSlotPanelProps) {
    const queryClient = useQueryClient()
    const [activeSlot, setActiveSlot] = useState<SlotChar>("A")
    const [pinnedSlot, setPinnedSlot] = useState<SlotChar | null>(null)
    const [compareOpen, setCompareOpen] = useState(false)

    // 시간표 블록 클릭 → ✕ 클릭 시 해당 슬롯에서 강의 제거
    const removeFromActiveSlot = async (courseId: string) => {
        try {
            await timetablesApi.removeCourse(activeSlot, Number(courseId))
            // 캐시 무효화 → dashboard 의 useQuery 가 자동 refetch
            queryClient.invalidateQueries({ queryKey: ["timetables"] })
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error(`removeFromActiveSlot(${activeSlot}, ${courseId}) 실패:`, e)
            alert(`${SLOT_LABELS[activeSlot]} 에서 제거 실패\n${msg}`)
        }
    }

    // 페이지 진입 시 localStorage 에서 고정 슬롯 복원
    useEffect(() => {
        if (typeof window === "undefined") return
        const stored = window.localStorage.getItem(PINNED_SLOT_KEY)
        if (stored && SLOTS.includes(stored as SlotChar)) {
            setPinnedSlot(stored as SlotChar)
            setActiveSlot(stored as SlotChar)
        }
    }, [])

    const togglePin = () => {
        if (pinnedSlot === activeSlot) {
            // 이미 이 슬롯이 고정됨 → 해제
            setPinnedSlot(null)
            window.localStorage.removeItem(PINNED_SLOT_KEY)
            toast(UNPIN_MESSAGES[activeSlot], { style: SLOT_TOAST_STYLE })
        } else {
            setPinnedSlot(activeSlot)
            window.localStorage.setItem(PINNED_SLOT_KEY, activeSlot)
            toast(PIN_MESSAGES[activeSlot], { style: SLOT_TOAST_STYLE })
        }
    }

    const activeTimetable = useMemo<Timetable | null>(
        () => timetables.find((t) => t.slot === activeSlot) ?? null,
        [timetables, activeSlot],
    )

    const slotCourses = useMemo<Course[]>(() => {
        if (!activeTimetable) return []
        return activeTimetable.courses
            .filter((c) => c.course)
            .map((c) => mapApiCourse(c.course!))
    }, [activeTimetable, mapApiCourse])

    const slotCountMap = useMemo(() => {
        const m: Record<SlotChar, number> = { A: 0, B: 0, C: 0, D: 0 }
        for (const t of timetables) m[t.slot] = t.courses.length
        return m
    }, [timetables])

    const isPinned = pinnedSlot === activeSlot

    return (
        <section className="rounded-lg border border-border bg-card p-5">
            {/* 헤더 — 다른 섹션과 동일한 패턴 (아이콘 + 제목 + 부제 + 액션) */}
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: "#B0232A" }} />
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">내 시간표</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                            슬롯을 고정하면 다음 방문 시 자동 선택됩니다
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setCompareOpen(true)}
                    className="h-8 gap-1.5 text-xs flex-shrink-0"
                    style={{ backgroundColor: "#B0232A" }}
                >
                    <Columns3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">시간표 비교</span>
                    <span className="sm:hidden">비교</span>
                </Button>
            </div>

            {/* 슬롯 탭 + 고정 버튼 */}
            <div className="mb-4 flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                    {SLOTS.map((s) => {
                        const pinned = pinnedSlot === s
                        const active = activeSlot === s
                        return (
                            <button
                                key={s}
                                onClick={() => setActiveSlot(s)}
                                className={`px-3 h-8 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    active
                                        ? "text-white"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                                style={active ? { backgroundColor: "#B0232A" } : {}}
                                title={pinned ? `${SLOT_LABELS[s]} 슬롯은 고정됨` : ""}
                            >
                                <span className="font-semibold">{SLOT_LABELS[s]}</span>
                                {pinned && <Pin className="h-3 w-3" />}
                                <span className="text-[10px] opacity-75">
                                    ({slotCountMap[s]})
                                </span>
                            </button>
                        )
                    })}
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={togglePin}
                    className="h-8 gap-1.5 text-xs"
                    title={isPinned ? `${SLOT_LABELS[activeSlot]} 고정 해제` : `${SLOT_LABELS[activeSlot]} 고정 (다음 방문 시 자동 선택)`}
                >
                    {isPinned ? (
                        <>
                            <PinOff className="h-3 w-3" />
                            <span className="hidden sm:inline">고정 해제</span>
                            <span className="sm:hidden">해제</span>
                        </>
                    ) : (
                        <>
                            <Pin className="h-3 w-3" />
                            <span className="hidden sm:inline">이 슬롯 고정</span>
                            <span className="sm:hidden">고정</span>
                        </>
                    )}
                </Button>
            </div>

            {/* 활성 슬롯 시간표 그리드 — 블록 클릭 시 ✕ 제거 버튼 노출 */}
            {isLoading ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">슬롯 불러오는 중...</p>
                </div>
            ) : (
                <TimetableGrid courses={slotCourses} onRemoveCourse={removeFromActiveSlot} />
            )}

            {/* 슬롯 안내 */}
            <p className="mt-3 text-[11px] text-muted-foreground/70">
                💡 시간표의 강의를 누르면 제거 버튼이 나옵니다.
            </p>

            {/* 비교 모달 */}
            <CompareModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                timetables={timetables}
                mapApiCourse={mapApiCourse}
            />
        </section>
    )
}
