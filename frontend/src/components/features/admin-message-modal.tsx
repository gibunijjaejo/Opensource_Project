"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { messagesApi, AdminMessageItem } from "@/lib/api"

const SKIP_PREFIXES = ["/login", "/signup", "/admin"]

export function AdminMessageModal() {
    const pathname = usePathname()
    const [messages, setMessages] = useState<AdminMessageItem[]>([])
    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (typeof window === "undefined") return
        if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return
        const token = localStorage.getItem("access_token")
        if (!token) return
        messagesApi
            .getUnread()
            .then((data) => {
                if (data.length > 0) {
                    setMessages(data)
                    setIndex(0)
                }
            })
            .catch(() => {})
    }, [pathname])

    if (messages.length === 0) return null
    const current = messages[index]
    if (!current) return null

    const handleClose = async () => {
        try {
            await messagesApi.markRead(current.id)
        } catch {}
        if (index + 1 < messages.length) {
            setIndex(index + 1)
        } else {
            setMessages([])
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" style={{ color: "#B0232A" }} />
                        <h3 className="text-sm font-semibold text-foreground">관리자 메시지</h3>
                        {messages.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                                {index + 1} / {messages.length}
                            </span>
                        )}
                    </div>
                    <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{current.content}</p>
                </div>

                <div className="flex justify-end text-xs text-muted-foreground">
                    <span>{new Date(current.created_at).toLocaleString("ko-KR")}</span>
                </div>

                <div className="flex justify-end">
                    <Button size="sm" className="h-8 text-xs" style={{ backgroundColor: "#B0232A" }} onClick={handleClose}>
                        {index + 1 < messages.length ? "다음" : "확인"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
