"""
Docker 컨테이너 에러 로그 수집 → Claude Code(Agent SDK) 분석 → Discord Embed 카드 전송

사용법:
  python3 scripts/analyze_logs.py \
    --build-number 42 \
    --branch main \
    --failed-stage "Deploy" \
    --webhook "$DISCORD_WEBHOOK" \
    --containers seoganpyo-api seoganpyo-frontend

팀서버에 Claude Code가 설치·인증되어 있어야 합니다:
  sudo npm install -g @anthropic-ai/claude-code
  sudo -u jenkins claude auth login
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ── 상수 ────────────────────────────────────────────────────────────────────

# 필터링할 에러 키워드 (대소문자 무관)
ERROR_KEYWORDS = [
    "error", "critical", "exception", "traceback",
    "fatal", "fail", "panic", "sqlalchemy",
    "connectionerror", "timeout",
]

# Discord Embed 색상
COLOR_FAIL    = 0xE74C3C  # 빨간색
COLOR_SUCCESS = 0x2ECC71  # 초록색

KST = timezone(timedelta(hours=9))


# ── 로그 수집 & 필터링 ────────────────────────────────────────────────────

def collect_logs(containers: list[str], tail: int = 200) -> str:
    """
    지정한 Docker 컨테이너에서 최근 로그를 수집하고
    에러 관련 라인만 필터링해서 반환합니다.
    """
    filtered_lines = []

    for container in containers:
        try:
            result = subprocess.run(
                ["docker", "logs", "--tail", str(tail), container],
                capture_output=True,
                text=True,
                timeout=15,
            )
            # docker logs는 stderr에도 출력하므로 둘 다 합칩니다
            raw = result.stdout + result.stderr
        except (subprocess.TimeoutExpired, FileNotFoundError):
            raw = ""

        for line in raw.splitlines():
            line_lower = line.lower()
            if any(kw in line_lower for kw in ERROR_KEYWORDS):
                filtered_lines.append(f"[{container}] {line.strip()}")

    return "\n".join(filtered_lines[-150:])  # 최대 150줄로 제한


# ── AI 분석 ──────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = (
    "당신은 백엔드 서비스 장애 분석 전문가입니다. "
    "주어진 에러 로그를 보고 반드시 아래 4개 항목을 각각 한국어로 간결하게 작성하세요. "
    "각 항목은 반드시 '[항목명]' 태그로 시작하세요."
)

ANALYSIS_USER_TEMPLATE = """\
에러 로그:
{logs}

위 로그를 분석하여 정확히 아래 형식으로 답하세요 (다른 내용은 포함하지 마세요):

[핵심 원인] 에러가 발생한 근본 원인을 1-2문장으로
[영향 범위] 어떤 기능/API가 영향을 받는지
[즉시 조치] 지금 당장 해야 할 조치를 번호 매겨서 (최대 3개)
[재발 방지] 재발을 막기 위한 한 줄 권고
"""


def analyze_with_claude(filtered_logs: str) -> str:
    """Claude Code Agent SDK로 에러 로그를 분석합니다.
    팀서버에 claude CLI가 설치·인증되어 있어야 합니다:
      npm install -g @anthropic-ai/claude-code
      claude auth login
    """
    try:
        import anyio
        from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

        prompt = (
            ANALYSIS_SYSTEM_PROMPT
            + "\n\n"
            + ANALYSIS_USER_TEMPLATE.format(logs=filtered_logs[:6000])
        )

        async def _run() -> str:
            async for message in query(
                prompt=prompt,
                options=ClaudeAgentOptions(max_turns=1),
            ):
                if isinstance(message, ResultMessage):
                    return message.result
            return "(분석 결과 없음)"

        return anyio.run(_run)

    except ImportError:
        return "(분석 실패: claude-agent-sdk 미설치 — pip install claude-agent-sdk)"
    except Exception as e:
        return f"(Claude Code 분석 오류: {e})"




# ── Discord Embed 전송 ────────────────────────────────────────────────────

def _truncate(text: str, limit: int = 1020) -> str:
    """Discord field value 최대 길이(1024) 맞춤 잘라내기."""
    if len(text) <= limit:
        return text
    return text[:limit - 3] + "..."


def send_failure_embed(
    webhook_url: str,
    build_number: str,
    branch: str,
    failed_stage: str,
    analysis: str,
    filtered_logs: str,
) -> bool:
    """빌드 실패 Discord Embed 카드를 전송합니다."""
    now_kst = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")

    # 로그 요약: 처음 5줄만 표시
    log_preview = "\n".join(filtered_logs.splitlines()[:5]) if filtered_logs else "(에러 로그 없음)"

    payload = {
        "username": "Jenkins Bot",
        "embeds": [
            {
                "title": f"❌ 빌드 #{build_number} 실패 — {failed_stage} 단계",
                "color": COLOR_FAIL,
                "fields": [
                    {"name": "🌿 브랜치",      "value": branch,                          "inline": True},
                    {"name": "🚨 실패 단계",    "value": failed_stage,                    "inline": True},
                    {"name": "📋 에러 로그 미리보기",
                     "value": f"```\n{_truncate(log_preview, 500)}\n```",               "inline": False},
                    {"name": "🤖 AI 장애 분석", "value": _truncate(analysis),            "inline": False},
                ],
                "footer": {"text": f"빌드 시각: {now_kst}"},
            }
        ],
    }
    return _post_webhook(webhook_url, payload)


def get_container_status() -> str:
    """실행 중인 seoganpyo-* 컨테이너 상태를 동적으로 조회합니다."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=seoganpyo", "--format", "{{.Names}}\t{{.Status}}"],
            capture_output=True, text=True, timeout=10,
        )
        lines = result.stdout.strip().splitlines()
        if not lines:
            return "(실행 중인 컨테이너 없음)"
        statuses = []
        for line in lines:
            parts = line.split("\t", 1)
            name = parts[0].replace("seoganpyo-", "")
            status = parts[1] if len(parts) > 1 else "unknown"
            icon = "🟢" if status.lower().startswith("up") else "🔴"
            statuses.append(f"{icon} {name}")
        return " · ".join(statuses)
    except Exception:
        return "(컨테이너 상태 조회 실패)"


def send_success_embed(
    webhook_url: str,
    build_number: str,
    branch: str,
) -> bool:
    """빌드 성공 Discord Embed 카드를 전송합니다."""
    now_kst = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")
    container_status = get_container_status()

    payload = {
        "username": "Jenkins Bot",
        "embeds": [
            {
                "title": f"✅ 빌드 #{build_number} 배포 성공",
                "color": COLOR_SUCCESS,
                "fields": [
                    {"name": "🌿 브랜치",    "value": branch,           "inline": True},
                    {"name": "🐳 컨테이너", "value": container_status,  "inline": True},
                ],
                "footer": {"text": f"배포 완료: {now_kst}"},
            }
        ],
    }
    return _post_webhook(webhook_url, payload)


def _post_webhook(webhook_url: str, payload: dict) -> bool:
    """Discord webhook POST 요청."""
    try:
        result = subprocess.run(
            [
                "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                "-X", "POST", webhook_url,
                "-H", "Content-Type: application/json",
                "-d", json.dumps(payload, ensure_ascii=False),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        status_code = result.stdout.strip()
        if status_code in ("200", "204"):
            print(f"[OK] Discord 전송 완료 (HTTP {status_code})")
            return True
        print(f"[WARN] Discord 응답 코드: {status_code}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[ERROR] Discord 전송 실패: {e}", file=sys.stderr)
        return False


# ── CLI 진입점 ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="에러 로그 분석 후 Discord Embed 카드 전송")
    parser.add_argument("--build-number", required=True, help="Jenkins 빌드 번호")
    parser.add_argument("--branch",       required=True, help="Git 브랜치명")
    parser.add_argument("--failed-stage", default="Unknown", help="실패한 Jenkins stage 이름")
    parser.add_argument("--webhook",      default=os.environ.get("DISCORD_WEBHOOK"), help="Discord Webhook URL")
    parser.add_argument("--containers",   nargs="*",
                        default=["seoganpyo-api", "seoganpyo-frontend", "seoganpyo-ocr"],
                        help="분석할 Docker 컨테이너 이름 목록")
    parser.add_argument("--mode",         choices=["failure", "success"], default="failure",
                        help="전송 모드: failure(기본) 또는 success")
    args = parser.parse_args()

    if not args.webhook:
        print("[ERROR] --webhook 또는 DISCORD_WEBHOOK 환경변수가 필요합니다", file=sys.stderr)
        sys.exit(1)

    if args.mode == "success":
        send_success_embed(args.webhook, args.build_number, args.branch)
        return

    # ── 실패 모드 ──────────────────────────────────────────────────────────
    print(f"[INFO] 컨테이너 로그 수집 중: {args.containers}")
    filtered_logs = collect_logs(args.containers)

    if filtered_logs:
        print(f"[INFO] 필터링된 에러 라인 수: {len(filtered_logs.splitlines())}")
        print("[INFO] Claude AI 분석 중...")
        analysis = analyze_with_claude(filtered_logs)
    else:
        print("[INFO] 에러 로그 없음 — 분석 생략")
        filtered_logs = ""
        analysis = "수집된 에러 로그가 없습니다. Jenkins 빌드 로그를 직접 확인하세요."

    print("[INFO] Discord Embed 전송 중...")
    send_failure_embed(
        webhook_url=args.webhook,
        build_number=args.build_number,
        branch=args.branch,
        failed_stage=args.failed_stage,
        analysis=analysis,
        filtered_logs=filtered_logs,
    )


if __name__ == "__main__":
    main()
