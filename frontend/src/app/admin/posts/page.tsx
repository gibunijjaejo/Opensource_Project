"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2, ChevronDown, ChevronUp, MessageSquare, Heart, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminApi, AdminPost, AdminPostComment } from "@/lib/api"

function getAdminToken() {
    if (typeof document === "undefined") return null
    const match = document.cookie.match(/admin_token=([^;]+)/)
    return match ? match[1] : null
}

export default function AdminPostsPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>("전체")
    const [posts, setPosts] = useState<AdminPost[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [comments, setComments] = useState<Record<number, AdminPostComment[]>>({})
    const [actionId, setActionId] = useState<number | null>(null)

    useEffect(() => {
        const token = getAdminToken()
        if (!token) { router.replace("/admin/login"); return }
        adminApi.getPostCategories().then(setCategories).catch(() => {})
    }, [router])

    const fetchPosts = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await adminApi.getAllPosts(selectedCategory === "전체" ? undefined : selectedCategory)
            setPosts(data)
        } catch {}
        setIsLoading(false)
    }, [selectedCategory])

    useEffect(() => {
        fetchPosts()
    }, [fetchPosts])

    const toggleExpand = async (post: AdminPost) => {
        if (expandedId === post.id) {
            setExpandedId(null)
            return
        }
        setExpandedId(post.id)
        if (!comments[post.id]) {
            try {
                const data = await adminApi.getPostComments(post.id)
                setComments((prev) => ({ ...prev, [post.id]: data }))
            } catch {}
        }
    }

    const handleDeletePost = async (post: AdminPost) => {
        if (!confirm(`"${post.title}" 게시글을 삭제하시겠습니까?\n댓글도 함께 삭제됩니다.`)) return
        setActionId(post.id)
        try {
            await adminApi.deletePost(post.id)
            setPosts((prev) => prev.filter((p) => p.id !== post.id))
            setExpandedId(null)
            const cats = await adminApi.getPostCategories()
            setCategories(cats)
        } catch (e) {
            alert(e instanceof Error ? e.message : "삭제에 실패했습니다.")
        }
        setActionId(null)
    }

    const handleDeleteComment = async (postId: number, commentId: number) => {
        if (!confirm("이 댓글을 삭제하시겠습니까?")) return
        try {
            await adminApi.deleteComment(commentId)
            setComments((prev) => ({
                ...prev,
                [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
            }))
            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count - 1 } : p))
        } catch (e) {
            alert(e instanceof Error ? e.message : "삭제에 실패했습니다.")
        }
    }

    const totalCount = categories.reduce((s, c) => s + c.count, 0)

    return (
        <div>
            <div className="mb-8 border-l-2 pl-4" style={{ borderColor: "#B0232A" }}>
                <h1 className="text-lg font-bold text-foreground">게시글 관리</h1>
                <p className="mt-1 text-sm text-muted-foreground">게시판별로 게시글과 댓글을 확인하고 삭제합니다.</p>
            </div>

            <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 mb-4 w-fit flex-wrap">
                {[{ category: "전체", count: totalCount }, ...categories].map((c) => {
                    const active = selectedCategory === c.category
                    return (
                        <button
                            key={c.category}
                            onClick={() => setSelectedCategory(c.category)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {c.category}
                            <span
                                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                                    active ? "bg-[#B0232A] text-white" : "bg-muted-foreground/20 text-muted-foreground"
                                }`}
                            >
                                {c.count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중...
                </div>
            ) : posts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-16 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {posts.map((post) => {
                        const expanded = expandedId === post.id
                        const acting = actionId === post.id
                        const postComments = comments[post.id] || []
                        return (
                            <div key={post.id} className="rounded-lg border border-border bg-card overflow-hidden">
                                <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => toggleExpand(post)}
                                >
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                                        {post.category}
                                    </span>
                                    <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{post.title}</span>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                        {post.author_name ?? "탈퇴한 사용자"}
                                    </span>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                                        <span className="inline-flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" /> {post.comment_count}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Heart className="h-3 w-3" /> {post.like_count}
                                        </span>
                                        {post.file_path && <Paperclip className="h-3 w-3" />}
                                        <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                                    </div>
                                    {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>

                                {expanded && (
                                    <div className="border-t border-border px-4 py-3 bg-muted/10 flex flex-col gap-3">
                                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>

                                        {post.file_path && post.file_name && (
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}${post.file_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit"
                                            >
                                                <Paperclip className="h-3 w-3" /> {post.file_name}
                                            </a>
                                        )}

                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs gap-1 text-red-500 hover:text-red-600"
                                                onClick={() => handleDeletePost(post)}
                                                disabled={acting}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {acting ? "삭제 중..." : "게시글 삭제"}
                                            </Button>
                                        </div>

                                        <div className="border-t border-border pt-3">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">댓글 ({post.comment_count})</p>
                                            {postComments.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic">댓글이 없습니다.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {postComments.map((c) => (
                                                        <div key={c.id} className="rounded-md border border-border bg-card px-3 py-2 flex items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                                    <span className="font-medium text-foreground">{c.author_name ?? "탈퇴한 사용자"}</span>
                                                                    <span>{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                                                                </div>
                                                                <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteComment(post.id, c.id)}
                                                                className="text-red-500 hover:text-red-600 flex-shrink-0"
                                                                title="댓글 삭제"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
