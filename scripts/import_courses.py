"""정규학기·계절학기 개설과목 엑셀을 courses 테이블에 적재.

사용법:
    PYTHONPATH=. python scripts/import_courses.py                  # 모든 파일
    PYTHONPATH=. python scripts/import_courses.py --year 2020      # 특정 학년도만
    PYTHONPATH=. python scripts/import_courses.py /custom/path     # 다른 폴더

엑셀 파일명 규칙: <YEAR>-{1|2|동계|하계}.xls(x)

중복 판정 키:
  (course_code, year, semester, class_days, class_start_time, class_end_time, professor_id)
  — 분반은 보존(기존 CSE 데이터 패턴과 동일). 정확히 같은 강의만 skip.

분류 규칙:
  - course_code 가 'CSE' 로 시작 → course_category='전공'
  - 그 외                         → course_category='교양'

교수 처리:
  - 엑셀 K열(교수진) 문자열을 그대로 Professor.name 으로 매핑.
    "김민수, 김민준" 같은 다중 교수는 통째로 한 사람의 이름으로 들어간다.
  - DB에 없는 이름이면 새 Professor 를 자동 INSERT.
    이때 department 는 그 사람이 처음 담당한 과목의 course_code prefix 기준:
      CSE  → '컴퓨터공학과'
      그 외 → '교양'
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.professor import Professor  # noqa: E402

DEFAULT_DIR = Path(r"D:\kimhwoo02\Documents\개설과목")

TERM_TO_SEMESTER = {"1": 1, "2": 2, "하계": 3, "동계": 4}

FILENAME_RE = re.compile(r"^(?P<year>\d{4})-(?P<term>1|2|하계|동계)\.xlsx?$")

TIME_RE = re.compile(r"^\s*(?P<days>[^\s]+?)\s+(?P<start>\d{1,2}:\d{2})\s*~\s*(?P<end>\d{1,2}:\d{2})")


def _clean(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    return s or None


def _parse_schedule(raw) -> tuple[Optional[str], Optional[str], Optional[str]]:
    text = _clean(raw)
    if not text:
        return None, None, None
    m = TIME_RE.match(text)
    if not m:
        return text, None, None
    return m.group("days"), m.group("start"), m.group("end")


def _parse_credits(raw) -> Optional[int]:
    s = _clean(raw)
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _parse_filename(path: Path) -> tuple[int, int]:
    m = FILENAME_RE.match(path.name)
    if not m:
        raise ValueError(f"파일명 규칙 위반: {path.name} (예: 2020-1.xls, 2020-동계.xls)")
    return int(m.group("year")), TERM_TO_SEMESTER[m.group("term")]


def _load_rows(path: Path) -> pd.DataFrame:
    return pd.read_html(path, header=0)[0]


def _department_for(course_code: str) -> str:
    return "컴퓨터공학과" if course_code.startswith("CSE") else "교양"


def _course_category_for(course_code: str) -> str:
    return "전공" if course_code.startswith("CSE") else "교양"


def _get_or_create_prof(
    db, name: str, course_code: str, prof_index: dict[str, int]
) -> int:
    pid = prof_index.get(name)
    if pid is not None:
        return pid
    prof = Professor(name=name, department=_department_for(course_code))
    db.add(prof)
    db.flush()
    prof_index[name] = prof.professor_id
    return prof.professor_id


def import_file(db, path: Path, prof_index: dict[str, int]) -> dict:
    year, semester = _parse_filename(path)
    df = _load_rows(path)

    inserted = skipped = 0
    pre_prof_count = len(prof_index)

    for _, row in df.iterrows():
        course_code = _clean(row.get("과목번호"))
        course_name = _clean(row.get("과목명"))
        if not course_code or not course_name:
            continue

        days, start, end = _parse_schedule(row.get("수업시간/강의실"))

        prof_name = _clean(row.get("교수진"))
        prof_id = _get_or_create_prof(db, prof_name, course_code, prof_index) if prof_name else None

        # 분반 보존: (코드, 학년도, 학기, 요일, 시작, 종료, 교수) 가 모두 같을 때만 skip
        exists = (
            db.query(Course.course_id)
            .filter(
                Course.course_code == course_code,
                Course.year == year,
                Course.semester == semester,
                Course.class_days == days,
                Course.class_start_time == start,
                Course.class_end_time == end,
                Course.professor_id == prof_id,
            )
            .first()
        )
        if exists:
            skipped += 1
            continue

        db.add(Course(
            course_code=course_code,
            course_name=course_name,
            credits=_parse_credits(row.get("학점")),
            target_grade=_clean(row.get("권장학년")),
            is_english=(_clean(row.get("영어강의")) or "").upper() == "O",
            class_days=days,
            class_start_time=start,
            class_end_time=end,
            professor_id=prof_id,
            year=year,
            semester=semester,
            course_category=_course_category_for(course_code),
        ))
        inserted += 1

    return {
        "file": path.name,
        "inserted": inserted,
        "skipped": skipped,
        "profs_created": len(prof_index) - pre_prof_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="개설과목 엑셀 적재")
    parser.add_argument("dir", nargs="?", default=str(DEFAULT_DIR),
                        help=f"엑셀 폴더 경로 (기본: {DEFAULT_DIR})")
    parser.add_argument("--year", type=int, default=None,
                        help="특정 학년도만 처리 (예: 2020)")
    args = parser.parse_args()

    base_dir = Path(args.dir)
    if not base_dir.exists():
        raise SystemExit(f"폴더를 찾을 수 없음: {base_dir}")

    files = sorted(base_dir.glob("*.xls")) + sorted(base_dir.glob("*.xlsx"))
    if args.year is not None:
        files = [p for p in files if p.name.startswith(f"{args.year}-")]
    if not files:
        raise SystemExit("적재할 파일이 없음")

    db = SessionLocal()
    try:
        prof_index = {p.name: p.professor_id for p in db.query(Professor).all()}
        print(f"기존 교수 {len(prof_index)}명 로드")

        total_inserted = total_skipped = total_profs = 0
        for path in files:
            r = import_file(db, path, prof_index)
            print(f"{r['file']}: inserted={r['inserted']} skipped={r['skipped']} new_profs={r['profs_created']}")
            total_inserted += r["inserted"]
            total_skipped += r["skipped"]
            total_profs += r["profs_created"]

        db.commit()
        print(f"\n[완료] inserted={total_inserted} skipped={total_skipped} new_profs={total_profs}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
