"use client"

import { FadeInSection } from "@/components/landing/fade-in-section"
import { Camera, CheckCircle2, ScanLine } from "lucide-react"

export function FeatureOcr() {
  return (
    <section id="feature-ocr" className="bg-background py-40 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <FadeInSection>
            <p
              className="mb-5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#B0232A" }}
            >
              OCR
            </p>
          </FadeInSection>

          <FadeInSection delay={0.08}>
            <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              사진 한 장이면 충분합니다.
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.15}>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              기존 시간표 이미지를 업로드하면 자동으로 분석합니다. 직접 입력할 필요가 없어요.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.22} className="mt-16 w-full flex justify-center">
            <div className="relative w-64">
              <div className="relative mx-auto w-64 rounded-[2.5rem] border-[3px] border-foreground/10 bg-card shadow-sm overflow-hidden aspect-[9/16] flex flex-col">
                <div className="flex items-center justify-between px-6 py-3 text-[10px] text-muted-foreground">
                  <span>9:41</span>
                  <div className="flex gap-1 items-center">
                    <span>●●●</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2 border-b border-border">
                  <Camera className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">시간표 불러오기</span>
                </div>

                <div className="mx-4 mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 py-8 gap-3">
                  <ScanLine className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground text-center px-2">사진을 업로드하거나<br />카메라로 촬영하세요</span>
                </div>

                <div className="px-4 mt-4 space-y-2">
                  {[
                    "CSE3013 컴퓨터구조론 | 월 9:00",
                    "CSE3022 데이터베이스 | 화 13:00",
                    "CSE3027 인공지능 | 수 10:30",
                  ].map((course, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-[11px] font-medium text-foreground">{course}</span>
                    </div>
                  ))}
                </div>

                <div className="mx-4 mt-4">
                  <div className="rounded-full bg-foreground py-2.5 text-center text-xs font-semibold text-background">
                    시간표 완성하기
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
