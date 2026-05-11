"""관리자 보안 모니터링 — DefectDojo API를 호출해 취약점 요약·리스트를 제공.

흐름:
    [관리자 브라우저] → [팀서버 backend] ──HTTP──> [DefectDojo (163.239.77.65:8888)]

환경변수:
    DEFECTDOJO_URL         예) http://163.239.77.65:8888
    DEFECTDOJO_TOKEN       DefectDojo API token
    DEFECTDOJO_ENGAGEMENT  Engagement ID (예: 1)
"""
import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.admin import get_current_admin
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/security", tags=["Admin - Security"])

DD_URL = os.getenv("DEFECTDOJO_URL", "http://163.239.77.65:8888").rstrip("/")
DD_TOKEN = os.getenv("DEFECTDOJO_TOKEN", "")
DD_ENGAGEMENT = int(os.getenv("DEFECTDOJO_ENGAGEMENT", "1"))

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]


def _dd_get(path: str, params: Optional[dict] = None) -> dict:
    """DefectDojo API GET. 토큰 미설정·통신 실패 시 명시적 에러."""
    if not DD_TOKEN:
        raise HTTPException(503, "DefectDojo 토큰이 설정되지 않았습니다.")
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
        logger.warning("DefectDojo HTTP %s on %s", e.response.status_code, path)
        raise HTTPException(502, f"DefectDojo 응답 오류 ({e.response.status_code})")
    except httpx.RequestError as e:
        logger.warning("DefectDojo connection error: %s", e)
        raise HTTPException(503, "DefectDojo 서버에 연결할 수 없습니다.")


def _categorize(component_name: Optional[str], file_path: Optional[str], title: str) -> str:
    """finding을 우리 도메인에 맞게 분류."""
    fp = (file_path or "").lower()
    name = (component_name or "").lower()
    t = (title or "").lower()
    if "dockerfile" in fp or "docker" in t or t.startswith("ds-"):
        return "dockerfile"
    if "requirements" in fp or "python" in name or name in {"pillow", "python-jose", "python-multipart", "django"}:
        return "pip"
    if "package.json" in fp or "pnpm-lock" in fp or "node_modules" in fp or name in {"next", "lodash", "react"}:
        return "npm"
    if name and "/" in name:  # ghsa 형식
        return "npm"
    return "other"


def _format_finding(f: dict) -> dict:
    cat = _categorize(f.get("component_name"), f.get("file_path"), f.get("title", ""))
    return {
        "id": f["id"],
        "title": f.get("title") or "",
        "severity": f.get("severity") or "Info",
        "cve": f.get("cve") or None,
        "cwe": f.get("cwe") or None,
        "component_name": f.get("component_name") or None,
        "component_version": f.get("component_version") or None,
        "file_path": f.get("file_path") or None,
        "description": f.get("description") or None,
        "mitigation": f.get("mitigation") or None,
        "references": f.get("references") or None,
        "found_date": f.get("date") or None,
        "is_mitigated": bool(f.get("is_mitigated")),
        "risk_accepted": bool(f.get("risk_accepted")),
        "dd_url": f"{DD_URL}/finding/{f['id']}",
        "category": cat,
    }


@router.get("/summary")
def get_summary(admin: User = Depends(get_current_admin)) -> dict:
    """심각도별 + 카테고리별 취약점 카운트.

    응답 예:
        {
            "critical": 1, "high": 12, "medium": 0, "low": 0, "info": 0, "total": 13,
            "by_category": {"pip": 7, "npm": 2, "dockerfile": 3, "other": 1},
            "last_updated": "2026-05-07",
            "engagement_url": "http://.../engagement/1"
        }
    """
    summary = {s.lower(): 0 for s in SEVERITY_ORDER}
    summary["total"] = 0
    by_category = {"pip": 0, "npm": 0, "dockerfile": 0, "other": 0}
    last_updated: Optional[str] = None

    # severity별 count는 limit=1 + count 필드로 빠르게
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

    # 카테고리 분류 + 최근 업데이트는 finding 일부 조회로 추론
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


@router.get("/findings")
def get_findings(
    severity: Optional[str] = Query(None, description="Critical/High/Medium/Low/Info"),
    category: Optional[str] = Query(None, description="pip/npm/dockerfile/other"),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
) -> dict:
    """발견된 취약점 리스트. severity·category로 필터 가능."""
    params = {
        "engagement": DD_ENGAGEMENT,
        "active": "true",
        "is_mitigated": "false",
        "limit": limit,
        "ordering": "numerical_severity",  # Critical → Info 순
    }
    if severity:
        params["severity"] = severity.capitalize()

    data = _dd_get("/api/v2/findings/", params)
    items = [_format_finding(f) for f in data.get("results", [])]
    if category:
        items = [it for it in items if it["category"] == category]
    return {"count": len(items), "items": items}


@router.get("/health")
def health(admin: User = Depends(get_current_admin)) -> dict:
    """DefectDojo 연결 상태 점검 (관리자 페이지에서 표시용)."""
    if not DD_TOKEN:
        return {"connected": False, "reason": "DEFECTDOJO_TOKEN 미설정"}
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
