"use client"

import { FadeInSection } from "@/components/landing/fade-in-section"
import { FileText, FlaskConical, Sparkles } from "lucide-react"

export function FeatureAi() {
  return (
    <section className="bg-secondary/30 py-40 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <FadeInSection>
            <p
              className="mb-5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#B0232A" }}
            >
              AI SUMMARY
            </p>
          </FadeInSection>

          <FadeInSection delay={0.08}>
            <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              긴 강의계획서 대신,<br />핵심만 한눈에.
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.15}>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              강의계획서와 교수 연구분야를 AI가 자동으로 요약해 보여줍니다.
            </p>
          </FadeInSection>

          {/* 두 개의 요약 카드 */}
          <FadeInSection delay={0.22} className="mt-16 w-full">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

              {/* 1. 강의계획서 요약 카드 */}
              <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <FileText className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-sm font-semibold text-foreground">강의계획서 요약</span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    AI 생성
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-semibold text-foreground">CSE4022 오픈소스 SW 개발</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">데이터관리 · DevOps</p>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">개요</p>
                    <p className="mt-1 leading-relaxed text-foreground/90">
                      Git·GitHub 협업, CI/CD 파이프라인, 오픈소스 프로젝트 기여를 실습 중심으로 배웁니다.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">평가</p>
                    <p className="mt-1 leading-relaxed text-foreground/90">
                      팀 프로젝트 50% · 발표 30% · 출석 20%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">추천 대상</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {["DevOps 진로", "팀 프로젝트 선호", "실무형 학습"].map((t) => (
                        <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 교수 연구 분석 카드 */}
              <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <FlaskConical className="h-4 w-4" style={{ color: "#B0232A" }} />
                  <span className="text-sm font-semibold text-foreground">교수 연구 분석</span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    AI 생성
                  </span>
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
                    김
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground">김민준 교수</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">데이터지능 연구실 (DI Lab)</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">주요 연구분야</p>
                    <p className="mt-1 leading-relaxed text-foreground/90">
                      대규모 언어 모델의 효율적 추론, 분산 학습 시스템, 그래프 신경망 기반 추천.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">최근 키워드</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {["LLM Inference", "Distributed Training", "GNN Recommendation"].map((t) => (
                        <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  )
}
