"""SQL 마이그레이션 파일을 app.database 의 engine 으로 실행한다.

사용법 (호스트 또는 백엔드 컨테이너 내부):
    PYTHONPATH=. python scripts/run_migration.py scripts/migrations/001_add_professor_department.sql

같은 SQL 을 두 번 돌려도 IF NOT EXISTS / IS NULL 가드로 멱등.
"""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import engine  # noqa: E402
from sqlalchemy import text  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("사용법: python scripts/run_migration.py <sql_path>")

    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        raise SystemExit(f"파일 없음: {sql_path}")

    sql = sql_path.read_text(encoding="utf-8")
    print(f"[run_migration] {sql_path.name} 실행 중...")

    # 라인 단위로 -- 한줄 주석 제거 후 ; 로 분할 (주석이 statement 앞에 붙어 같이 split 되면
    # strip().startswith('--') 검사로는 걸러지지 않는다)
    cleaned = "\n".join(
        line for line in sql.splitlines() if not line.lstrip().startswith("--")
    )
    statements = [s.strip() for s in cleaned.split(";") if s.strip()]

    if not statements:
        raise SystemExit("[run_migration] 실행할 statement 가 없음")

    with engine.begin() as conn:
        for stmt in statements:
            print(f"  > {stmt.splitlines()[0][:80]}...")
            conn.execute(text(stmt))

    print(f"[run_migration] 완료 ({len(statements)} statements)")


if __name__ == "__main__":
    main()
