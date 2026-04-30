import os
import json
import re
import time
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
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
from app.models.course import Course, CourseDetail
from app.services import user_service
from app.services.user_service import delete_user
from app.services.crawl_service import crawl_and_upsert
from app.services.syllabus_service import process_pdf_for_batch

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


# ── 교수 관리 ─────────────────────────────────────────
@router.get("/professors")
def get_professors(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.professor import Professor, ProfessorDetail
    professors = db.query(Professor).order_by(Professor.name).all()
    detail_map = {
        d.professor_id: d
        for d in db.query(ProfessorDetail).all()
    }
    return [
        {
            "professor_id": p.professor_id,
            "name": p.name,
            "has_detail": p.professor_id in detail_map,
            "has_research_area": bool(detail_map.get(p.professor_id) and detail_map[p.professor_id].research_area),
            "has_summary": bool(detail_map.get(p.professor_id) and detail_map[p.professor_id].research_summary),
            "research_summary": detail_map[p.professor_id].research_summary if p.professor_id in detail_map else None,
        }
        for p in professors
    ]


@router.post("/crawl/professors")
def crawl_professors(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return crawl_and_upsert(db)


class SummarizeBody(BaseModel):
    prompt_override: str | None = None


@router.post("/professors/summarize-all")
def resummarize_all(
    body: SummarizeBody = SummarizeBody(),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
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
            results.append({"professor_id": detail.professor_id, "name": detail.name})
            print(f"[Ollama] {detail.name} 완료", flush=True)

    db.commit()
    return {"updated_count": len(results), "results": results}


@router.post("/professors/summarize-all/stream")
def resummarize_all_stream(
    body: SummarizeBody = SummarizeBody(),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.professor import ProfessorDetail
    from app.services.crawl_service import _summarize_research_area, _to_plain

    def generate():
        details = db.query(ProfessorDetail).filter(ProfessorDetail.research_area.isnot(None)).all()
        total = len(details)
        updated = 0
        for i, detail in enumerate(details):
            plain = _to_plain(detail.research_area)
            if not plain:
                continue
            yield f"data: {json.dumps({'type': 'progress', 'name': detail.name, 'index': i + 1, 'total': total})}\n\n"
            summary = _summarize_research_area(plain, prompt_override=body.prompt_override)
            if summary:
                detail.research_summary = summary
                updated += 1
                db.commit()
                yield f"data: {json.dumps({'type': 'done', 'name': detail.name, 'index': i + 1, 'total': total})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'fail', 'name': detail.name, 'index': i + 1, 'total': total})}\n\n"
        yield f"data: {json.dumps({'type': 'complete', 'updated_count': updated, 'total': total})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/professors/{professor_id}/summarize")
def resummarize_professor(
    professor_id: int,
    body: SummarizeBody = SummarizeBody(),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
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
    return {"professor_id": professor_id, "name": detail.name}


# ── 강의계획서 관리 ────────────────────────────────────
SYLLABI_DIR = Path(
    os.getenv("SYLLABI_DIR", str(Path(__file__).resolve().parent.parent.parent / "data" / "syllabi"))
)


def _list_pdf_codes(year: Optional[int], semester: Optional[int]) -> set[str]:
    """디렉토리에서 PDF 파일을 스캔하여 매칭되는 course_code 집합을 반환."""
    if not SYLLABI_DIR.exists():
        return set()
    pattern = f"{year}-{semester}학기__*.pdf" if year and semester else "*.pdf"
    codes: set[str] = set()
    for f in SYLLABI_DIR.glob(pattern):
        m = re.match(r'^.*?__([A-Z]+\d+)_\d+\.pdf$', f.name)
        if m:
            codes.add(m.group(1))
    return codes


class LectureBatchBody(BaseModel):
    year: int
    semester: int


class LectureResummarizeBody(BaseModel):
    force: bool = False


@router.get("/lectures")
def get_lectures(
    year: Optional[int] = None,
    semester: Optional[int] = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.professor import Professor

    query = db.query(Course).outerjoin(Professor, Course.professor_id == Professor.professor_id)
    if year is not None:
        query = query.filter(Course.year == year)
    if semester is not None:
        query = query.filter(Course.semester == semester)
    courses = query.order_by(Course.course_code, Course.course_id).all()

    pdf_codes = _list_pdf_codes(year, semester)
    detail_map = {d.course_id: d for d in db.query(CourseDetail).all()}

    return [
        {
            "course_id": c.course_id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "year": c.year,
            "semester": c.semester,
            "professor_name": c.professor.name if c.professor else None,
            "has_summary": bool(detail_map.get(c.course_id) and detail_map[c.course_id].overview),
            "has_pdf": c.course_code in pdf_codes,
        }
        for c in courses
    ]


@router.post("/lectures/summarize-all/stream")
def resummarize_lectures_stream(
    body: LectureBatchBody,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    def generate():
        prefix = f"{body.year}-{body.semester}학기__"
        pdf_files = sorted(SYLLABI_DIR.glob(f"{prefix}*.pdf")) if SYLLABI_DIR.exists() else []
        total = len(pdf_files)

        yield f"data: {json.dumps({'type': 'start', 'total': total, 'year': body.year, 'semester': body.semester})}\n\n"

        ok = skip = warn = fail = 0
        for i, pdf_path in enumerate(pdf_files):
            yield f"data: {json.dumps({'type': 'progress', 'filename': pdf_path.name, 'index': i + 1, 'total': total})}\n\n"

            pdf_bytes = pdf_path.read_bytes()
            result = process_pdf_for_batch(db, pdf_bytes, pdf_path.name, body.year, body.semester)
            status = result["status"]

            event = {
                "filename": pdf_path.name,
                "index": i + 1,
                "total": total,
                "message": result.get("message", ""),
            }
            if status == "ok":
                ok += 1
                event["type"] = "done"
                event["course_ids"] = result.get("course_ids", [])
                yield f"data: {json.dumps(event)}\n\n"
                time.sleep(3)  # Claude API rate limit
            elif status == "skip":
                skip += 1
                event["type"] = "skip"
                event["reason"] = result.get("message", "이미 처리됨")
                yield f"data: {json.dumps(event)}\n\n"
            elif status == "warn":
                warn += 1
                event["type"] = "warn"
                yield f"data: {json.dumps(event)}\n\n"
            else:  # error
                fail += 1
                event["type"] = "fail"
                yield f"data: {json.dumps(event)}\n\n"

        yield f"data: {json.dumps({'type': 'complete', 'ok': ok, 'skip': skip, 'warn': warn, 'fail': fail, 'total': total})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/lectures/{course_id}/summarize")
def resummarize_lecture(
    course_id: int,
    body: LectureResummarizeBody = LectureResummarizeBody(),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")

    prefix = f"{course.year}-{course.semester}학기__"
    pdf_files = (
        sorted(SYLLABI_DIR.glob(f"{prefix}{course.course_code}_*.pdf"))
        if SYLLABI_DIR.exists()
        else []
    )
    if not pdf_files:
        raise HTTPException(
            status_code=404,
            detail=f"PDF 파일을 찾을 수 없습니다 ({course.course_code}, {course.year}-{course.semester})",
        )

    # force=True: 기존 hash 삭제 후 재처리 (skip 우회)
    if body.force:
        detail = db.query(CourseDetail).filter(CourseDetail.course_id == course_id).first()
        if detail:
            detail.pdf_hash = None
            db.commit()

    # course_code 매칭되는 PDF 모두 처리 → 해당 course_id가 담긴 결과 반환
    all_results = []
    for pdf_path in pdf_files:
        pdf_bytes = pdf_path.read_bytes()
        result = process_pdf_for_batch(db, pdf_bytes, pdf_path.name, course.year, course.semester)
        all_results.append({"filename": pdf_path.name, **result})
        if course_id in result.get("course_ids", []):
            return {
                "course_id": course_id,
                "course_code": course.course_code,
                "result": result,
            }

    return {
        "course_id": course_id,
        "course_code": course.course_code,
        "result": {"status": "warn", "message": "매칭되는 분반 없음"},
        "all_results": all_results,
    }
