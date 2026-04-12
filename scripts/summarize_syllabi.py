"""
강의계획서 PDF 일괄 요약 배치 스크립트

사용법:
  python scripts/summarize_syllabi.py --year 2026 --semester 1

data/syllabi/ 폴더의 모든 PDF를 읽어 Groq AI로 요약하고
course_details 테이블에 저장합니다. 파일명 형식 제약 없음.
"""

import argparse
import hashlib
import re
import sys
import os
import time
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가 (도커 외부 실행 지원)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.course import Course, CourseDetail
from app.models.professor import Professor  # noqa: F401 — relationship 해소용
from app.models.activity import Track       # noqa: F401 — relationship 해소용
from app.models.user import User            # noqa: F401 — relationship 해소용
from app.models.post import Post            # noqa: F401 — relationship 해소용
from app.services.syllabus_service import extract_pdf_text, summarize_with_groq


def process_pdf(db: Session, pdf_path: Path, year: int, semester: int) -> str:
    """
    단일 PDF 처리.
    반환: "ok" | "skip" | "error:<message>"
    """
    file_bytes = pdf_path.read_bytes()
    pdf_hash = hashlib.sha256(file_bytes).hexdigest()

    # 캐시 확인
    existing = db.query(CourseDetail).filter(CourseDetail.pdf_hash == pdf_hash).first()
    if existing:
        return "skip"

    # PDF 텍스트 추출
    raw_text = extract_pdf_text(file_bytes)
    if not raw_text.strip():
        return "error:PDF에서 텍스트를 추출할 수 없습니다"

    # Groq AI 요약
    try:
        result = summarize_with_groq(raw_text)
    except Exception as e:
        return f"error:Groq API 오류 - {e}"

    raw_code = result.get("course_code")
    if not raw_code:
        return "error:강의 코드를 추출할 수 없습니다"

    # AI 응답에서 CSE로 시작하는 코드만 추출 (AIE 제외)
    # CSE+숫자 형식을 우선으로, CSEG/CSEQ 등은 fallback
    all_codes = re.findall(r'\bCSE[A-Z]?\d+\b', raw_code)
    pure_cse = [c for c in all_codes if re.match(r'^CSE\d+$', c)]
    other_cse = [c for c in all_codes if not re.match(r'^CSE\d+$', c)]
    candidates = pure_cse + other_cse  # CSE+숫자 먼저 시도

    # 교수 이름으로 정확한 분반 찾기
    professor_name = result.get("professor_name")
    courses_to_save = []  # 저장할 분반 목록

    for code in candidates:
        base_query = (
            db.query(Course)
            .filter(
                Course.course_code == code,
                Course.year == year,
                Course.semester == semester,
            )
        )
        # 교수 이름으로 정확한 분반 매칭 (모든 공백 제거 후 비교, 실패 시 퍼지 매칭)
        if professor_name:
            from rapidfuzz import fuzz
            pdf_name_clean = professor_name.replace("교수님", "").replace("교수", "").strip()
            pdf_name_no_space = "".join(pdf_name_clean.split())
            # PDF 인코딩 오류로 섞인 한글/영문 외 문자(그리스어 등) 제거
            pdf_name_no_space = re.sub(r'[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318Fa-zA-Z]', '', pdf_name_no_space)
            all_sections = (
                base_query
                .join(Professor, Course.professor_id == Professor.professor_id)
                .all()
            )
            # 1차: 완전 일치
            matched = [
                c for c in all_sections
                if "".join((c.professor.name or "").split()) == pdf_name_no_space
            ]
            if matched:
                courses_to_save = matched
                break
            # 2차: 퍼지 매칭 (PDF 인코딩 오류로 이름이 일부 깨진 경우 대응)
            if all_sections:
                best = max(
                    all_sections,
                    key=lambda c: fuzz.ratio(pdf_name_no_space, "".join((c.professor.name or "").split()))
                )
                best_score = fuzz.ratio(pdf_name_no_space, "".join((best.professor.name or "").split()))
                if best_score >= 60:
                    print(f"    [FUZZY] '{pdf_name_no_space}' → '{best.professor.name}' (유사도 {best_score:.0f}%)")
                    courses_to_save = [best]
                    break

        # 교수 이름 매칭 실패 시
        if not courses_to_save:
            all_sections = base_query.all()
            if len(all_sections) == 1:
                courses_to_save = all_sections
                break
            elif len(all_sections) > 1:
                professor_ids = {s.professor_id for s in all_sections}
                if len(professor_ids) == 1:
                    # 모든 분반 교수가 동일 → 전체 저장
                    courses_to_save = all_sections
                    break
                return f"warn:교수 매칭 실패 - {code} 분반 {len(all_sections)}개 (교수명: {professor_name})"

    # AI 추출 실패 시 파일명에서 코드 추출 (예: CSEG109_01.pdf → CSEG109)
    if not courses_to_save:
        filename_match = re.match(r'^.*?__([A-Z]+\d+)_\d+\.pdf$', pdf_path.name)
        if filename_match:
            filename_code = filename_match.group(1)
            courses_to_save = (
                db.query(Course)
                .filter(
                    Course.course_code == filename_code,
                    Course.year == year,
                    Course.semester == semester,
                )
                .all()
            )

    if not courses_to_save:
        return (
            f"error:강의 없음 "
            f"(course_code={raw_code}, year={year}, semester={semester})"
        )

    # course_details upsert — 매칭된 모든 분반에 저장
    for course in courses_to_save:
        detail = db.query(CourseDetail).filter(CourseDetail.course_id == course.course_id).first()
        if detail is None:
            detail = CourseDetail(course_id=course.course_id)
            db.add(detail)
        detail.overview = result.get("overview")
        detail.required_skills = result.get("goals")
        detail.evaluation_method = result.get("evaluation_method")
        detail.teaching_method = result.get("teaching_method")
        detail.track_id = result.get("track_id")
        detail.keyword = result.get("keyword")
        detail.pdf_hash = pdf_hash

    db.commit()
    return "ok"


def main():
    parser = argparse.ArgumentParser(description="강의계획서 PDF 일괄 요약")
    parser.add_argument("--year", type=int, required=True, help="학년도 (예: 2026)")
    parser.add_argument("--semester", type=int, choices=[1, 2], required=True, help="학기 (1 또는 2)")
    parser.add_argument(
        "--dir",
        type=Path,
        default=PROJECT_ROOT / "data" / "syllabi",
        help="PDF 디렉토리 경로 (기본: data/syllabi/)",
    )
    args = parser.parse_args()

    syllabus_dir: Path = args.dir
    if not syllabus_dir.exists():
        print(f"[ERROR] 디렉토리를 찾을 수 없습니다: {syllabus_dir}")
        sys.exit(1)

    pdf_files = sorted(syllabus_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"[INFO] PDF 파일이 없습니다: {syllabus_dir}")
        sys.exit(0)

    print(f"[INFO] {len(pdf_files)}개 PDF 처리 시작 (year={args.year}, semester={args.semester})\n")

    ok_count = skip_count = error_count = warn_count = 0

    db: Session = SessionLocal()
    try:
        for pdf_path in pdf_files:
            status = process_pdf(db, pdf_path, args.year, args.semester)
            if status == "ok":
                ok_count += 1
                print(f"  [OK]   {pdf_path.name}")
                time.sleep(3)  # API 과부하 방지
            elif status == "skip":
                skip_count += 1
                print(f"  [SKIP] {pdf_path.name} (이미 처리됨)")
            elif status.startswith("warn:"):
                warn_count += 1
                print(f"  [WARN] {pdf_path.name} — {status[5:]}")
            else:
                error_count += 1
                print(f"  [FAIL] {pdf_path.name} — {status[6:]}")
    finally:
        db.close()

    print(f"\n[완료] 성공: {ok_count}  스킵: {skip_count}  경고: {warn_count}  실패: {error_count}")


if __name__ == "__main__":
    main()
