"use client";

// ─── 외부 라이브러리 ───────────────────────────────────────────────────────────
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    BookOpen,
    UserCircle,
    FileText,
    Clock,
    FlaskConical,
    Mail,
    Globe,
    Microscope,
    Sparkles,
} from "lucide-react";

// ─── 내부 모듈 ────────────────────────────────────────────────────────────────
import { getCurrentSemester } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { coursesApi } from "@/lib/api";
import type { Course } from "@/types";

// ─── AI 연구분야 요약 카드 ────────────────────────────────────────────────────
// 왼→오른 reveal 애니메이션 + 흐르는 그라디언트 테두리
function ResearchAreaCard({ summary }: { summary: string }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 30);
        return () => clearTimeout(t);
    }, [summary]);

    return (
        <>
            <style>{`
        @keyframes ai-border-flow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ai-reveal {
          from { clip-path: inset(0 100% 0 0 round 8px); }
          to   { clip-path: inset(0 0% 0 0 round 8px); }
        }
        .ai-border-wrap {
          background: linear-gradient(90deg, #7c3aed, #a855f7, #6366f1, #a855f7, #7c3aed);
          background-size: 300% 300%;
          animation: ai-border-flow 3s ease infinite;
        }
        .ai-card-reveal {
          animation: ai-reveal 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
            <div
                className={
                    visible
                        ? "ai-card-reveal mt-2 rounded-lg"
                        : "mt-2 rounded-lg opacity-0"
                }
            >
                <div className="ai-border-wrap rounded-lg p-[2px]">
                    <div className="rounded-lg p-3" style={{ background: "#7c3aed08" }}>
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{
                                    background: "linear-gradient(135deg, #7c3aed22, #a855f722)",
                                    color: "#a855f7",
                                }}
                            >
                                <Sparkles className="h-2.5 w-2.5" />
                                AI 요약
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                                연구분야
                            </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                            {summary}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── 페이지 타입 ──────────────────────────────────────────────────────────────
interface Props {
    params: Promise<{ id: string }>;
}

type Tab = "syllabus" | "professor";

// ─── 메인 페이지 컴포넌트 ─────────────────────────────────────────────────────
export default function CourseDetailPage({ params }: Props) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (
        searchParams.get("tab") === "professor" ? "professor" : "syllabus"
    ) as Tab;

    // ── 상태 ──────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── 데이터 로드 ───────────────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            router.replace("/login");
            return;
        }
        coursesApi
            .get(Number(id))
            .then(setCourse)
            .catch(() => setCourse(null))
            .finally(() => setIsLoading(false));
    }, [id]);

    // URL 쿼리 파라미터로 탭 동기화
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "professor" || tab === "syllabus") setActiveTab(tab);
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-background">

            {/* ── 상단 네비게이션 헤더 ────────────────────────────────────────── */}
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
                        <span className="text-xs text-muted-foreground font-mono">
                            {course?.course_code ?? id}
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">

                {isLoading ? (
                    // 로딩 스켈레톤
                    <div className="flex flex-col gap-6">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                ) : !course ? (
                    // 과목 없음
                    <div className="text-center py-16">
                        <p className="text-sm text-muted-foreground">
                            과목을 찾을 수 없습니다.
                        </p>
                        <Link
                            href="/"
                            className="mt-2 inline-flex items-center gap-1 text-xs hover:underline"
                            style={{ color: "#B0232A" }}
                        >
                            <ArrowLeft className="h-3 w-3" /> 대시보드로 돌아가기
                        </Link>
                    </div>
                ) : (
                    // 과목 상세
                    <div className="flex flex-col gap-8">

                        {/* 과목명 + 메타 정보 (코드, 카테고리, 교수, 시간, 학점) */}
                        <div className="flex flex-col gap-4">
                            <div
                                className="border-l-2 pl-4"
                                style={{ borderColor: "#B0232A" }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="font-mono text-xs font-medium text-muted-foreground tracking-wide uppercase">
                                        {course.course_code}
                                    </span>
                                    {course.course_category && (
                                        <>
                                            <span className="text-border text-muted-foreground/30">·</span>
                                            <span className="text-xs text-muted-foreground">
                                                {course.course_category}
                                            </span>
                                        </>
                                    )}
                                    {course.is_english && (
                                        <span
                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                            style={{
                                                backgroundColor: "#3b82f615",
                                                color: "#3b82f6",
                                            }}
                                        >
                                            영어강의
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-xl font-semibold text-foreground leading-snug">
                                    {course.course_name}
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                {(course.professor?.name || course.professor_id) && (
                                    <div className="flex items-center gap-1.5">
                                        <UserCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span>
                                            {course.professor?.name ??
                                                `교수 ID: ${course.professor_id}`}
                                        </span>
                                    </div>
                                )}
                                {(course.class_days || course.class_start_time) && (
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span>
                                            {[
                                                course.class_days,
                                                course.class_start_time,
                                                course.class_end_time,
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                        </span>
                                    </div>
                                )}
                                {course.credits && (
                                    <span>{course.credits}학점</span>
                                )}
                            </div>
                        </div>

                        {/* ── 탭 네비게이션 (강의계획서 / 교수 및 연구실) ────── */}
                        <div className="flex flex-col gap-6">
                            <div className="flex border-b border-border">
                                <button
                                    onClick={() => setActiveTab("syllabus")}
                                    className={`flex items-center gap-1.5 px-1 pb-2.5 mr-6 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                        activeTab === "syllabus"
                                            ? "border-current text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                    style={
                                        activeTab === "syllabus"
                                            ? { color: "#B0232A", borderColor: "#B0232A" }
                                            : {}
                                    }
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    강의계획서
                                </button>
                                <button
                                    onClick={() => setActiveTab("professor")}
                                    className={`flex items-center gap-1.5 px-1 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                        activeTab === "professor"
                                            ? "border-current text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                    style={
                                        activeTab === "professor"
                                            ? { color: "#B0232A", borderColor: "#B0232A" }
                                            : {}
                                    }
                                >
                                    <BookOpen className="h-3.5 w-3.5" />
                                    교수 및 연구실
                                </button>
                            </div>

                            {/* ── 강의계획서 탭 ──────────────────────────────── */}
                            {activeTab === "syllabus" && (
                                <div className="flex flex-col gap-6">
                                    {/* 필요 역량 / 평가 방식 / 수업 방식 / 키워드 */}
                                    {course.details ? (
                                        <div className="flex flex-col gap-4">
                                            {course.details.required_skills && (
                                                <div className="rounded-md border border-border bg-card p-4">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                        필요 역량
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        {course.details.required_skills}
                                                    </p>
                                                </div>
                                            )}
                                            {course.details.evaluation_method && (
                                                <div className="rounded-md border border-border bg-card p-4">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                        평가 방식
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        {course.details.evaluation_method}
                                                    </p>
                                                </div>
                                            )}
                                            {course.details.teaching_method && (
                                                <div className="rounded-md border border-border bg-card p-4">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                        수업 방식
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        {course.details.teaching_method}
                                                    </p>
                                                </div>
                                            )}
                                            {course.details.keyword && (
                                                <div className="rounded-md border border-border bg-card p-4">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                        키워드
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        {course.details.keyword}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* ── 교수 및 연구실 탭 ──────────────────────────── */}
                            {activeTab === "professor" && (
                                <div className="flex flex-col gap-4">
                                    {course.professor ? (
                                        <div className="rounded-md border border-border bg-card p-5">
                                            {/* 교수 프로필 헤더 */}
                                            <div className="flex items-center gap-3 mb-5">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted flex-shrink-0">
                                                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {course.professor.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        담당 교수
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 세부전공 / 연구실 / 이메일 / 홈페이지 / AI 연구분야 요약 */}
                                            <div className="flex flex-col gap-3">
                                                {course.professor.details?.specialty && (
                                                    <div className="flex items-start gap-2.5">
                                                        <Microscope className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                                                세부전공
                                                            </p>
                                                            <p className="text-sm text-foreground">
                                                                {course.professor.details.specialty}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                {course.professor.lab && (
                                                    <div className="flex items-start gap-2.5">
                                                        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                                                연구실
                                                            </p>
                                                            <p className="text-sm text-foreground">
                                                                {course.professor.lab}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                {course.professor.details?.email && (
                                                    <div className="flex items-start gap-2.5">
                                                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                                                이메일
                                                            </p>
                                                            <a
                                                                href={`mailto:${course.professor.details.email}`}
                                                                className="text-sm hover:underline"
                                                                style={{ color: "#B0232A" }}
                                                            >
                                                                {course.professor.details.email}
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {course.professor.details?.homepage && (
                                                    <div className="flex items-start gap-2.5">
                                                        <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                                                홈페이지
                                                            </p>
                                                            <a
                                                                href={course.professor.details.homepage}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm hover:underline"
                                                                style={{ color: "#B0232A" }}
                                                            >
                                                                {course.professor.details.homepage}
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {course.professor.details?.research_summary && (
                                                    <ResearchAreaCard
                                                        summary={course.professor.details.research_summary}
                                                    />
                                                )}
                                                {!course.professor.lab &&
                                                    !course.professor.details?.email &&
                                                    !course.professor.details?.specialty && (
                                                        <p className="text-xs text-muted-foreground">
                                                            연구실 정보가 등록되지 않았습니다.
                                                        </p>
                                                    )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border border-border bg-muted/30 p-5">
                                            <p className="text-sm text-muted-foreground">
                                                교수 정보가 없습니다.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* ── 푸터 ────────────────────────────────────────────────────────── */}
            <footer className="mt-12 border-t border-border">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
                    <p className="text-xs text-muted-foreground/60 text-center">
                        서간표 - {getCurrentSemester().label}
                    </p>
                </div>
            </footer>
        </div>
    );
}
