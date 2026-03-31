"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, FileImage, BookOpen, CheckCircle, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TimetablePage() {
  const router = useRouter()
  const [dragActive, setDragActive] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
    }
  }, [router])

  const uploadFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase()
      return ["jpg", "jpeg", "png"].includes(ext ?? "")
    })
    if (!valid.length) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      valid.forEach(f => formData.append("files", f))

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${BASE_URL}/upload/course-images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (res.status === 202 || res.ok) {
        const data = await res.json().catch(() => ({}))
        const accepted: number = data.accepted ?? valid.length
        setUploadCount((prev: number) => prev + accepted)
        localStorage.setItem("ocrPending", JSON.stringify({ ts: Date.now() }))
      }
    } catch (e) {
      console.error("Upload error:", e)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) {
      uploadFiles(Array.from(e.dataTransfer.files))
    }
  }, [uploadFiles])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(Array.from(e.target.files))
    }
  }

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
            <span className="text-xs text-foreground font-medium">시간표 인식</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
            <h1 className="text-lg font-semibold text-foreground">시간표 업로드</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              시간표 캡처 이미지를 업로드하면 자동으로 수강 과목을 인식합니다.
            </p>
          </div>

          {/* Upload Area - always visible */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors
              ${dragActive ? "border-primary bg-accent/50" : "border-border bg-muted/30"}
              ${isUploading ? "opacity-60 pointer-events-none" : ""}
            `}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              {isUploading
                ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                : <Upload className="h-6 w-6 text-muted-foreground" />
              }
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {isUploading ? "업로드 중..." : "시간표 이미지를 드래그하거나 클릭하여 업로드"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, JPEG 형식 지원 (최대 10MB) · 여러 장 동시 업로드 가능
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isUploading}
            />
          </div>

          {/* Upload result card */}
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
        </div>
      </main>

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
