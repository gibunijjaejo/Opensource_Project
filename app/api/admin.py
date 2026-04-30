import os
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.models.post import Post, Comment
from app.models.report import Report
from app.services import user_service
from app.services.user_service import delete_user
from app.services.crawl_service import crawl_and_upsert

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY")
bearer_scheme = HTTPBearer()


def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        student_id = user_service.decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")
    return user


class AdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    user = user_service.get_user_by_email(db, body.email)
    if not user or not user_service.verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")
    token = user_service.create_access_token(user.student_id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/health")
def health_check(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user_count = db.query(func.count(User.student_id)).scalar()
    post_count = db.query(func.count(Post.id)).scalar()
    report_count = db.query(func.count(Report.id)).filter(Report.status == "pending").scalar()
    return {
        "status": "ok",
        "admin": admin.name,
        "stats": {
            "users": user_count,
            "posts": post_count,
            "pending_reports": report_count,
        },
    }


# ── 사용자 관리 ───────────────────────────────────────
@router.get("/users")
def get_users(
    q: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        query = query.filter(User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    users = query.order_by(User.student_id).all()
    return [
        {
            "student_id": u.student_id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "can_post": u.can_post,
            "current_semester": u.current_semester,
        }
        for u in users
    ]


@router.patch("/users/{student_id}/can-post")
def toggle_can_post(
    student_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    user.can_post = not user.can_post
    db.commit()
    return {"student_id": student_id, "can_post": user.can_post}


@router.delete("/users/{student_id}")
def delete_user_admin(
    student_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    delete_user(db, student_id)
    return {"message": "탈퇴 처리 완료"}


# ── 신고 관리 ─────────────────────────────────────────
@router.get("/reports")
def get_reports(
    status: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    reports = query.order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "reporter_id": r.reporter_id,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "reason": r.reason,
            "status": r.status,
            "api_scores": r.api_scores,
            "created_at": r.created_at,
        }
        for r in reports
    ]


@router.patch("/reports/{report_id}")
def resolve_report(
    report_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    report.status = "resolved"
    if report.target_type == "post":
        post = db.query(Post).filter(Post.id == report.target_id).first()
        if post:
            post.is_hidden = True
    elif report.target_type == "comment":
        comment = db.query(Comment).filter(Comment.id == report.target_id).first()
        if comment:
            comment.is_hidden = True
    db.commit()
    return {"message": "처리 완료", "report_id": report_id}


@router.patch("/reports/{report_id}/dismiss")
def dismiss_report(
    report_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    report.status = "dismissed"
    db.commit()
    return {"message": "기각 완료", "report_id": report_id}


@router.post("/crawl/professors")
def crawl_professors(
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """
    서강대 CS 교수 페이지를 크롤링하여 professor_details 테이블을 갱신합니다.

    - updated: 정상 업데이트된 교수 목록
    - not_found_in_db: 웹에는 있지만 DB에 없는 교수 (수동 검토 필요)
    - db_only: DB에는 있지만 웹에 없는 교수 (변경 없음)
    """
    return crawl_and_upsert(db)


@router.get("/crawl/professors/test")
def test_crawl_professor(
    url: str,
    _: None = Depends(verify_admin),
):
    """단일 교수 상세 페이지 파싱 + 요약 결과 확인 (DB 저장 없음)"""
    from app.services.crawl_service import _parse_detail_page, _summarize_research_area, _to_plain
    detail = _parse_detail_page(url)
    plain = _to_plain(detail.get("research_area") or "")
    detail["research_summary"] = _summarize_research_area(plain) if plain else None
    return detail


class SummarizeBody(BaseModel):
    prompt_override: str | None = None  # None이면 기본 프롬프트 사용


@router.post("/professors/summarize-all")
def resummarize_all(
    body: SummarizeBody = SummarizeBody(),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """research_area가 있는 모든 교수의 research_summary를 재생성합니다."""
    from app.models.professor import ProfessorDetail
    from app.services.crawl_service import _summarize_research_area, _to_plain

    details = db.query(ProfessorDetail).filter(ProfessorDetail.research_area.isnot(None)).all()
    results = []
    for detail in details:
        plain = _to_plain(detail.research_area)
        if not plain:
            continue
        print(f"[Ollama] {detail.name} 요약 중...", flush=True)
        summary = _summarize_research_area(plain, prompt_override=body.prompt_override)
        if summary:
            detail.research_summary = summary
            results.append({"professor_id": detail.professor_id, "name": detail.name, "research_summary": summary})
            print(f"[Ollama] {detail.name} 완료", flush=True)

    db.commit()
    return {"updated_count": len(results), "results": results}


@router.post("/professors/{professor_id}/summarize")
def resummmarize_professor(
    professor_id: int,
    body: SummarizeBody = SummarizeBody(),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """특정 교수의 research_summary를 재생성합니다. prompt_override로 프롬프트 커스텀 가능."""
    from app.models.professor import ProfessorDetail
    from app.services.crawl_service import _summarize_research_area, _to_plain

    detail = db.query(ProfessorDetail).filter(
        ProfessorDetail.professor_id == professor_id
    ).first()
    if not detail:
        raise HTTPException(status_code=404, detail="교수 정보를 찾을 수 없습니다.")
    if not detail.research_area:
        raise HTTPException(status_code=400, detail="research_area 데이터가 없습니다.")

    plain = _to_plain(detail.research_area)
    summary = _summarize_research_area(plain, prompt_override=body.prompt_override)
    if not summary:
        raise HTTPException(status_code=502, detail="Ollama 요약 실패")

    detail.research_summary = summary
    db.commit()
    return {"professor_id": professor_id, "research_summary": summary}
