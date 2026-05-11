"use client"

import { useState, useEffect, use, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, MessageCircle, Trash2, BookOpen, Paperclip, X as XIcon, ThumbsUp, Pencil, Check, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { communityApi } from "@/lib/api"
import type { Post, PostDetail } from "@/types"
import { ThemeToggle } from "@/components/layout/theme-toggle"

type SortMode = "recent" | "popular"

interface Props {
  params: Promise<{ category: string }>
}

export default function CommunityPage({ params }: Props) {
  const { category } = use(params)
  const decodedCategory = decodeURIComponent(category)
  const router = useRouter()

  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [myStudentId, setMyStudentId] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const [showMyPosts, setShowMyPosts] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())

  // 게시글 작성
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [newFile, setNewFile] = useState<File | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 게시글 수정
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isEditSaving, setIsEditSaving] = useState(false)

  // 댓글 좋아요
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set())

  // 신고
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState<string>("")
  const [reportDetail, setReportDetail] = useState<string>("")
  const [isReporting, setIsReporting] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  // 댓글
  const [commentInput, setCommentInput] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) { router.replace("/login"); return }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      setMyStudentId(Number(payload.sub))
    } catch {}

    communityApi.getPosts(decodedCategory)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [decodedCategory, router])

  const sortedPosts = [...posts]
    .filter((p) => (showMyPosts ? p.student_id === myStudentId : true))
    .sort((a, b) =>
      sortMode === "popular"
        ? b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  const handleSelectPost = async (postId: number) => {
    const detail = await communityApi.getPost(decodedCategory, postId).catch(() => null)
    if (detail) setSelectedPost(detail)
  }

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setIsSubmitting(true)
    try {
      const post = await communityApi.createPost(decodedCategory, newTitle, newContent, isAnonymous, newFile)
      setPosts((prev) => [post, ...prev])
      setNewTitle("")
      setNewContent("")
      setNewFile(null)
      setIsAnonymous(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setShowForm(false)
      // 등록 후 바로 상세 표시
      handleSelectPost(post.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : "게시글 등록에 실패했습니다.")
    }
    setIsSubmitting(false)
  }

  const handleDeletePost = async (postId: number) => {
    await communityApi.deletePost(decodedCategory, postId).catch(() => {})
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    if (selectedPost?.id === postId) setSelectedPost(null)
  }

  const handleToggleLike = async (postId: number) => {
    try {
      const res = await communityApi.toggleLike(decodedCategory, postId)
      setLikedIds((prev) => {
        const next = new Set(prev)
        res.liked ? next.add(postId) : next.delete(postId)
        return next
      })
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes: res.likes } : p))
      setSelectedPost((prev) => prev && prev.id === postId ? { ...prev, likes: res.likes } : prev)
    } catch {}
  }

  const handleCreateComment = async () => {
    if (!selectedPost || !commentInput.trim()) return
    try {
      const comment = await communityApi.createComment(decodedCategory, selectedPost.id, commentInput)
      setSelectedPost((prev) => prev ? { ...prev, comments: [...prev.comments, comment], comment_count: prev.comment_count + 1 } : prev)
      setCommentInput("")
    } catch (e) {
      alert(e instanceof Error ? e.message : "댓글 등록에 실패했습니다.")
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedPost) return
    await communityApi.deleteComment(decodedCategory, selectedPost.id, commentId).catch(() => {})
    setSelectedPost((prev) => prev ? {
      ...prev,
      comments: prev.comments.filter((c) => c.id !== commentId),
      comment_count: prev.comment_count - 1,
    } : prev)
  }

  const handleEditStart = () => {
    if (!selectedPost) return
    setEditTitle(selectedPost.title)
    setEditContent(selectedPost.content)
    setIsEditing(true)
  }

  const handleEditSave = async () => {
    if (!selectedPost || !editTitle.trim() || !editContent.trim()) return
    setIsEditSaving(true)
    try {
      const updated = await communityApi.updatePost(decodedCategory, selectedPost.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      })
      setSelectedPost((prev) => prev ? { ...prev, title: updated.title, content: updated.content } : prev)
      setPosts((prev) => prev.map((p) => p.id === updated.id ? { ...p, title: updated.title } : p))
      setIsEditing(false)
    } catch {}
    setIsEditSaving(false)
  }

  const handleReport = async () => {
    if (!selectedPost || !reportReason) return
    setIsReporting(true)
    try {
      await communityApi.reportPost(decodedCategory, selectedPost.id, reportReason, reportDetail.trim() || undefined)
      setReportDone(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "신고에 실패했습니다."
      alert(msg)
    }
    setIsReporting(false)
  }

  const handleToggleCommentLike = async (commentId: number) => {
    if (!selectedPost) return
    try {
      const res = await communityApi.toggleCommentLike(decodedCategory, selectedPost.id, commentId)
      setLikedCommentIds((prev) => {
        const next = new Set(prev)
        res.liked ? next.add(commentId) : next.delete(commentId)
        return next
      })
      setSelectedPost((prev) => prev ? {
        ...prev,
        comments: prev.comments.map((c) => c.id === commentId ? { ...c, likes: res.likes } : c),
      } : prev)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-14 items-center relative">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>이전</span>
            </button>
            <Link
              href="/dashboard"
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
            >
              <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: "#B0232A" }} />
              <span className="text-xl font-semibold text-foreground tracking-tight font-logo">서간표</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                style={{ backgroundColor: "#B0232A" }}
                onClick={() => { setShowForm(true); setSelectedPost(null) }}
              >
                <Plus className="h-3.5 w-3.5" />
                글쓰기
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">

          {/* 게시글 목록 */}
          <div className="flex flex-col gap-3">
            {/* 정렬 토글 + 내 글 필터 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">게시글</h2>
                <button
                  onClick={() => setShowMyPosts((v) => !v)}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    showMyPosts ? "text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  style={showMyPosts ? { backgroundColor: "#B0232A" } : {}}
                >
                  내 글
                </button>
              </div>
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setSortMode("recent")}
                  className={`px-2.5 py-1 transition-colors ${sortMode === "recent" ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
                  style={sortMode === "recent" ? { backgroundColor: "#B0232A" } : {}}
                >
                  최근순
                </button>
                <button
                  onClick={() => setSortMode("popular")}
                  className={`px-2.5 py-1 flex items-center gap-1 transition-colors border-l border-border ${sortMode === "popular" ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
                  style={sortMode === "popular" ? { backgroundColor: "#B0232A" } : {}}
                >
                  <ThumbsUp className="h-3 w-3" />
                  인기순
                </button>
              </div>
            </div>

            {/* 작성 폼 */}
            {showForm && (
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                <Input
                  placeholder="제목"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-sm"
                />
                <textarea
                  placeholder="내용을 입력하세요..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {/* 파일 첨부 + 익명 토글 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip,.txt,.docx,.pptx"
                      className="hidden"
                      onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      파일 첨부
                    </button>
                    {newFile && (
                      <span className="flex items-center gap-1 text-xs text-foreground">
                        {newFile.name}
                        <button type="button" onClick={() => { setNewFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}>
                          <XIcon className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                        </button>
                      </span>
                    )}
                  </div>
                  {/* 익명 토글 */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <div
                      onClick={() => setIsAnonymous((v) => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${isAnonymous ? "" : "bg-muted"}`}
                      style={isAnonymous ? { backgroundColor: "#B0232A" } : {}}
                    >
                      <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${isAnonymous ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">익명</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowForm(false); setNewFile(null); setIsAnonymous(false) }}>취소</Button>
                  <Button size="sm" className="h-7 text-xs" style={{ backgroundColor: "#B0232A" }} onClick={handleCreatePost} disabled={isSubmitting}>
                    {isSubmitting ? "등록 중..." : "등록"}
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>
            ) : posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">아직 게시글이 없습니다.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">첫 번째 글을 작성해보세요.</p>
              </div>
            ) : (
              sortedPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handleSelectPost(post.id)}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors hover:bg-muted/30 ${
                    selectedPost?.id === post.id ? "border-[#B0232A] bg-muted/20" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{post.author_name ?? "익명"} · {new Date(post.created_at).toLocaleDateString("ko-KR")}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        {post.comment_count}
                      </span>
                      {myStudentId === post.student_id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id) }}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 게시글 상세 */}
          <div>
            {selectedPost ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-card p-5">
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsEditing(false)}>취소</Button>
                        <Button size="sm" className="h-7 text-xs gap-1" style={{ backgroundColor: "#B0232A" }} onClick={handleEditSave} disabled={isEditSaving}>
                          <Check className="h-3 w-3" />
                          {isEditSaving ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-base font-semibold text-foreground">{selectedPost.title}</h3>
                        {myStudentId === selectedPost.student_id && (
                          <button onClick={handleEditStart} className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">{selectedPost.author_name ?? "익명"} · {new Date(selectedPost.created_at).toLocaleDateString("ko-KR")}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
                    </>
                  )}
                  {selectedPost.file_path && !isEditing && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}${selectedPost.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[#B0232A] hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {selectedPost.file_name ?? "첨부파일"}
                      </a>
                    </div>
                  )}
                  {/* 좋아요 + 신고 버튼 */}
                  {!isEditing && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <button
                        onClick={() => handleToggleLike(selectedPost.id)}
                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors rounded-full px-3 py-1.5 border ${
                          likedIds.has(selectedPost.id)
                            ? "text-white border-transparent"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        style={likedIds.has(selectedPost.id) ? { backgroundColor: "#B0232A" } : {}}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {selectedPost.likes}
                      </button>
                      {myStudentId !== selectedPost.student_id && (
                        <button
                          onClick={() => { setShowReportModal(true); setReportReason(""); setReportDetail(""); setReportDone(false) }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          신고
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 댓글 */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    댓글 {selectedPost.comment_count}개
                  </h4>
                  {selectedPost.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-medium text-foreground">{comment.author_name ?? "익명"}</p>
                          <p className="text-sm text-foreground">{comment.content}</p>
                          <p className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString("ko-KR")}</p>
                        </div>
                        {myStudentId === comment.student_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-muted-foreground hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-border flex items-center">
                        <button
                          onClick={() => handleToggleCommentLike(comment.id)}
                          className={`flex items-center gap-1 text-xs font-medium transition-colors rounded-full px-2 py-1 border ${
                            likedCommentIds.has(comment.id)
                              ? "text-white border-transparent"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                          style={likedCommentIds.has(comment.id) ? { backgroundColor: "#B0232A" } : {}}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {comment.likes}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder="댓글을 입력하세요..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateComment()}
                      className="text-sm"
                    />
                    <Button size="sm" style={{ backgroundColor: "#B0232A" }} onClick={handleCreateComment}>
                      등록
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-16 text-center">
                <p className="text-sm text-muted-foreground">게시글을 선택하면 내용이 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
            {reportDone ? (
              <>
                <p className="text-sm font-semibold text-foreground text-center">신고가 접수되었습니다.</p>
                <p className="text-xs text-muted-foreground text-center">검토 후 조치하겠습니다.</p>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  style={{ backgroundColor: "#B0232A" }}
                  onClick={() => setShowReportModal(false)}
                >
                  확인
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">게시글 신고</h3>
                  <button onClick={() => setShowReportModal(false)} className="text-muted-foreground hover:text-foreground">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">신고 사유를 선택해주세요.</p>
                <div className="flex flex-col gap-2">
                  {(["욕설", "스팸", "기타"] as const).map((reason) => (
                    <label key={reason} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="report-reason"
                        value={reason}
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                        className="accent-[#B0232A]"
                      />
                      <span className="text-sm text-foreground">{reason}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  placeholder="상세 사유를 입력해주세요. (선택)"
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReportModal(false)}>취소</Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    style={{ backgroundColor: "#B0232A" }}
                    onClick={handleReport}
                    disabled={!reportReason || isReporting}
                  >
                    {isReporting ? "신고 중..." : "신고하기"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
