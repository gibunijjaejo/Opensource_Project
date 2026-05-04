import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_student_id
from app.models.post import Post, Comment, PostLike, CommentLike
from app.models.report import Report
from app.schemas.post import PostResponse, PostDetailResponse, CommentCreate, CommentResponse, LikeResponse, PostUpdate, ReportCreate

UPLOAD_DIR = "static/uploads/posts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".zip", ".txt", ".docx", ".pptx"}

router = APIRouter(prefix="/api/v1/community", tags=["Community"])


def _to_post_response(post: Post) -> PostResponse:
    return PostResponse(
        id=post.id,
        category=post.category,
        title=post.title,
        content=post.content,
        student_id=post.student_id,
        author_name=None if post.is_anonymous else (post.author.name if post.author else None),
        is_anonymous=post.is_anonymous,
        created_at=post.created_at,
        comment_count=len(post.comments),
        likes=len(post.likes),
        file_path=post.file_path,
        file_name=post.file_name,
    )


def _to_comment_response(comment: Comment) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        content=comment.content,
        student_id=comment.student_id,
        author_name=comment.author.name if comment.author else None,
        created_at=comment.created_at,
        likes=len(comment.likes),
    )


# ── 게시글 ──────────────────────────────────────────────

@router.get("/{category}", response_model=List[PostResponse])
def get_posts(category: str, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.category == category).order_by(Post.created_at.desc()).all()
    return [_to_post_response(p) for p in posts]


@router.post("/{category}", response_model=PostResponse, status_code=201)
async def create_post(
    category: str,
    title: str = Form(...),
    content: str = Form(...),
    is_anonymous: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    file_path = None
    file_name = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다.")
        saved_name = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(UPLOAD_DIR, saved_name)
        with open(full_path, "wb") as f:
            f.write(await file.read())
        file_path = f"/static/uploads/posts/{saved_name}"
        file_name = file.filename

    post = Post(category=category, title=title, content=content, student_id=student_id,
                is_anonymous=is_anonymous, file_path=file_path, file_name=file_name)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _to_post_response(post)


@router.get("/{category}/{post_id}", response_model=PostDetailResponse)
def get_post(category: str, post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    return PostDetailResponse(
        **_to_post_response(post).model_dump(),
        comments=[_to_comment_response(c) for c in post.comments],
    )


@router.patch("/{category}/{post_id}", response_model=PostResponse)
def update_post(
    category: str,
    post_id: int,
    req: PostUpdate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.student_id != student_id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    if req.title is not None:
        post.title = req.title
    if req.content is not None:
        post.content = req.content
    db.commit()
    db.refresh(post)
    return _to_post_response(post)


@router.delete("/{category}/{post_id}", status_code=204)
def delete_post(
    category: str,
    post_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.student_id != student_id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    db.delete(post)
    db.commit()


# ── 신고 ──────────────────────────────────────────────

VALID_REASONS = {"욕설", "스팸", "기타"}

@router.post("/{category}/{post_id}/report", status_code=201)
def report_post(
    category: str,
    post_id: int,
    req: ReportCreate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.student_id == student_id:
        raise HTTPException(status_code=400, detail="본인 게시글은 신고할 수 없습니다.")
    if req.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="올바르지 않은 신고 사유입니다.")
    duplicate = db.query(Report).filter(
        Report.reporter_id == student_id,
        Report.target_type == "post",
        Report.target_id == post_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="이미 신고한 게시글입니다.")
    api_scores = {"detail": req.detail} if req.detail else None
    report = Report(reporter_id=student_id, target_type="post", target_id=post_id, reason=req.reason, api_scores=api_scores)
    db.add(report)
    db.commit()
    return {"message": "신고가 접수되었습니다."}


# ── 좋아요 ────────────────────────────────────────────

@router.post("/{category}/{post_id}/like", response_model=LikeResponse)
def toggle_like(
    category: str,
    post_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    existing = db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.student_id == student_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        db.refresh(post)
        return LikeResponse(liked=False, likes=len(post.likes))
    else:
        like = PostLike(post_id=post_id, student_id=student_id)
        db.add(like)
        db.commit()
        db.refresh(post)
        return LikeResponse(liked=True, likes=len(post.likes))


# ── 댓글 ──────────────────────────────────────────────

@router.post("/{category}/{post_id}/comments", response_model=CommentResponse, status_code=201)
def create_comment(
    category: str,
    post_id: int,
    req: CommentCreate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    comment = Comment(post_id=post_id, content=req.content, student_id=student_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _to_comment_response(comment)


@router.post("/{category}/{post_id}/comments/{comment_id}/like", response_model=LikeResponse)
def toggle_comment_like(
    category: str,
    post_id: int,
    comment_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    existing = db.query(CommentLike).filter(
        CommentLike.comment_id == comment_id,
        CommentLike.student_id == student_id,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        db.refresh(comment)
        return LikeResponse(liked=False, likes=len(comment.likes))
    else:
        like = CommentLike(comment_id=comment_id, student_id=student_id)
        db.add(like)
        db.commit()
        db.refresh(comment)
        return LikeResponse(liked=True, likes=len(comment.likes))


@router.delete("/{category}/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    category: str,
    post_id: int,
    comment_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.student_id != student_id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    db.delete(comment)
    db.commit()
