import os
import json
import re
import time
import unicodedata
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
from app.models.contact import Contact
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


class UserInfoUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    current_semester: Optional[int] = None


@router.patch("/users/{student_id}/info")
def update_user_info(
    student_id: int,
    body: UserInfoUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    if body.name is not None:
        user.name = body.name.strip()
    if body.email is not None:
        dup = db.query(User).filter(User.email == body.email, User.student_id != student_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        user.email = body.email.strip()
    if body.current_semester is not None:
        user.current_semester = body.current_semester
    db.commit()
    return {
        "student_id": user.student_id,
        "name": user.name,
        "email": user.email,
        "current_semester": user.current_semester,
    }


# ── 신고 관리 ─────────────────────────────────────────
@router.get("/reports/counts")
def get_report_counts(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Report.reason, func.count(Report.id))
        .filter(Report.status == "pending")
        .group_by(Report.reason)
        .all()
    )
    counts: dict[str, int] = {"욕설": 0, "스팸": 0, "기타": 0}
    for reason, cnt in rows:
        if reason in counts:
            counts[reason] = cnt
    return {"total": sum(counts.values()), **counts}


@router.get("/reports")
def get_reports(
    status: Optional[str] = None,
    reason: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    if reason:
        query = query.filter(Report.reason == reason)
    reports = query.order_by(Report.created_at.desc()).all()

    post_ids = {r.target_id for r in reports if r.target_type == "post"}
    comment_ids = {r.target_id for r in reports if r.target_type == "comment"}
    posts = {p.id: p for p in db.query(Post).filter(Post.id.in_(post_ids)).all()} if post_ids else {}
    comments = {c.id: c for c in db.query(Comment).filter(Comment.id.in_(comment_ids)).all()} if comment_ids else {}

    def target_info(r: Report) -> dict:
        if r.target_type == "post":
            p = posts.get(r.target_id)
            return {
                "target_title": p.title if p else None,
                "target_content": p.content if p else None,
                "target_author": (p.author.name if p.author else None) if p and not p.is_anonymous else "익명",
                "target_category": p.category if p else None,
            }
        c = comments.get(r.target_id)
        return {
            "target_title": None,
            "target_content": c.content if c else None,
            "target_author": c.author.name if (c and c.author) else None,
            "target_category": None,
        }

    return [
        {
            "id": r.id,
            "reporter_id": r.reporter_id,
            "reporter_name": r.reporter.name if r.reporter else None,
            "target_type": r.target_type,
            "target_id": r.target_id,
            **target_info(r),
            "reason": r.reason,
            "detail": r.api_scores.get("detail") if isinstance(r.api_scores, dict) else None,
            "status": r.status,
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
            db.delete(post)
    elif report.target_type == "comment":
        comment = db.query(Comment).filter(Comment.id == report.target_id).first()
        if comment:
            db.delete(comment)
    db.commit()
    return {"message": "삭제 완료", "report_id": report_id}


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


# ── 문의 관리 ─────────────────────────────────────────
@router.get("/contacts/counts")
def get_contact_counts(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(Contact.id)).filter(Contact.status == "pending").scalar()
    return {"total": total}


@router.get("/contacts")
def get_contacts(
    status: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Contact)
    if status:
        query = query.filter(Contact.status == status)
    contacts = query.order_by(Contact.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "student_id": c.student_id,
            "sender_name": c.sender_name,
            "sender_email": c.sender_email,
            "subject": c.subject,
            "content": c.content,
            "status": c.status,
            "created_at": c.created_at,
        }
        for c in contacts
    ]


@router.patch("/contacts/{contact_id}/resolve")
def resolve_contact(
    contact_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    contact.status = "resolved"
    db.commit()
    return {"message": "처리 완료"}


@router.patch("/contacts/{contact_id}/dismiss")
def dismiss_contact(
    contact_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    contact.status = "dismissed"
    db.commit()
    return {"message": "기각 완료"}


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


def _list_syllabi_files(year: Optional[int], semester: Optional[int], course_code: Optional[str] = None) -> list[Path]:
    """
    디렉토리에서 PDF 파일 스캔. macOS NFD vs Linux NFC 정규화 차이를 흡수.

    glob에 한글 패턴을 직접 쓰면 macOS 마운트(NFD) 환경에서 매칭 실패하므로
    *.pdf로 다 가져온 뒤 파이썬에서 NFC 정규화 후 prefix/code 비교한다.
    """
    if not SYLLABI_DIR.exists():
        return []
    prefix = f"{year}-{semester}학기__" if year and semester else ""
    matched: list[Path] = []
    for f in SYLLABI_DIR.glob("*.pdf"):
        name_nfc = unicodedata.normalize("NFC", f.name)
        if prefix and not name_nfc.startswith(prefix):
            continue
        if course_code:
            m = re.match(r'^.*?__([A-Z]+\d+)_\d+\.pdf$', name_nfc)
            if not m or m.group(1) != course_code:
                continue
        matched.append(f)
    return sorted(matched)


def _list_pdf_section_keys(year: Optional[int], semester: Optional[int]) -> set[tuple[str, int]]:
    """디렉토리 PDF 파일에서 (course_code, section_num) 쌍을 추출.

    파일명 컨벤션: YYYY-N학기__COURSECODE_##.pdf
    예: 2026-1학기__CSE2003_03.pdf → ("CSE2003", 3)
    """
    keys: set[tuple[str, int]] = set()
    for f in _list_syllabi_files(year, semester):
        name_nfc = unicodedata.normalize("NFC", f.name)
        m = re.match(r'^.*?__([A-Z]+\d+)_(\d+)\.pdf$', name_nfc)
        if m:
            keys.add((m.group(1), int(m.group(2))))
    return keys


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

    pdf_section_keys = _list_pdf_section_keys(year, semester)
    detail_map = {d.course_id: d for d in db.query(CourseDetail).all()}

    # 분반 인덱스 계산: 같은 course_code 끼리 묶고 course_id 오름차순으로 1-indexed
    # (PDF 파일명의 _01, _02, _03이 분반 1, 2, 3에 해당한다는 컨벤션과 일치)
    courses_by_code: dict[str, list[Course]] = {}
    for c in courses:
        courses_by_code.setdefault(c.course_code, []).append(c)
    section_index_map: dict[int, int] = {}
    for code, sections in courses_by_code.items():
        for i, s in enumerate(sorted(sections, key=lambda x: x.course_id), 1):
            section_index_map[s.course_id] = i

    return [
        {
            "course_id": c.course_id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "year": c.year,
            "semester": c.semester,
            "professor_name": c.professor.name if c.professor else None,
            "has_summary": bool(detail_map.get(c.course_id) and detail_map[c.course_id].overview),
            "has_pdf": (c.course_code, section_index_map.get(c.course_id, 0)) in pdf_section_keys,
        }
        for c in courses
    ]


@router.get("/lectures/{course_id}/detail")
def get_lecture_detail(
    course_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """admin 페이지에서 행 펼치기 시 호출. 모든 요약 필드 반환."""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    detail = db.query(CourseDetail).filter(CourseDetail.course_id == course_id).first()
    return {
        "course_id": course_id,
        "course_code": course.course_code,
        "course_name": course.course_name,
        "year": course.year,
        "semester": course.semester,
        "professor_name": course.professor.name if course.professor else None,
        "overview": detail.overview if detail else None,
        "goals": detail.required_skills if detail else None,  # CourseDetail.required_skills
        "evaluation_method": detail.evaluation_method if detail else None,
        "teaching_method": detail.teaching_method if detail else None,
        "track_id": detail.track_id if detail else None,
        "keyword": detail.keyword if detail else None,
        "has_summary": bool(detail and detail.overview),
        "has_pdf_hash": bool(detail and detail.pdf_hash),
    }


@router.post("/lectures/summarize-all/stream")
def resummarize_lectures_stream(
    body: LectureBatchBody,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    def generate():
        pdf_files = _list_syllabi_files(body.year, body.semester)
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

    pdf_files = _list_syllabi_files(course.year, course.semester, course.course_code)
    if not pdf_files:
        raise HTTPException(
            status_code=404,
            detail=f"PDF 파일을 찾을 수 없습니다 ({course.course_code}, {course.year}-{course.semester})",
        )

    # course_code 매칭되는 PDF 모두 처리 → 끝까지 돌리고 매칭된 결과 반환
    # 같은 course_code의 다른 분반 PDF가 _01에 들어있고 사용자가 클릭한
    # course_id는 _03에 매칭되는 경우 등을 처리하려면 early return 안 됨.
    # force=True 시 process_pdf_for_batch가 hash 캐시 우회 (별도 hash clear 불필요).
    all_results = []
    matched_result: dict | None = None
    for pdf_path in pdf_files:
        pdf_bytes = pdf_path.read_bytes()
        result = process_pdf_for_batch(
            db, pdf_bytes, pdf_path.name, course.year, course.semester,
            force=body.force,
        )
        all_results.append({"filename": pdf_path.name, **result})
        if course_id in result.get("course_ids", []):
            matched_result = result

    if matched_result:
        return {
            "course_id": course_id,
            "course_code": course.course_code,
            "result": matched_result,
        }
    return {
        "course_id": course_id,
        "course_code": course.course_code,
        "result": {"status": "warn", "message": "매칭되는 분반 없음"},
        "all_results": all_results,
    }
