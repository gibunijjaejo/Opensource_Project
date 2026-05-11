"""보안 모니터링 채팅이 호출하는 read-only 보안 도구 모음.

admin_assistant.py와 같은 패턴 — TOOL_REGISTRY 형식으로 도구 메타데이터를 노출해
app/api/admin_security_chat.py 가 Gemini function calling 어댑터로 사용한다.

규칙:
  - 모두 read-only (DefectDojo 상태를 변경하지 않는다).
  - DefectDojo 통신은 app/api/admin_security.py 의 _dd_get / _categorize / _format_finding 재사용.
  - 반환값은 JSON-직렬화 가능한 dict.
  - HTTPException 은 raise — 어댑터(admin_security_chat._run_tool)가 잡아서 error dict 로 변환.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.api.admin_security import (
    DD_ENGAGEMENT,
    DD_URL,
    SEVERITY_ORDER,
    _categorize,
    _dd_get,
    _format_finding,
)


def get_security_summary() -> dict:
    """현재 active+unmitigated finding 의 심각도별·카테고리별 카운트."""
    summary: dict[str, Any] = {s.lower(): 0 for s in SEVERITY_ORDER}
    summary["total"] = 0
    by_category = {"pip": 0, "npm": 0, "dockerfile": 0, "other": 0}
    last_updated: Optional[str] = None

    for severity in SEVERITY_ORDER:
        data = _dd_get("/api/v2/findings/", {
            "engagement": DD_ENGAGEMENT,
            "active": "true",
            "is_mitigated": "false",
            "severity": severity,
            "limit": 1,
        })
        count = int(data.get("count") or 0)
        summary[severity.lower()] = count
        summary["total"] += count

    data = _dd_get("/api/v2/findings/", {
        "engagement": DD_ENGAGEMENT,
        "active": "true",
        "is_mitigated": "false",
        "limit": 100,
    })
    for f in data.get("results", []):
        cat = _categorize(f.get("component_name"), f.get("file_path"), f.get("title", ""))
        by_category[cat] = by_category.get(cat, 0) + 1
        if f.get("date") and (last_updated is None or f["date"] > last_updated):
            last_updated = f["date"]

    summary["by_category"] = by_category
    summary["last_updated"] = last_updated
    summary["engagement_url"] = f"{DD_URL}/engagement/{DD_ENGAGEMENT}"
    return summary


def list_findings(
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 20,
) -> dict:
    """finding 리스트. severity / category 로 필터링 가능."""
    params: dict[str, Any] = {
        "engagement": DD_ENGAGEMENT,
        "active": "true",
        "is_mitigated": "false",
        "limit": max(1, min(int(limit), 100)),
        "ordering": "numerical_severity",
    }
    if severity:
        params["severity"] = severity.capitalize()

    data = _dd_get("/api/v2/findings/", params)
    items = [_format_finding(f) for f in data.get("results", [])]
    if category:
        items = [it for it in items if it["category"] == category]
    return {"count": len(items), "items": items}


def get_finding_detail(finding_id: int) -> dict:
    """특정 finding 의 description / mitigation / references / impact 포함 상세."""
    f = _dd_get(f"/api/v2/findings/{int(finding_id)}/")
    formatted = _format_finding(f)
    formatted["description"] = f.get("description") or None
    formatted["mitigation"] = f.get("mitigation") or None
    formatted["references"] = f.get("references") or None
    formatted["impact"] = f.get("impact") or None
    return formatted


def get_health() -> dict:
    """DefectDojo 연결 상태 (engagement 1건 조회로 확인)."""
    data = _dd_get("/api/v2/users/", {"limit": 1})
    return {
        "connected": True,
        "url": DD_URL,
        "engagement_id": DD_ENGAGEMENT,
        "user_count_sample": data.get("count"),
    }


def compare_with_last_week() -> dict:
    """최근 7일에 새로 등장한 finding 과 mitigated 처리된 finding 비교."""
    now = datetime.now(timezone.utc)
    this_week_start = (now - timedelta(days=7)).date().isoformat()
    last_week_start = (now - timedelta(days=14)).date().isoformat()

    data = _dd_get("/api/v2/findings/", {
        "engagement": DD_ENGAGEMENT,
        "limit": 500,
    })

    new_this_week: list[dict] = []
    mitigated_this_week: list[dict] = []
    for f in data.get("results", []):
        date = f.get("date") or ""
        if date >= this_week_start:
            new_this_week.append({
                "id": f["id"],
                "title": f.get("title") or "",
                "severity": f.get("severity"),
                "is_mitigated": bool(f.get("is_mitigated")),
            })
        mitig = f.get("mitigated") or ""
        if mitig and mitig[:10] >= this_week_start:
            mitigated_this_week.append({
                "id": f["id"],
                "title": f.get("title") or "",
                "severity": f.get("severity"),
            })

    return {
        "period": {
            "this_week_since": this_week_start,
            "last_week_since": last_week_start,
            "now": now.isoformat(),
        },
        "new_this_week": {"count": len(new_this_week), "items": new_this_week[:20]},
        "mitigated_this_week": {"count": len(mitigated_this_week), "items": mitigated_this_week[:20]},
    }


# ─── Gemini tool use 용 메타데이터 ─────────────────────────────────
SECURITY_TOOL_REGISTRY = [
    {
        "name": "get_security_summary",
        "description": (
            "현재 active+unmitigated finding 의 심각도(Critical/High/Medium/Low/Info)별 카운트와 "
            "카테고리(pip/npm/dockerfile/other)별 분포를 반환합니다. "
            "보안 모니터링 페이지 상단 카드와 동일한 데이터입니다. 인자 없음."
        ),
        "fn": get_security_summary,
        "params": {},
    },
    {
        "name": "list_findings",
        "description": (
            "active+unmitigated finding 리스트를 반환합니다. severity·category 로 필터링하고 limit 으로 개수 조절. "
            "각 항목에는 id, title, cve, component, file_path, dd_url, category 가 포함됩니다."
        ),
        "fn": list_findings,
        "params": {
            "severity": {
                "type": "string",
                "required": False,
                "description": "심각도 필터 (Critical/High/Medium/Low/Info). 미지정 시 전체.",
            },
            "category": {
                "type": "string",
                "required": False,
                "description": "카테고리 필터 (pip/npm/dockerfile/other). 미지정 시 전체.",
            },
            "limit": {
                "type": "integer",
                "required": False,
                "description": "최대 반환 개수 (기본 20, 최대 100).",
            },
        },
    },
    {
        "name": "get_finding_detail",
        "description": (
            "특정 finding 의 상세 정보(description / mitigation / references / impact 포함). "
            "id 는 list_findings 결과로 먼저 얻으세요."
        ),
        "fn": get_finding_detail,
        "params": {
            "finding_id": {
                "type": "integer",
                "required": True,
                "description": "DefectDojo finding 의 정수 ID.",
            },
        },
    },
    {
        "name": "get_health",
        "description": "DefectDojo 서버 연결 상태를 점검합니다. 다른 도구가 실패할 때 진단용으로 호출.",
        "fn": get_health,
        "params": {},
    },
    {
        "name": "compare_with_last_week",
        "description": (
            "최근 7일에 새로 등장한 finding 과 mitigated 처리된 finding 을 비교합니다. "
            "주간 보안 리포트 / 트렌드 파악에 사용."
        ),
        "fn": compare_with_last_week,
        "params": {},
    },
]

SECURITY_TOOLS_BY_NAME = {t["name"]: t for t in SECURITY_TOOL_REGISTRY}
