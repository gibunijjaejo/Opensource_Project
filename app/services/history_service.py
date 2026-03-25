from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.activity import History


def save_histories(
    db: Session,
    student_id: int,
    matched_courses: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
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