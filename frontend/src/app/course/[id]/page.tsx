"use client"

import { use, useState, useEffect } from "react"
import { getCurrentSemester } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, BookOpen, UserCircle, FileText, Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { coursesApi } from "@/lib/api"
import type { Course } from "@/types"

interface Props {
  params: Promise<{ id: string }>
}

type Tab = "syllabus" | "professor"

export default function CourseDetailPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") === "professor" ? "professor" : "syllabus") as Tab
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
      return
    }
    coursesApi.list({ q: id })
      .then((data) => {
        const found = data.find((c) => c.course_code === id) ?? data[0] ?? null
        setCourse(found)
      })
      .catch(() => setCourse(null))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "professor" || tab === "syllabus") setActiveTab(tab)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <span className="text-xs text-muted-foreground font-mono">{id}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : !course ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">과목을 찾을 수 없습니다.</p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center gap-1 text-xs hover:underline"
              style={{ color: "#B0232A" }}
            >
              <ArrowLeft className="h-3 w-3" /> 대시보드로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Course Header */}
            <div className="flex flex-col gap-4">
              <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-medium text-muted-foreground tracking-wide uppercase">
                    {course.course_code}
                  </span>
                  {course.course_category && (
                    <>
                      <span className="text-border text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground">{course.course_category}</span>
                    </>
                  )}
                  {course.is_english && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "#3b82f615", color: "#3b82f6" }}
                    >
                      영어강의
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-semibold text-foreground leading-snug">
                  {course.course_name}
                </h1>
              </div>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {(course.professor?.name || course.professor_id) && (
                  <div className="flex items-center gap-1.5">
                    <UserCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{course.professor?.name ?? `교수 ID: ${course.professor_id}`}</span>
                  </div>
                )}
                {(course.class_days || course.class_start_time) && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {[course.class_days, course.class_start_time, course.class_end_time]
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

            {/* Tabs */}
            <div className="flex flex-col gap-6">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab("syllabus")}
                  className={`flex items-center gap-1.5 px-1 pb-2.5 mr-6 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === "syllabus"
                      ? "border-current text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  style={activeTab === "syllabus" ? { color: "#B0232A", borderColor: "#B0232A" } : {}}
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
                  style={activeTab === "professor" ? { color: "#B0232A", borderColor: "#B0232A" } : {}}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  교수 및 연구실
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "syllabus" && (
                <div className="flex flex-col gap-6">
                  {/* DB에 있는 정보 표시 */}
                  {course.details ? (
                    <div className="flex flex-col gap-4">
                      {course.details.required_skills && (
                        <div className="rounded-md border border-border bg-card p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">필요 역량</p>
                          <p className="text-sm text-foreground">{course.details.required_skills}</p>
                        </div>
                      )}
                      {course.details.evaluation_method && (
                        <div className="rounded-md border border-border bg-card p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">평가 방식</p>
                          <p className="text-sm text-foreground">{course.details.evaluation_method}</p>
                        </div>
                      )}
                      {course.details.teaching_method && (
                        <div className="rounded-md border border-border bg-card p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">수업 방식</p>
                          <p className="text-sm text-foreground">{course.details.teaching_method}</p>
                        </div>
                      )}
                      {course.details.keyword && (
                        <div className="rounded-md border border-border bg-card p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">키워드</p>
                          <p className="text-sm text-foreground">{course.details.keyword}</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* 주차별 계획 — 미구현 skeleton */}
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">주차별 강의 계획</p>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">상세 강의계획서 준비 중입니다.</p>
                  </div>
                </div>
              )}

              {activeTab === "professor" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-4/6" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">교수 프로필 정보 준비 중입니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
