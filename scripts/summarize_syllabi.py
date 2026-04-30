"""
강의계획서 PDF 일괄 요약 배치 스크립트 (CLI / cron 자동화용)

사용법:
  python scripts/summarize_syllabi.py --year 2026 --semester 1

data/syllabi/ 폴더의 모든 PDF를 읽어 Claude AI로 요약하고
course_details 테이블에 저장합니다.

같은 처리 로직은 관리자 페이지(/admin/lectures)에서도 트리거할 수 있습니다.
이 스크립트는 cron 등 자동화 환경에서 사용 (admin UI 없이).
"""

import argparse
import sys
import time
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가 (도커 외부 실행 지원)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.professor import Professor  # noqa: F401 — relationship 해소용
from app.models.activity import Track       # noqa: F401 — relationship 해소용
from app.models.user import User            # noqa: F401 — relationship 해소용
from app.models.post import Post            # noqa: F401 — relationship 해소용
from app.services.syllabus_service import process_pdf_for_batch


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

    ok_count = skip_count = warn_count = error_count = 0

    db: Session = SessionLocal()
    try:
        for pdf_path in pdf_files:
            pdf_bytes = pdf_path.read_bytes()
            result = process_pdf_for_batch(
                db, pdf_bytes, pdf_path.name, args.year, args.semester
            )
            status = result["status"]
            msg = result.get("message", "")

            if status == "ok":
                ok_count += 1
                suffix = f" [{msg}]" if msg else ""
                print(f"  [OK]   {pdf_path.name}{suffix}")
                time.sleep(3)  # API 과부하 방지
            elif status == "skip":
                skip_count += 1
                print(f"  [SKIP] {pdf_path.name} ({msg})")
            elif status == "warn":
                warn_count += 1
                print(f"  [WARN] {pdf_path.name} — {msg}")
            else:
                error_count += 1
                print(f"  [FAIL] {pdf_path.name} — {msg}")
    finally:
        db.close()

    print(f"\n[완료] 성공: {ok_count}  스킵: {skip_count}  경고: {warn_count}  실패: {error_count}")


if __name__ == "__main__":
    main()
