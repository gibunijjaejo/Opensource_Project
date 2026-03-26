from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.activity import History
from app.models.course import Course
from app.schemas.history import HistoryCreate, HistoryUpdate


def get_student_histories(db: Session, student_id: int) -> List[History]:
    """
    특정 학생의 전체 이수 기록을 조회합니다.
    """
    return db.query(History).filter(History.student_id == student_id).all()


def add_student_history(
    db: Session, student_id: int, history_in: HistoryCreate
) -> History:
    """
    수동으로 이수 기록을 추가합니다.
    """
    # 1. 실제 존재하는 과목 코드인지 확인
    course_exists = (
        db.query(Course).filter(Course.course_code == history_in.course_code).first()
    )
    if not course_exists:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="존재하지 않는 과목 코드입니다.")

    # 2. 이미 등록된 과목인지 확인
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

        raise HTTPException(status_code=400, detail="이미 이수 목록에 존재하는 과목입니다.")

    # 3. 추가
    history = History(
        student_id=student_id,
        course_code=history_in.course_code,
        is_retake=history_in.is_retake,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def update_student_history(
    db: Session, student_id: int, history_id: int, history_in: HistoryUpdate
) -> History:
    """
    이수 기록(과목 코드, 재수강 여부)을 수정합니다.
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

    # 2. 재수강 여부 변경
    if history_in.is_retake is not None:
        history.is_retake = history_in.is_retake

    db.commit()
    db.refresh(history)
    return history


def delete_student_history(db: Session, student_id: int, history_id: int) -> bool:
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
) -> List[Dict[str, Any]]:
    # ... (기존 save_histories 함수 유지 또는 필요시 위 함수들을 활용해 리팩토링 가능)
    """
    전공으로 판정된 과목만 histories에 저장합니다.

    현재 histories 테이블에는 semester 정보가 없으므로,
    동일 과목이 과거에 한 번이라도 존재하면 재수강(True)로 간주합니다.
    """
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
            is_retake=is_retake,
        )

        db.add(history)
        db.flush()  # id 확보

        saved_rows.append(
            {
                "history_id": history.id,
                "student_id": student_id,
                "course_code": course_code,
                "is_retake": is_retake,
                "ocr_text": item.get("ocr_text"),
                "matched_course_name": item.get("matched_course_name"),
                "score": item.get("score"),
            }
        )

    db.commit()

    return saved_rows