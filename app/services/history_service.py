from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.activity import History
from app.models.course import Course
from app.schemas.history import HistoryCreate, HistoryUpdate


def get_student_histories(db: Session, student_id: int) -> List[History]:
    """
    특정 학생의 전체 이수 기록을 조회합니다.
    History의 (course_code, year, semester)와 일치하는 Course 정보를 함께 가져옵니다.
    중복된 과목(분반 등)이 있을 경우 하나만 가져오도록 처리합니다.
    """
    # 1. 먼저 학생의 모든 History를 가져옵니다.
    histories = db.query(History).filter(History.student_id == student_id).all()

    for h in histories:
        # 2. 각 History에 대해 해당하는 Course를 하나만 조회합니다.
        # (course_code, year, semester)가 일치하는 것 중 첫 번째를 가져옵니다.
        course = (
            db.query(Course)
            .filter(
                Course.course_code == h.course_code,
                Course.year == h.year,
                Course.semester == h.semester
            )
            .first()
        )
        h.course = course

    return histories


def add_student_history(
    db: Session, student_id: int, history_in: HistoryCreate
) -> History:
    """
    수동으로 이수 기록을 추가합니다.
    입력된 (course_code, year, semester)가 실제 courses 테이블에 존재하는지 확인합니다.
    """
    # 1. 해당 연도/학기에 실제 존재하는 과목 코드인지 확인
    course_query = db.query(Course).filter(Course.course_code == history_in.course_code)
    
    if history_in.year:
        course_query = course_query.filter(Course.year == history_in.year)
    if history_in.semester:
        course_query = course_query.filter(Course.semester == history_in.semester)
        
    course_exists = course_query.first()
    
    if not course_exists:
        from fastapi import HTTPException
        msg = f"해당 학기({history_in.year}-{history_in.semester})에 존재하지 않는 과목 코드입니다."
        raise HTTPException(status_code=404, detail=msg)

    # 2. 이미 등록된 과목인지 확인 (같은 학기에 같은 과목 중복 방지)
    existing = (
        db.query(History)
        .filter(
            History.student_id == student_id,
            History.course_code == history_in.course_code,
            History.year == history_in.year,
            History.semester == history_in.semester
        )
        .first()
    )
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="해당 학기에 이미 이수 목록에 존재하는 과목입니다.")

    # 3. 추가
    history = History(
        student_id=student_id,
        course_code=history_in.course_code,
        year=history_in.year,
        semester=history_in.semester,
        is_retake=history_in.is_retake,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # 조인된 정보도 바로 보여주기 위해 할당
    history.course = course_exists
    return history


def update_student_history(
    db: Session, student_id: int, history_id: int, history_in: HistoryUpdate
) -> History:
    """
    이수 기록(과목 코드, 연도, 학기, 재수강 여부)을 수정합니다.
    """
    history = (
        db.query(History)
        .filter(History.id == history_id, History.student_id == student_id)
        .first()
    )
    if not history:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="해당 이수 기록을 찾을 수 없습니다.")

    # 1. 과목 코드를 변경하려는 경우
    if history_in.course_code is not None:
        # 실제 존재하는 과목인지 확인
        course_exists = (
            db.query(Course).filter(Course.course_code == history_in.course_code).first()
        )
        if not course_exists:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="존재하지 않는 과목 코드입니다.")
        
        # 이미 내가 이수한 목록에 있는지 중복 확인
        if history_in.course_code != history.course_code:
            existing = (
                db.query(History)
                .filter(
                    History.student_id == student_id,
                    History.course_code == history_in.course_code,
                )
                .first()
            )
            if existing:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="이미 이수한 목록에 있는 과목 코드입니다.")
            
            history.course_code = history_in.course_code

    # 2. 연도 및 학기 수정
    if history_in.year is not None:
        history.year = history_in.year
    if history_in.semester is not None:
        history.semester = history_in.semester

    # 3. 재수강 여부 변경
    if history_in.is_retake is not None:
        history.is_retake = history_in.is_retake

    db.commit()
    db.refresh(history)
    return history


def delete_student_history(db: Session, student_id: int, history_id: int) -> bool:
    # ... (생략)
    """
    이수 기록을 삭제합니다.
    """
    history = (
        db.query(History)
        .filter(History.id == history_id, History.student_id == student_id)
        .first()
    )
    if not history:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="해당 이수 기록을 찾을 수 없습니다.")

    db.delete(history)
    db.commit()
    return True


def save_histories(
    db: Session,
    student_id: int,
    matched_courses: List[Dict[str, Any]],
    year: Optional[int] = None,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """OCR 매칭 결과를 histories 에 저장한다. 전공/교양 구분 없이 전체 매칭 풀에서 들어온 결과를 모두 저장."""
    saved_rows: List[Dict[str, Any]] = []

    for item in matched_courses:
        course_code = item["course_code"]

        existing = (
            db.query(History)
            .filter(
                History.student_id == student_id,
                History.course_code == course_code,
            )
            .first()
        )

        is_retake = existing is not None

        history = History(
            student_id=student_id,
            course_code=course_code,
            year=year,
            semester=semester,
            is_retake=is_retake,
        )

        db.add(history)
        db.flush()  # id 확보

        saved_rows.append(
            {
                "history_id": history.id,
                "student_id": student_id,
                "course_code": course_code,
                "year": year,
                "semester": semester,
                "is_retake": is_retake,
                "ocr_text": item.get("ocr_text"),
                "matched_course_name": item.get("matched_course_name"),
                "score": item.get("score"),
            }
        )

    db.commit()

    return saved_rows