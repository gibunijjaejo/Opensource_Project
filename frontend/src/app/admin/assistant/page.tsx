"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send, Sparkles, Wrench, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  adminApi,
  AssistantMessage,
  AssistantToolCall,
  AssistantToolMeta,
} from "@/lib/api"

type ChatTurn =
  | { role: "user"; content: string }
  | {
      role: "model"
      content: string
      tool_calls: AssistantToolCall[]
      iterations: number
      model: string
      latency_ms: number
    }

const SUGGESTED_QUESTIONS = [
  "2026-1학기에 가장 많이 들은 과목 TOP 5 알려줘",
  "지난 7일 AI 평가 실패 원인 분포 보여줘",
  "2026-1학기 수강이력에 한 번도 안 잡힌 과목 10개만 보여줘 (OCR 매칭 실패 후보)",
  "지금 떠있는 컨테이너 상태와 메모리 사용률 알려줘",
]

export default function AdminAssistantPage() {
  const router = useRouter()
  const [tools, setTools] = useState<AssistantToolMeta[]>([])
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [expandedToolGroup, setExpandedToolGroup] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof document !== "undefined") {
      const hasToken = /admin_token=/.test(document.cookie)
      if (!hasToken) {
        router.replace("/admin/login")
        return
      }
    }
    adminApi
      .listAssistantTools()
      .then(setTools)
      .catch((e) => setError(e.message))
  }, [router])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns, pending])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return

    setError("")
    const userTurn: ChatTurn = { role: "user", content: trimmed }
    const nextTurns = [...turns, userTurn]
    setTurns(nextTurns)
    setInput("")
    setPending(true)

    const history: AssistantMessage[] = nextTurns
      .slice(0, -1)
      .map((t) =>
        t.role === "user"
          ? { role: "user", content: t.content }
          : { role: "model", content: t.content }
      )

    const t0 = performance.now()
    try {
      const res = await adminApi.askAssistant(trimmed, history)
      const latency_ms = Math.round(performance.now() - t0)
      setTurns([
        ...nextTurns,
        {
          role: "model",
          content: res.answer,
          tool_calls: res.tool_calls,
          iterations: res.iterations,
          model: res.model,
          latency_ms,
        },
      ])
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#B0232A" }} />
          운영 어시스턴트
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          서비스 데이터 + Prometheus/Docker를 자연어로 질의합니다. (도구 {tools.length}개 사용 가능)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* 챗 영역 */}
        <div className="rounded-lg border border-border bg-card flex flex-col" style={{ height: "70vh" }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {turns.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>아래 추천 질문 중 하나로 시작하거나 직접 입력해보세요.</p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    turn.role === "user"
                      ? "bg-[#B0232A] text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {turn.content}

                  {turn.role === "model" && turn.tool_calls.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <button
                        onClick={() => setExpandedToolGroup(expandedToolGroup === i ? null : i)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedToolGroup === i ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <Wrench className="h-3 w-3" />
                        도구 호출 {turn.tool_calls.length}회 · {turn.iterations}턴 · {turn.latency_ms}ms
                      </button>

                      {expandedToolGroup === i && (
                        <div className="mt-2 space-y-2">
                          {turn.tool_calls.map((tc, idx) => (
                            <div key={idx} className="rounded border border-border bg-background p-2 text-[11px] font-mono">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-[#B0232A]">{tc.name}</span>
                                <span className="text-muted-foreground">{tc.duration_ms}ms</span>
                              </div>
                              <details>
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">args</summary>
                                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(tc.args, null, 2)}
                                </pre>
                              </details>
                              <details>
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">result</summary>
                                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all max-h-48">
                                  {JSON.stringify(tc.result, null, 2)}
                                </pre>
                              </details>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  도구를 호출하며 답변 생성 중...
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded p-3">
                오류: {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="border-t border-border p-3 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="자연어로 질문하세요"
              disabled={pending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={pending || !input.trim()}
              size="sm"
              style={{ backgroundColor: "#B0232A" }}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              전송
            </Button>
          </form>
        </div>

        {/* 도구 패널 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            연결된 도구 ({tools.length})
          </p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {tools.map((t) => (
              <div key={t.name} className="text-xs border-b border-border/50 pb-2 last:border-0">
                <div className="font-mono font-semibold text-foreground">{t.name}</div>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>
          {tools.length > 0 && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              DB · Prometheus · Docker 통합 — 운영 데이터를 자연어 한 번으로 횡단 조회.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
