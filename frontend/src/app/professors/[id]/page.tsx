"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  UserCircle,
  FlaskConical,
  Mail,
  Globe,
  Microscope,
  Sparkles,
} from "lucide-react"
import { professorsApi } from "@/lib/api"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import type { Professor } from "@/types"

function ResearchAreaCard({ summary }: { summary: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [summary])

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
      <div className={visible ? "ai-card-reveal mt-2 rounded-lg" : "mt-2 rounded-lg opacity-0"}>
        <div className="ai-border-wrap rounded-lg p-[2px]">
          <div className="rounded-lg bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "linear-gradient(135deg, #7c3aed22, #a855f722)", color: "#a855f7" }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI 요약
              </span>
              <span className="text-[10px] text-muted-foreground/70">연구분야</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>
    </>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default function ProfessorDetailPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [professor, setProfessor] = useState<Professor | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
      return
    }
    professorsApi
      .get(Number(id))
      .then(setProfessor)
      .catch(() => setProfessor(null))
      .finally(() => setIsLoading(false))
  }, [id, router])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
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
              <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-xl font-semibold text-foreground tracking-tight font-logo">서간표</span>
            </Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ) : !professor ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">교수를 찾을 수 없습니다.</p>
            <button
              onClick={() => router.back()}
              className="mt-2 inline-flex items-center gap-1 text-xs hover:underline"
              style={{ color: "#B0232A" }}
            >
              <ArrowLeft className="h-3 w-3" /> 이전으로 돌아가기
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card p-5 flex flex-col gap-5">
            {/* 상단: 사원증 + 상세 정보 */}
            <div className="flex gap-5 items-start">
              {/* 사원증 카드 */}
              <div className="flex-shrink-0" style={{ width: 160 }}>
                <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ backgroundColor: "#B1000E" }}>
                    <svg width="20" height="23" viewBox="0 0 28 32" fill="none">
                      <path d="M14 1L1 6V17C1 24 6.5 30 14 32C21.5 30 27 24 27 17V6L14 1Z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
                      <text x="14" y="21" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Georgia, serif">IHS</text>
                    </svg>
                    <div className="leading-none">
                      <p className="font-bold text-white" style={{ fontSize: 8.5, letterSpacing: "0.18em" }}>SOGANG</p>
                      <p className="text-white/80" style={{ fontSize: 7, letterSpacing: "0.25em" }}>UNIVERSITY</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center bg-white py-4" style={{ minHeight: 120 }}>
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.07 }}>
                      <rect x="35" y="5" width="90" height="115" fill="none" stroke="#B1000E" strokeWidth="2"/>
                      <rect x="48" y="13" width="22" height="28" fill="none" stroke="#B1000E" strokeWidth="1.2"/>
                      <rect x="90" y="13" width="22" height="28" fill="none" stroke="#B1000E" strokeWidth="1.2"/>
                      <rect x="40" y="47" width="80" height="78" fill="none" stroke="#B1000E" strokeWidth="1.2"/>
                      <line x1="80" y1="47" x2="80" y2="125" stroke="#B1000E" strokeWidth="0.8"/>
                      <rect x="50" y="58" width="16" height="18" fill="#B1000E"/>
                      <rect x="94" y="58" width="16" height="18" fill="#B1000E"/>
                      <polygon points="80,0 72,5 88,5" fill="none" stroke="#B1000E" strokeWidth="1.2"/>
                      <line x1="35" y1="47" x2="125" y2="47" stroke="#B1000E" strokeWidth="0.8"/>
                    </svg>
                    <div className="relative z-10 flex items-center justify-center border border-gray-300 bg-gray-100" style={{ width: 72, height: 92 }}>
                      <UserCircle className="text-gray-400" style={{ width: 52, height: 52 }} strokeWidth={1.2}/>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 bg-white px-2 py-2.5 text-center">
                    <p className="font-bold text-gray-800" style={{ fontSize: 13, letterSpacing: "0.25em" }}>
                      {professor.name.split("").join(" ")}
                    </p>
                    <p className="text-gray-500 mt-0.5" style={{ fontSize: 9, letterSpacing: "0.1em" }}>교수님</p>
                  </div>

                  <div className="py-1.5 text-center" style={{ backgroundColor: "#B1000E" }}>
                    <p className="font-medium text-white" style={{ fontSize: 7, letterSpacing: "0.22em" }}>SOGANG UNIVERSITY</p>
                  </div>
                </div>
              </div>

              {/* 우측 상세 정보 */}
              <div className="flex flex-col gap-3 flex-1 min-w-0 pt-1">
                {professor.details?.specialty && (
                  <div className="flex items-start gap-2.5">
                    <Microscope className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">세부전공</p>
                      <p className="text-sm text-foreground">{professor.details.specialty}</p>
                    </div>
                  </div>
                )}
                {professor.lab && (
                  <div className="flex items-start gap-2.5">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">연구실</p>
                      <p className="text-sm text-foreground">{professor.lab}</p>
                    </div>
                  </div>
                )}
                {professor.details?.email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">이메일</p>
                      <a href={`mailto:${professor.details.email}`} className="text-sm hover:underline break-all" style={{ color: "#B0232A" }}>
                        {professor.details.email}
                      </a>
                    </div>
                  </div>
                )}
                {professor.details?.homepage && (
                  <div className="flex items-start gap-2.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">홈페이지</p>
                      <a href={professor.details.homepage} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline break-all" style={{ color: "#B0232A" }}>
                        {professor.details.homepage}
                      </a>
                    </div>
                  </div>
                )}
                {!professor.lab && !professor.details?.email && !professor.details?.specialty && !professor.details?.homepage && (
                  <p className="text-xs text-muted-foreground">연구실 정보가 등록되지 않았습니다.</p>
                )}
              </div>
            </div>

            {/* 하단: AI 요약 */}
            {professor.details?.research_summary && (
              <ResearchAreaCard summary={professor.details.research_summary} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
