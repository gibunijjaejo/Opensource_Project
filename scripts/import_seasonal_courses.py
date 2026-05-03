"""계절학기(하계=3, 동계=4) 엑셀 파일을 읽어 courses 테이블에 적재.

사용법:
    PYTHONPATH=. python scripts/import_seasonal_courses.py [<엑셀폴더경로>]

엑셀 파일명 규칙: <YEAR>_summer.xls / <YEAR>_winter.xls
같은 (course_code, year, semester) 가 이미 있으면 INSERT 를 건너뛴다.
"""
from __future__ import annotations

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

DEFAULT_DIR = Path(r"c:\Users\jacob\OneDrive - Sogang\바탕 화면\계절학기")

SEASON_TO_SEMESTER = {"summer": 3, "winter": 4}

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
    stem = path.stem.lower()
    year_str, _, season = stem.partition("_")
    if season not in SEASON_TO_SEMESTER:
        raise ValueError(f"파일명 규칙 위반: {path.name} (예: 2024_summer.xls)")
    return int(year_str), SEASON_TO_SEMESTER[season]


def _load_rows(path: Path) -> pd.DataFrame:
    return pd.read_html(path, header=0)[0]


def import_file(db, path: Path, prof_index: dict[str, int]) -> dict:
    year, semester = _parse_filename(path)
    df = _load_rows(path)

    inserted = skipped = 0
    missing_profs: set[str] = set()

    for _, row in df.iterrows():
        course_code = _clean(row.get("과목번호"))
        course_name = _clean(row.get("과목명"))
        if not course_code or not course_name:
            continue

        exists = (
            db.query(Course.course_id)
            .filter(
                Course.course_code == course_code,
                Course.year == year,
                Course.semester == semester,
            )
            .first()
        )
        if exists:
            skipped += 1
            continue

        days, start, end = _parse_schedule(row.get("수업시간/강의실"))
        prof_name = _clean(row.get("교수진"))
        prof_id = prof_index.get(prof_name) if prof_name else None
        if prof_name and prof_id is None:
            missing_profs.add(prof_name)

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
            course_category=None,
        ))
        inserted += 1

    return {"file": path.name, "inserted": inserted, "skipped": skipped, "missing_profs": missing_profs}


def main() -> None:
    base_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DIR
    if not base_dir.exists():
        raise SystemExit(f"폴더를 찾을 수 없음: {base_dir}")

    files = sorted(base_dir.glob("*.xls")) + sorted(base_dir.glob("*.xlsx"))
    if not files:
        raise SystemExit(f"엑셀 파일이 없음: {base_dir}")

    db = SessionLocal()
    try:
        prof_index = {p.name: p.professor_id for p in db.query(Professor).all()}

        total_inserted = total_skipped = 0
        all_missing: set[str] = set()
        for path in files:
            r = import_file(db, path, prof_index)
            print(f"{r['file']}: inserted={r['inserted']} skipped={r['skipped']}")
            total_inserted += r["inserted"]
            total_skipped += r["skipped"]
            all_missing |= r["missing_profs"]

        db.commit()
        print(f"\n[완료] inserted={total_inserted} skipped={total_skipped}")
        if all_missing:
            print(f"[경고] DB에 없는 교수 (professor_id=NULL): {sorted(all_missing)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
