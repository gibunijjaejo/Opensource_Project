"""학생이 후보 시간표를 4개(A/B/C/D)까지 저장하고 비교하는 API.

cart 와 의도가 다름:
  - cart      : 단순 담아두기 (확정 전 후보)
  - timetable : 확정 후보안 (슬롯 별 독립 강의 셋)

엔드포인트:
  GET    /api/v1/timetables                       내 모든 슬롯 (A/B/C/D, 비어있어도 4개 반환)
  GET    /api/v1/timetables/{slot}                특정 슬롯 (없으면 자동 lazy 생성)
  POST   /api/v1/timetables/{slot}/courses        슬롯에 강의 추가
  DELETE /api/v1/timetables/{slot}/courses/{course_id}   슬롯에서 강의 제거
  PATCH  /api/v1/timetables/{slot}                슬롯 별명 변경
  POST   /api/v1/timetables/compare               여러 슬롯을 한 번에 가져오기 (비교 화면용)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.dependencies import get_current_student_id
from app.models.activity import Timetable, TimetableCourse
from app.models.course import Course
from app.schemas.timetable import (
    TimetableCourseCreate,
    TimetableResponse,
    TimetableUpdate,
)

router = APIRouter(prefix="/api/v1/timetables", tags=["Timetables"])

VALID_SLOTS = ("A", "B", "C", "D")


def _get_or_create_timetable(db: Session, student_id: int, slot: str) -> Timetable:
    """슬롯 row 가 없으면 lazy 생성. 한 학생당 (student_id, slot) UNIQUE 보장됨."""
    if slot not in VALID_SLOTS:
        raise HTTPException(status_code=400, detail=f"슬롯은 A/B/C/D 중 하나여야 합니다 (받음: {slot})")
    tt = (
        db.query(Timetable)
        .options(
            joinedload(Timetable.courses)
            .joinedload(TimetableCourse.course)
            .joinedload(Course.professor)
        )
        .filter(Timetable.student_id == student_id, Timetable.slot == slot)
        .first()
    )
    if tt:
        return tt
    tt = Timetable(student_id=student_id, slot=slot, name=None)
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt


@router.get("", response_model=List[TimetableResponse])
def list_my_timetables(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """내 모든 슬롯 (없는 슬롯은 자동 생성해서 항상 4개 반환).

    프론트엔드는 항상 A/B/C/D 4개를 받아 슬롯 탭 UI 를 그릴 수 있음.
    """
    return [_get_or_create_timetable(db, student_id, s) for s in VALID_SLOTS]


@router.get("/{slot}", response_model=TimetableResponse)
def get_my_timetable(
    slot: str,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """특정 슬롯 조회. 없으면 lazy 생성 후 빈 슬롯 반환."""
    return _get_or_create_timetable(db, student_id, slot)


@router.post("/{slot}/courses", response_model=TimetableResponse, status_code=201)
def add_course_to_slot(
    slot: str,
    req: TimetableCourseCreate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """슬롯에 강의 추가. 같은 슬롯에 중복 강의 불가."""
    if not db.query(Course).filter(Course.course_id == req.course_id).first():
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")

    tt = _get_or_create_timetable(db, student_id, slot)

    exists = (
        db.query(TimetableCourse)
        .filter(
            TimetableCourse.timetable_id == tt.id,
            TimetableCourse.course_id == req.course_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail=f"슬롯 {slot} 에 이미 담긴 강의입니다.")

    db.add(TimetableCourse(timetable_id=tt.id, course_id=req.course_id))
    db.commit()
    db.refresh(tt)
    return tt


@router.delete("/{slot}/courses/{course_id}", status_code=204)
def remove_course_from_slot(
    slot: str,
    course_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """슬롯에서 강의 제거."""
    tt = _get_or_create_timetable(db, student_id, slot)

    link = (
        db.query(TimetableCourse)
        .filter(TimetableCourse.timetable_id == tt.id, TimetableCourse.course_id == course_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="슬롯에 해당 강의가 없습니다.")
    db.delete(link)
    db.commit()


@router.patch("/{slot}", response_model=TimetableResponse)
def update_slot_meta(
    slot: str,
    req: TimetableUpdate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """슬롯 메타데이터 수정 (현재는 별명만)."""
    tt = _get_or_create_timetable(db, student_id, slot)
    if req.name is not None:
        tt.name = req.name
    db.commit()
    db.refresh(tt)
    return tt


@router.post("/compare", response_model=List[TimetableResponse])
def compare_slots(
    slots: List[str],
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """여러 슬롯을 한 번에 조회 (비교 화면용).

    프론트엔드는 이 응답을 받아 격자 시간표 N개를 나란히 렌더링.
    body 예: ["A", "B"] → 2개 시간표 반환.
    """
    if not slots:
        raise HTTPException(status_code=400, detail="비교할 슬롯을 1개 이상 선택해주세요.")
    if len(slots) > 4:
        raise HTTPException(status_code=400, detail="최대 4개 슬롯까지 비교 가능합니다.")
    for s in slots:
        if s not in VALID_SLOTS:
            raise HTTPException(status_code=400, detail=f"잘못된 슬롯: {s}")
    return [_get_or_create_timetable(db, student_id, s) for s in slots]
