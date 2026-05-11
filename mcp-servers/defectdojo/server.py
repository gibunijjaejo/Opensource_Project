"""DefectDojo MCP 서버 — Claude Desktop/Code에 등록해 자연어로 보안 모니터링.

도구 5개 (read-only):
    - get_security_summary       심각도·카테고리별 카운트
    - list_findings              finding 리스트 (severity·category·limit 필터)
    - get_finding_detail         특정 finding 상세 (description/mitigation/refs)
    - get_health                 DefectDojo 연결 상태
    - compare_with_last_week     이번 주 vs 지난 주 finding 변화

환경변수:
    DEFECTDOJO_URL         예) http://163.239.77.65:8888
    DEFECTDOJO_TOKEN       DefectDojo API token
    DEFECTDOJO_ENGAGEMENT  Engagement ID (예: 1)

Transport: stdio (Claude Desktop/Code 등 데스크톱 MCP 클라이언트 표준)
"""
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

DD_URL = os.getenv("DEFECTDOJO_URL", "").rstrip("/")
DD_TOKEN = os.getenv("DEFECTDOJO_TOKEN", "")
DD_ENGAGEMENT = int(os.getenv("DEFECTDOJO_ENGAGEMENT", "1"))

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]


# ───────────────────────────────────────────────────────────
# DefectDojo API 헬퍼
# ───────────────────────────────────────────────────────────
def _dd_get(path: str, params: Optional[dict] = None) -> dict:
    """DefectDojo API GET. 환경 미설정 또는 통신 실패 시 명시적 dict 반환."""
    if not DD_URL or not DD_TOKEN:
        return {"error": "DEFECTDOJO_URL 또는 DEFECTDOJO_TOKEN 환경변수가 설정되지 않았습니다."}
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get(
                f"{DD_URL}{path}",
                headers={"Authorization": f"Token {DD_TOKEN}"},
                params=params or {},
            )
        res.raise_for_status()
        return res.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"DefectDojo 응답 오류 {e.response.status_code}", "path": path}
    except httpx.RequestError as e:
        return {"error": f"DefectDojo 연결 실패: {e}", "path": path}


def _categorize(component_name: Optional[str], file_path: Optional[str], title: str) -> str:
    """finding을 우리 도메인에 맞게 분류 (pip/npm/dockerfile/other)."""
    fp = (file_path or "").lower()
    name = (component_name or "").lower()
    t = (title or "").lower()
    if "dockerfile" in fp or "docker" in t or t.startswith("ds-"):
        return "dockerfile"
    if "requirements" in fp or "python" in name or name in {"pillow", "python-jose", "python-multipart", "django", "pyjwt"}:
        return "pip"
    if "package.json" in fp or "pnpm-lock" in fp or "node_modules" in fp or name in {"next", "lodash", "react"}:
        return "npm"
    if name and "/" in name:
        return "npm"
    return "other"


def _format_finding(f: dict) -> dict:
    return {
        "id": f["id"],
        "title": f.get("title") or "",
        "severity": f.get("severity") or "Info",
        "cve": f.get("cve") or None,
        "cwe": f.get("cwe") or None,
        "component_name": f.get("component_name") or None,
        "component_version": f.get("component_version") or None,
        "file_path": f.get("file_path") or None,
        "found_date": f.get("date") or None,
        "is_mitigated": bool(f.get("is_mitigated")),
        "risk_accepted": bool(f.get("risk_accepted")),
        "dd_url": f"{DD_URL}/finding/{f['id']}",
        "category": _categorize(f.get("component_name"), f.get("file_path"), f.get("title", "")),
    }


# ───────────────────────────────────────────────────────────
# 도구 구현
# ───────────────────────────────────────────────────────────
def tool_get_security_summary() -> dict:
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
        if "error" in data:
            return data
        count = int(data.get("count") or 0)
        summary[severity.lower()] = count
        summary["total"] += count

    data = _dd_get("/api/v2/findings/", {
        "engagement": DD_ENGAGEMENT,
        "active": "true",
        "is_mitigated": "false",
        "limit": 100,
    })
    if "error" in data:
        return data
    for f in data.get("results", []):
        cat = _categorize(f.get("component_name"), f.get("file_path"), f.get("title", ""))
        by_category[cat] = by_category.get(cat, 0) + 1
        if f.get("date") and (last_updated is None or f["date"] > last_updated):
            last_updated = f["date"]

    summary["by_category"] = by_category
    summary["last_updated"] = last_updated
    summary["engagement_url"] = f"{DD_URL}/engagement/{DD_ENGAGEMENT}"
    return summary


def tool_list_findings(severity: Optional[str], category: Optional[str], limit: int) -> dict:
    params = {
        "engagement": DD_ENGAGEMENT,
        "active": "true",
        "is_mitigated": "false",
        "limit": limit,
        "ordering": "numerical_severity",
    }
    if severity:
        params["severity"] = severity.capitalize()

    data = _dd_get("/api/v2/findings/", params)
    if "error" in data:
        return data
    items = [_format_finding(f) for f in data.get("results", [])]
    if category:
        items = [it for it in items if it["category"] == category]
    return {"count": len(items), "items": items}


def tool_get_finding_detail(finding_id: int) -> dict:
    f = _dd_get(f"/api/v2/findings/{finding_id}/")
    if "error" in f:
        return f
    formatted = _format_finding(f)
    formatted["description"] = f.get("description") or None
    formatted["mitigation"] = f.get("mitigation") or None
    formatted["references"] = f.get("references") or None
    formatted["impact"] = f.get("impact") or None
    return formatted


def tool_get_health() -> dict:
    if not DD_URL or not DD_TOKEN:
        return {"connected": False, "reason": "환경변수 DEFECTDOJO_URL/TOKEN 미설정"}
    try:
        with httpx.Client(timeout=3.0) as client:
            res = client.get(
                f"{DD_URL}/api/v2/users/",
                headers={"Authorization": f"Token {DD_TOKEN}"},
                params={"limit": 1},
            )
        res.raise_for_status()
        return {"connected": True, "url": DD_URL, "engagement_id": DD_ENGAGEMENT}
    except Exception as e:  # noqa: BLE001
        return {"connected": False, "reason": str(e)[:200]}


def tool_compare_with_last_week() -> dict:
    """이번 주 vs 지난 주 finding 변화. 새로 등장 / 사라진 finding 카운트."""
    now = datetime.now(timezone.utc)
    this_week_start = (now - timedelta(days=7)).date().isoformat()
    last_week_start = (now - timedelta(days=14)).date().isoformat()

    data = _dd_get("/api/v2/findings/", {
        "engagement": DD_ENGAGEMENT,
        "limit": 500,
    })
    if "error" in data:
        return data

    new_this_week = []
    mitigated_this_week = []
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
        "new_this_week": {
            "count": len(new_this_week),
            "items": new_this_week[:20],
        },
        "mitigated_this_week": {
            "count": len(mitigated_this_week),
            "items": mitigated_this_week[:20],
        },
    }


# ───────────────────────────────────────────────────────────
# MCP 서버
# ───────────────────────────────────────────────────────────
app = Server("seoganpyo-defectdojo")


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_security_summary",
            description=(
                "현재 active+unmitigated finding의 심각도(Critical/High/Medium/Low/Info)별 카운트와 "
                "카테고리(pip/npm/dockerfile/other)별 분포를 반환합니다. "
                "보안 모니터링 페이지 상단의 카드와 동일한 데이터입니다."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        ),
        Tool(
            name="list_findings",
            description=(
                "active+unmitigated finding 리스트를 반환합니다. severity와 category로 필터링 가능합니다. "
                "각 항목에는 id, title, cve, component, file_path, dd_url 등이 포함됩니다."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["Critical", "High", "Medium", "Low", "Info"],
                        "description": "특정 심각도만 필터. 미지정 시 전체.",
                    },
                    "category": {
                        "type": "string",
                        "enum": ["pip", "npm", "dockerfile", "other"],
                        "description": "특정 카테고리만 필터. 미지정 시 전체.",
                    },
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 200,
                        "default": 50,
                        "description": "최대 반환 개수. 기본 50, 최대 200.",
                    },
                },
                "additionalProperties": False,
            },
        ),
        Tool(
            name="get_finding_detail",
            description=(
                "특정 finding의 상세 정보를 반환합니다. description, mitigation, references, impact 등 "
                "리스트에서는 생략된 필드를 포함합니다. finding id는 list_findings로 먼저 확인하세요."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "finding_id": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "DefectDojo finding의 정수 ID.",
                    },
                },
                "required": ["finding_id"],
                "additionalProperties": False,
            },
        ),
        Tool(
            name="get_health",
            description=(
                "DefectDojo 서버 연결 상태와 사용 중인 URL/engagement_id를 반환합니다. "
                "다른 도구가 실패할 때 진단용으로 먼저 호출하세요."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        ),
        Tool(
            name="compare_with_last_week",
            description=(
                "최근 7일간 새로 등장한 finding과 mitigated 처리된 finding을 비교합니다. "
                "주간 보안 운영 리포트나 트렌드 파악에 사용합니다."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_security_summary":
        result = tool_get_security_summary()
    elif name == "list_findings":
        result = tool_list_findings(
            severity=arguments.get("severity"),
            category=arguments.get("category"),
            limit=int(arguments.get("limit") or 50),
        )
    elif name == "get_finding_detail":
        result = tool_get_finding_detail(finding_id=int(arguments["finding_id"]))
    elif name == "get_health":
        result = tool_get_health()
    elif name == "compare_with_last_week":
        result = tool_compare_with_last_week()
    else:
        result = {"error": f"알 수 없는 도구: {name}"}

    return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
