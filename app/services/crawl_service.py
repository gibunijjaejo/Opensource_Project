import httpx
from bs4 import BeautifulSoup
from rapidfuzz import process, fuzz
from sqlalchemy.orm import Session
from app.models.professor import Professor, ProfessorDetail

BASE_URL = "https://cs.sogang.ac.kr"
LIST_URL = f"{BASE_URL}/cs/cs02_1_001.html"


def _fetch(url: str) -> BeautifulSoup:
    with httpx.Client(timeout=10, follow_redirects=True) as client:
        res = client.get(url)
        res.raise_for_status()
    return BeautifulSoup(res.text, "html.parser")


def _normalize(text: str) -> str:
    """&nbsp; 등 공백 문자 정규화"""
    return text.replace("\xa0", " ").strip()


def _extract_text_after_label(td, label: str) -> str | None:
    """<b> 또는 <strong> label 바로 뒤 텍스트 노드를 반환"""
    for tag in td.find_all(["b", "strong"]):
        tag_text = _normalize(tag.get_text())
        if label in tag_text:
            node = tag.next_sibling
            while node:
                text = _normalize(str(node) if not hasattr(node, "get_text") else node.get_text())
                text = text.lstrip(":").strip()
                if text:
                    return text
                node = node.next_sibling
    return None


def _parse_detail_page(url: str) -> dict:
    soup = _fetch(url)
    rows = soup.select("div.table_gsis table tr")
    result = {"name": None, "email": None, "lab": None, "specialty": None, "research_area": None, "homepage": None}

    if not rows:
        return result

    # 첫 번째 행 오른쪽 td에서 기본 정보 추출
    first_row_tds = rows[0].find_all("td")
    if len(first_row_tds) >= 2:
        info_td = first_row_tds[-1]

        # 이름 (왼쪽 td의 strong 또는 span)
        left_td = first_row_tds[0]
        name_tag = left_td.find("strong") or left_td.find("span")
        if name_tag:
            result["name"] = name_tag.get_text(strip=True)

        # 연구실
        result["lab"] = (
            _extract_text_after_label(info_td, "연 구 실")
            or _extract_text_after_label(info_td, "연구실")
        )

        # 세부전공
        result["specialty"] = (
            _extract_text_after_label(info_td, "세부전공")
            or _extract_text_after_label(info_td, "전공")
        )

        # 이메일 — mailto 링크 또는 평문 텍스트 둘 다 처리
        mailto = info_td.find("a", href=lambda h: h and h.startswith("mailto:"))
        if mailto:
            result["email"] = mailto.get_text(strip=True)
        else:
            result["email"] = (
                _extract_text_after_label(info_td, "e-mail")
                or _extract_text_after_label(info_td, "Email")
                or _extract_text_after_label(info_td, "E-mail")
            )

    # 연구실 소개 섹션 — 행 인덱스 대신 "연구분야" 텍스트가 있는 행을 탐색
    for row in rows[1:]:
        row_text = row.get_text()
        if "연구분야" not in row_text and "홈페이지" not in row_text:
            continue
        detail_td = row.find("td")
        if not detail_td:
            continue

        # 홈페이지 — href가 http로 시작하는 첫 번째 a 태그
        for a_tag in detail_td.find_all("a", href=True):
            href = a_tag.get("href", "")
            if href.startswith("http"):
                result["homepage"] = href
                break

        # 연구분야 — "연구분야" 이후 텍스트 전체 추출
        full_text = detail_td.get_text(separator="\n")
        full_text = _normalize(full_text)
        if "연구분야" in full_text:
            after = full_text.split("연구분야", maxsplit=1)[1]
            after = after.lstrip(":\n ").strip()
            lines = [line.strip() for line in after.splitlines() if line.strip() and line.strip() not in ("\xa0", "")]
            text = " ".join(lines)
            if text:
                result["research_area"] = text
        break

    return result


def _clean_name(raw: str) -> str:
    """'김세준 교수', '조성인 교수(컴퓨터공학과 겸직)' → '김세준'"""
    import re
    # 괄호 및 괄호 안 내용 제거
    name = re.sub(r"\(.*?\)", "", raw)
    # '교수', '명예교수' 등 직함 제거
    name = re.sub(r"\s*(명예|겸직|초빙|특훈)?\s*교수", "", name)
    return name.strip()


def _parse_list_page() -> list[dict]:
    """목록 페이지에서 (name, detail_url) 수집"""
    soup = _fetch(LIST_URL)
    professors = []

    for row in soup.select("div.table_gsis table tr"):
        tds = row.find_all("td")
        if len(tds) < 2:
            continue
        info_td = tds[-1]

        # 교수명 — font-size:16pt span
        name_span = info_td.find("span", style=lambda s: s and "16pt" in s)
        if not name_span:
            continue
        name = _clean_name(name_span.get_text(strip=True))
        if not name:
            continue

        # 상세 페이지 링크
        link = info_td.find("a", class_="tx-link")
        detail_url = BASE_URL + link["href"] if link and link.get("href") else None

        professors.append({"name": name, "detail_url": detail_url})

    return professors


def crawl_and_upsert(db: Session) -> dict:
    web_professors = _parse_list_page()
    db_professors = db.query(Professor).all()
    db_name_map = {p.name: p for p in db_professors}
    db_names = list(db_name_map.keys())

    updated = []
    not_found_in_db = []

    for wp in web_professors:
        web_name = wp["name"]
        match_type = None
        matched_db_name = None

        # 1. 정확히 일치하는 교수 찾기
        matched_professor = db_name_map.get(web_name)
        if matched_professor:
            match_type = "exact"
            matched_db_name = web_name

        # 2. 없으면 fuzzy 매칭 (score >= 85)
        if not matched_professor and db_names:
            fuzzy_result = process.extractOne(web_name, db_names, scorer=fuzz.ratio)
            if fuzzy_result and fuzzy_result[1] >= 85:
                matched_professor = db_name_map[fuzzy_result[0]]
                match_type = "fuzzy"
                matched_db_name = fuzzy_result[0]

        if not matched_professor:
            not_found_in_db.append({
                "web_name": web_name,
                "detail_url": wp["detail_url"],
            })
            continue

        # 상세 페이지 크롤링
        crawl_error = None
        detail = {}
        if wp["detail_url"]:
            try:
                detail = _parse_detail_page(wp["detail_url"])
            except Exception as e:
                crawl_error = str(e)
                detail = {}

        # professor_details upsert
        existing = db.query(ProfessorDetail).filter(
            ProfessorDetail.professor_id == matched_professor.professor_id
        ).first()

        if existing:
            existing.name = detail.get("name") or web_name
            existing.email = detail.get("email")
            existing.specialty = detail.get("specialty")
            existing.research_area = detail.get("research_area")
            existing.homepage = detail.get("homepage")
        else:
            db.add(ProfessorDetail(
                professor_id=matched_professor.professor_id,
                name=detail.get("name") or web_name,
                email=detail.get("email"),
                specialty=detail.get("specialty"),
                research_area=detail.get("research_area"),
                homepage=detail.get("homepage"),
            ))

        updated.append({
            "web_name": web_name,
            "db_name": matched_db_name,
            "match_type": match_type,
            "detail_url": wp["detail_url"],
            "crawl_error": crawl_error,
            "saved": {
                "name": detail.get("name"),
                "email": detail.get("email"),
                "specialty": detail.get("specialty"),
                "research_area": detail.get("research_area"),
                "homepage": detail.get("homepage"),
            },
        })

    db.commit()

    # DB에만 있고 웹에 없는 교수
    web_names_set = {wp["name"] for wp in web_professors}
    db_only = [
        p.name for p in db_professors
        if p.name not in web_names_set
        and not process.extractOne(p.name, list(web_names_set), scorer=fuzz.ratio, score_cutoff=85)
    ]

    return {
        "updated_count": len(updated),
        "not_found_count": len(not_found_in_db),
        "db_only_count": len(db_only),
        "updated": updated,
        "not_found_in_db": not_found_in_db,
        "db_only": db_only,
    }
