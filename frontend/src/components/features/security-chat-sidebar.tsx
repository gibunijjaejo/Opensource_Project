"use client"

import { useEffect, useRef, useState } from "react"
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
  "지금 Critical 몇 건이야?",
  "Python 의존성 High 취약점 알려줘",
  "이번 주에 새로 잡힌 finding 있어?",
  "DefectDojo 연결 상태 점검해줘",
]

export function SecurityChatSidebar() {
  const [tools, setTools] = useState<AssistantToolMeta[]>([])
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [expandedToolGroup, setExpandedToolGroup] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    adminApi
      .listSecurityChatTools()
      .then(setTools)
      .catch((e) => setError(e.message))
  }, [])

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
      const res = await adminApi.askSecurityChat(trimmed, history)
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
    <aside className="rounded-lg border border-border bg-card flex flex-col sticky top-6" style={{ height: "calc(100vh - 8rem)" }}>
      <header className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#B0232A" }} />
          <span className="text-sm font-semibold">보안 AI 어시스턴트</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          DefectDojo 도구 {tools.length}개 사용 가능
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">자연어로 질문하거나 추천 질문을 눌러보세요.</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[92%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed ${
                turn.role === "user"
                  ? "bg-[#B0232A] text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              {turn.content}

              {turn.role === "model" && turn.tool_calls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <button
                    onClick={() => setExpandedToolGroup(expandedToolGroup === i ? null : i)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedToolGroup === i ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Wrench className="h-3 w-3" />
                    도구 {turn.tool_calls.length}회 · {turn.latency_ms}ms
                  </button>

                  {expandedToolGroup === i && (
                    <div className="mt-2 space-y-1.5">
                      {turn.tool_calls.map((tc, idx) => (
                        <div key={idx} className="rounded border border-border bg-background p-1.5 text-[10px] font-mono">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-[#B0232A]">{tc.name}</span>
                            <span className="text-muted-foreground">{tc.duration_ms}ms</span>
                          </div>
                          <details>
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">args/result</summary>
                            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all max-h-40">
                              {JSON.stringify({ args: tc.args, result: tc.result }, null, 2)}
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
            <div className="bg-muted rounded-lg px-3 py-2 text-xs flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              도구 호출 중...
            </div>
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/30 rounded p-2">
            오류: {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="border-t border-border p-2 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="자연어로 질문..."
          disabled={pending}
          className="flex-1 text-xs h-8"
        />
        <Button
          type="submit"
          disabled={pending || !input.trim()}
          size="sm"
          style={{ backgroundColor: "#B0232A" }}
          className="h-8 px-2.5"
        >
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </aside>
  )
}
