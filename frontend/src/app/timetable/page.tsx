"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, FileImage, CheckCircle, AlertCircle, BookOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { historyApi } from "@/lib/api"
import type { HistoryItem } from "@/types"

type ProcessingState = "idle" | "uploading" | "processing" | "complete" | "error"

export default function TimetablePage() {
  const [state, setState] = useState<ProcessingState>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [histories, setHistories] = useState<HistoryItem[]>([])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const processFile = useCallback(async (file: File) => {
    setUploadedFile(file)
    setState("uploading")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("semester", "1")
      formData.append("year", new Date().getFullYear().toString())

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${BASE_URL}/upload/course-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error("Upload failed:", errorData)
        throw new Error(errorData.detail || "업로드 실패")
      }

      setState("processing")
      const data = await historyApi.getMyHistories().catch(() => [])
      setHistories(data)
      setState("complete")
    } catch {
      setState("error")
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }, [processFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const resetUpload = () => {
    setState("idle")
    setUploadedFile(null)
  }

  const totalCredits = histories.reduce(
    (sum, h) => sum + (h.course?.credits ?? 3),
    0
  )

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
            <span className="text-xs text-foreground font-medium">시간표 인식</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-8">
          {/* Title */}
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground">시간표 업로드</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              시간표 캡처 이미지를 업로드하면 자동으로 수강 과목을 인식합니다.
            </p>
          </div>

          {/* Upload Area */}
          {state === "idle" && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors
                ${dragActive ? "border-primary bg-accent/50" : "border-border bg-muted/30"}
              `}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  시간표 이미지를 드래그하거나 클릭하여 업로드
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, JPEG 형식 지원 (최대 10MB)
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          )}

          {/* Processing States */}
          {(state === "uploading" || state === "processing") && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12">
              <div className="relative">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {state === "uploading" ? "업로드 중..." : "시간표 분석 중..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploadedFile?.name}
                </p>
              </div>
            </div>
          )}

          {/* Complete State */}
          {state === "complete" && (
            <div className="flex flex-col gap-6">
              {/* Success Message */}
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    시간표 인식 완료
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {histories.length}개 과목, 총 {totalCredits}학점이 인식되었습니다.
                  </p>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Recognized Courses */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">인식된 수강 내역</h2>
                  <span className="text-xs text-muted-foreground">
                    {histories.length}개 과목
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">
                          과목코드
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          과목명
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">
                          학기
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {histories.map((h, i) => (
                        <tr
                          key={h.id}
                          className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-medium text-muted-foreground">
                              {h.course_code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium text-foreground">
                              {h.course?.course_name ?? "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-muted-foreground">
                              {h.year && h.semester ? `${h.year}-${h.semester}` : "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">총 이수 학점</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{totalCredits}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">이수 과목 수</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{histories.length}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={resetUpload}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  다시 업로드
                </Button>
                <Button
                  asChild
                  className="flex-1 h-10"
                  style={{ backgroundColor: "#B0232A" }}
                >
                  <Link href="/graduation">
                    졸업요건 확인하기
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-12">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-red-800">인식 실패</p>
                <p className="mt-1 text-xs text-red-600">
                  이미지를 인식할 수 없습니다. 다른 이미지로 시도해주세요.
                </p>
              </div>
              <Button onClick={resetUpload} variant="outline" size="sm">
                다시 시도
              </Button>
            </div>
          )}

          {/* Instructions */}
          {state === "idle" && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">업로드 안내</h3>
              <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <FileImage className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#B0232A" }} />
                  <span>학교 포털에서 시간표 전체 화면을 캡처해주세요.</span>
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
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            CourseScope - 2026년 1학기
          </p>
        </div>
      </footer>
    </div>
  )
}
