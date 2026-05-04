from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.post import Post, Comment
from app.models.report import Report

VALID_REASONS = {"욕설", "스팸", "기타"}


def create_report(
    db: Session,
    student_id: int,
    post_id: int,
    category: str,
    reason: str,
    detail: str | None,
) -> Report:
    post = db.query(Post).filter(Post.id == post_id, Post.category == category).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.student_id == student_id:
        raise HTTPException(status_code=400, detail="본인 게시글은 신고할 수 없습니다.")
    if reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="올바르지 않은 신고 사유입니다.")
    duplicate = db.query(Report).filter(
        Report.reporter_id == student_id,
        Report.target_type == "post",
        Report.target_id == post_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="이미 신고한 게시글입니다.")
    api_scores = {"detail": detail} if detail else None
    report = Report(
        reporter_id=student_id,
        target_type="post",
        target_id=post_id,
        reason=reason,
        api_scores=api_scores,
    )
    db.add(report)
    db.commit()
    return report


def enrich_reports(db: Session, reports: list[Report]) -> list[dict]:
    post_ids = {r.target_id for r in reports if r.target_type == "post"}
    comment_ids = {r.target_id for r in reports if r.target_type == "comment"}
    posts = {p.id: p for p in db.query(Post).filter(Post.id.in_(post_ids)).all()} if post_ids else {}
    comments = {c.id: c for c in db.query(Comment).filter(Comment.id.in_(comment_ids)).all()} if comment_ids else {}

    result = []
    for r in reports:
        if r.target_type == "post":
            p = posts.get(r.target_id)
            if p:
                author_name = p.author.name if p.author else None
                if p.is_anonymous:
                    display_author = f"익명({author_name})" if author_name else "익명(탈퇴한 사용자)"
                else:
                    display_author = author_name
            else:
                display_author = None
            target = {
                "target_title": p.title if p else None,
                "target_content": p.content if p else None,
                "target_author": display_author,
                "target_category": p.category if p else None,
            }
        else:
            c = comments.get(r.target_id)
            target = {
                "target_title": None,
                "target_content": c.content if c else None,
                "target_author": c.author.name if (c and c.author) else None,
                "target_category": None,
            }
        result.append({
            "id": r.id,
            "reporter_id": r.reporter_id,
            "reporter_name": r.reporter.name if r.reporter else None,
            "target_type": r.target_type,
            "target_id": r.target_id,
            **target,
            "reason": r.reason,
            "detail": r.api_scores.get("detail") if isinstance(r.api_scores, dict) else None,
            "status": r.status,
            "created_at": r.created_at,
        })
    return result


def resolve_report(db: Session, report_id: int) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    report.status = "resolved"
    if report.target_type == "post":
        post = db.query(Post).filter(Post.id == report.target_id).first()
        if post:
            db.delete(post)
    elif report.target_type == "comment":
        comment = db.query(Comment).filter(Comment.id == report.target_id).first()
        if comment:
            db.delete(comment)
    db.commit()
    return report


def dismiss_report(db: Session, report_id: int) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    report.status = "dismissed"
    db.commit()
    return report
