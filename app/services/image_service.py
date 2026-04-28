# 이미지 처리 로직

import logging
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple, Set

import httpx
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.models.course import Course

logger = logging.getLogger(__name__)

DEFAULT_MATCH_THRESHOLD = 68.0

# OCR 혼동 문자 정규화 테이블 (compute_similarity 내부 전용)
# 0↔O, 5↔S(SW 오인식 대응)
_CONFUSION_TABLE = str.maketrans({"0": "o", "5": "s"})

# JAVA언어에서 "언어"가 잘못 인식되는 패턴들 ("io", "lO", "10", "H", "IO" 등)
_JAVA_SUFFIX_PATTERN = re.compile(r"(java)(io|lo|l0|10|lO|IO|iO|h|언0|언o)", re.IGNORECASE)


def _confusion_normalize(text: str) -> str:
    """normalize_text 결과에 추가로 OCR 혼동 문자를 정규화합니다."""
    text = text.translate(_CONFUSION_TABLE)
    # JAVA 뒤 "언어" 오인식 패턴 보정
    text = _JAVA_SUFFIX_PATTERN.sub(r"\1언어", text)
    return text

_WEEKDAY_WORDS = {"월", "화", "수", "목", "금", "토", "일"}
_WEEKDAY_LONG_WORDS = {
    "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"
}

# 같은 시간표에 아래 과목 중 하나라도 있으면
# OCR이 '컴퓨터프로그래밍I'로 잡혀도 '컴퓨터프로그래밍II'로 보정
CP2_TRIGGER_COURSES = {
    "이산구조",
    "디지털회로개론",
    "운영체제",
    "문재해결프로그래밍실습",
    "JAVA언어",
    "딥러닝개론",
}


def normalize_course_suffix(text: str) -> str:
    if not text:
        return text

    text = text.strip()

    if re.search(r"[0-9]$", text):
        return text

    m = re.match(r"^(.*[가-힣A-Za-z])(\|\|\||III|111|lll|IIl|lII|IlI)$", text)
    if m:
        return m.group(1) + "3"

    m = re.match(r"^(.*[가-힣A-Za-z])(\|\||II|11|ll|Il|lI)$", text)
    if m:
        return m.group(1) + "2"

    m = re.match(r"^(.*[가-힣A-Za-z])(\||I|1|l)$", text)
    if m:
        return m.group(1) + "1"

    return text


def normalize_text(text: str) -> str:
    if not text:
        return ""

    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", "", text)
    text = normalize_course_suffix(text)
    text = text.lower()
    text = re.sub(r"[^0-9a-z가-힣\(\)\[\],:&+\-]", "", text)
    text = re.sub(r"([,:&+\-\(\)\[\]])\1+", r"\1", text)
    return text.strip()


def _english_char_ratio(text: str) -> float:
    """알파벳 문자 중 영어(ASCII) 비율을 반환합니다."""
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return 0.0
    return sum(1 for c in alpha if c.isascii()) / len(alpha)


def clean_display_text(text: str) -> str:
    if not text:
        return ""

    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    text = normalize_course_suffix(text)
    return text


def is_time_like(text: str) -> bool:
    text = clean_display_text(text)
    if not text:
        return False

    if re.fullmatch(r"\d{1,2}:\d{2}", text):
        return True
    if re.fullmatch(r"\d{1,2}\s*교시", text):
        return True
    if re.fullmatch(r"\d{1,2}", text):
        return True
    return False


def is_room_like(text: str) -> bool:
    text = clean_display_text(text)
    norm = normalize_text(text)

    if not norm:
        return False

    # 기존 패턴: ab123, k302, 302, 302a
    if re.fullmatch(r"[a-z]{2,3}\d{2,4}", norm):
        return True
    if re.fullmatch(r"[a-z]\d{3,4}", norm):
        return True
    if re.fullmatch(r"\d{3,4}[a-z]?", norm):
        return True

    # 확장 패턴: "공학관302", "정보관k201", "강의동a301" 형태
    if re.fullmatch(r"[가-힣]{2,4}[a-z]?\d{3,4}[a-z]?", norm):
        return True
    # "온라인", "비대면" 같은 강의실 대체 표기는 제외 (오탐 방지)

    return False


def is_probable_course_candidate(text: str) -> bool:
    if not text:
        return False

    display = clean_display_text(text)
    normalized = normalize_text(display)

    if not normalized:
        return False

    if display in _WEEKDAY_WORDS or display in _WEEKDAY_LONG_WORDS:
        return False
    if normalized in _WEEKDAY_WORDS:
        return False
    if is_time_like(display):
        return False
    if is_room_like(display):
        return False

    if normalized.isdigit():
        return False

    if len(normalized) < 3:
        return False

    return True


def normalized_is_pure_time_or_index(norm: str, display: str) -> bool:
    if is_time_like(display):
        return True
    if norm.isdigit():
        return True
    return False


def is_course_line_like(text: str) -> bool:
    display = clean_display_text(text)
    norm = normalize_text(display)

    if not norm:
        return False

    if display in _WEEKDAY_WORDS or display in _WEEKDAY_LONG_WORDS:
        return False
    if normalized_is_pure_time_or_index(norm, display):
        return False
    if is_room_like(display):
        return False

    if len(norm) < 2:
        # 한 글자 한국어는 카드 내 줄바꿈 말미일 수 있으므로 허용
        # ("론" ← 디지털회로개론, "안" ← 해킹및정보보안, "습" ← ...개발실습 등)
        return re.fullmatch(r"[가-힣]", norm) is not None

    return True


def extract_structured_ocr(image_path: str) -> Tuple[List[str], Optional[int], Optional[int]]:
    """OCR 서비스를 호출해 (course_names, year, semester)를 반환합니다."""
    ocr_service_url = os.getenv("OCR_SERVICE_URL", "http://ocr-service:8000")
    try:
        with open(image_path, "rb") as f:
            response = httpx.post(
                f"{ocr_service_url}/ocr",
                files={"file": f},
                timeout=60.0,
            )
        response.raise_for_status()
        data = response.json()
        return data.get("course_names", []), data.get("year"), data.get("semester")
    except httpx.TimeoutException:
        logger.error("OCR 서비스 타임아웃: %s", image_path)
        raise
    except httpx.HTTPError as e:
        logger.error("OCR 서비스 HTTP 오류: %s", e)
        raise


def horizontal_overlap_ratio(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    if overlap <= 0:
        return 0.0
    min_width = max(min(a["width"], b["width"]), 1.0)
    return overlap / min_width


def should_merge_course_lines(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    if not is_course_line_like(a["display_text"]) or not is_course_line_like(b["display_text"]):
        return False

    if b["y_center"] < a["y_center"]:
        a, b = b, a

    vertical_gap = b["y_min"] - a["y_max"]
    if vertical_gap < -max(a["height"], b["height"]) * 0.35:
        return False

    height_ref = max(a["height"], b["height"], 1.0)
    width_ref = max(a["width"], b["width"], 1.0)
    x_overlap = horizontal_overlap_ratio(a, b)
    center_diff = abs(a["x_center"] - b["x_center"])

    same_column_like = (
        x_overlap >= 0.25
        or center_diff <= width_ref * 0.55
    )

    if not same_column_like:
        return False

    a_norm = normalize_text(a["display_text"])
    b_norm = normalize_text(b["display_text"])

    # 강의실 번호 블록(K302, A101 등) 병합 차단
    if len(b_norm) <= 5 and re.fullmatch(r"[a-z]?\d{3,4}[a-z]?", b_norm):
        return False

    # 줄바꿈 말미 단독 한 글자 한국어 (론/안/습/론 등)
    # 반드시 같은 카드 안(매우 좁은 수직 거리)이어야 병합 허용
    if len(b_norm) == 1 and re.fullmatch(r"[가-힣]", b_norm):
        if vertical_gap > height_ref * 1.5:
            return False
        return len(a_norm) >= 3

    # 기본 수직 거리 제한 (카드 경계 넘기 방지)
    if vertical_gap > height_ref * 2.2:
        return False

    # 양쪽 다 긴 텍스트(서로 다른 과목명일 가능성)는 더 강한 x 겹침 요구
    if len(a_norm) >= 6 and len(b_norm) >= 4:
        if x_overlap < 0.35:
            return False

    short_tail = len(b_norm) <= 6
    likely_wrapped_title = len(a_norm) >= 4 and len(b_norm) >= 2

    return short_tail or likely_wrapped_title


def build_merge_graph(blocks: List[Dict[str, Any]]) -> Dict[int, Set[int]]:
    graph: Dict[int, Set[int]] = {i: set() for i in range(len(blocks))}
    sorted_indices = sorted(range(len(blocks)), key=lambda i: (blocks[i]["y_center"], blocks[i]["x_center"]))

    for pos, i in enumerate(sorted_indices):
        a = blocks[i]

        for j in sorted_indices[pos + 1:]:
            b = blocks[j]

            if b["y_min"] - a["y_max"] > max(a["height"], b["height"]) * 2.2:
                break

            if should_merge_course_lines(a, b):
                graph[i].add(j)
                graph[j].add(i)

    return graph


def connected_components(graph: Dict[int, Set[int]]) -> List[List[int]]:
    visited: Set[int] = set()
    comps: List[List[int]] = []

    for node in graph:
        if node in visited:
            continue

        stack = [node]
        comp = []
        visited.add(node)

        while stack:
            cur = stack.pop()
            comp.append(cur)
            for nxt in graph[cur]:
                if nxt not in visited:
                    visited.add(nxt)
                    stack.append(nxt)

        comps.append(sorted(comp))
    return comps


def _merge_group(group: List[Dict[str, Any]]) -> Dict[str, Any]:
    group = sorted(group, key=lambda b: (b["y_center"], b["x_center"]))

    merged_text = "".join(clean_display_text(item["text"]) for item in group)
    merged_text = clean_display_text(merged_text)

    x_min = min(item["x_min"] for item in group)
    x_max = max(item["x_max"] for item in group)
    y_min = min(item["y_min"] for item in group)
    y_max = max(item["y_max"] for item in group)

    return {
        "source_ids": [item["id"] for item in group],
        "text": merged_text,
        "display_text": merged_text,
        "normalized_text": normalize_text(merged_text),
        "confidence": round(sum(item["confidence"] for item in group) / len(group), 4),
        "bbox": [item["bbox"] for item in group],
        "x_min": x_min,
        "x_max": x_max,
        "y_min": y_min,
        "y_max": y_max,
        "width": x_max - x_min,
        "height": y_max - y_min,
        "x_center": (x_min + x_max) / 2,
        "y_center": (y_min + y_max) / 2,
        "merged_count": len(group),
    }


def merge_nearby_blocks(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not blocks:
        return []

    graph = build_merge_graph(blocks)
    comps = connected_components(graph)

    merged: List[Dict[str, Any]] = []
    for comp in comps:
        group = [blocks[i] for i in comp]
        merged.append(_merge_group(group))

    merged.sort(key=lambda b: (b["y_center"], b["x_center"]))
    return merged


def deduplicate_course_names(course_names: List[str]) -> List[str]:
    seen = set()
    result: List[str] = []

    for name in course_names:
        display = clean_display_text(name)
        normalized = normalize_text(display)

        if not normalized:
            continue
        if normalized in seen:
            continue

        seen.add(normalized)
        result.append(display)

    return result


# merged block의 정규화 길이가 이 값을 초과하면 과도한 병합으로 판단하여
# merged 결과 대신 구성 raw 블록들을 개별 후보로 사용
_MAX_MERGED_NORM_LEN = 18

# OCR 노이즈 접두사 제거: ASCII 잡음 뒤 한국어 4글자 이상이 시작되면 한국어 부분만 추출
_KOREAN_START_RE = re.compile(r"[가-힣]{4,}.*")


def _clean_noise_prefix(text: str) -> Optional[str]:
    """
    "yecxf로캡스톤디자인" → "캡스톤디자인"
    OCR 잡음 접두사가 붙은 텍스트에서 의미 있는 한국어 부분만 반환합니다.
    접두사가 없거나 너무 짧은 한국어면 None 반환.
    """
    norm = normalize_text(text)
    m = _KOREAN_START_RE.search(norm)
    if m and m.start() >= 2:  # 앞에 2글자 이상 잡음이 있을 때만
        return m.group(0)
    return None


def build_course_candidates(
    raw_blocks: List[Dict[str, Any]],
    merged_blocks: List[Dict[str, Any]],
) -> List[str]:
    candidates: List[str] = []

    # raw 블록 id → 블록 매핑 (과도한 병합 시 fallback용)
    raw_block_by_id: Dict[int, Dict[str, Any]] = {b["id"]: b for b in raw_blocks}

    merged_source_ids: Set[int] = set()
    for block in merged_blocks:
        for sid in block.get("source_ids", []):
            merged_source_ids.add(sid)

    for block in merged_blocks:
        norm = normalize_text(block["display_text"])

        if len(norm) > _MAX_MERGED_NORM_LEN:
            # 과도한 병합: 구성 raw 블록들을 개별 후보로 사용
            for sid in block.get("source_ids", []):
                raw_b = raw_block_by_id.get(sid)
                if raw_b and is_probable_course_candidate(raw_b["display_text"]):
                    candidates.append(raw_b["display_text"])
        elif is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])
            # 노이즈 접두사 버전도 추가 후보로 등록
            cleaned = _clean_noise_prefix(block["display_text"])
            if cleaned:
                candidates.append(cleaned)

    for block in raw_blocks:
        if block["id"] in merged_source_ids:
            continue
        if is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])
            cleaned = _clean_noise_prefix(block["display_text"])
            if cleaned:
                candidates.append(cleaned)

    return deduplicate_course_names(candidates)


def extract_year_semester_from_blocks(
    blocks: List[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[int]]:
    if not blocks:
        return None, None

    # P1: "XXXX년 X학기" 완전한 패턴
    full_re = re.compile(r"(20[12][0-9])\s*년[^0-9]{0,8}([1-4])\s*학기")
    # P2: 연도+숫자 같은 블록 (OCR 오인식 대응)
    #     "2022E 2l" → 2022년 2학기, "2026 17l" → 2026년 1학기
    year_sem_re = re.compile(r"(20[12][0-9])[^0-9]{0,6}([1-4])")
    # P3: "X학기" 단독
    semester_re = re.compile(r"([1-4])\s*학기")
    # P4: 연도만 (마지막 fallback)
    year_re = re.compile(r"(20[12][0-9])(?!\d)")

    sorted_by_y = sorted(blocks, key=lambda b: b["y_center"])
    search_order = [sorted_by_y[:20], sorted_by_y[20:]]

    found_year: Optional[int] = None
    found_semester: Optional[int] = None

    for block_group in search_order:
        for block in block_group:
            text = block["display_text"]

            # P1
            if found_year is None or found_semester is None:
                m = full_re.search(text)
                if m:
                    found_year = int(m.group(1))
                    found_semester = int(m.group(2))

            # P2: 같은 블록에서 연도·학기 번호 동시 추출
            if found_year is None or found_semester is None:
                m = year_sem_re.search(text)
                if m:
                    y, s = int(m.group(1)), int(m.group(2))
                    if 2010 <= y <= 2040:
                        if found_year is None:
                            found_year = y
                        if found_semester is None:
                            found_semester = s

            # P3: 학기만
            if found_semester is None:
                m = semester_re.search(text)
                if m:
                    found_semester = int(m.group(1))

            # P4: 연도만
            if found_year is None:
                m = year_re.search(text)
                if m:
                    y = int(m.group(1))
                    if 2010 <= y <= 2040:
                        found_year = y

        if found_year is not None and found_semester is not None:
            break

    return found_year, found_semester


def _score_pair(na: str, nb: str) -> float:
    """정규화된 두 문자열 쌍의 유사도 점수를 계산합니다."""
    len_a, len_b = len(na), len(nb)
    ratio_score = fuzz.ratio(na, nb)
    token_sort_score = fuzz.token_sort_ratio(na, nb)
    token_set_score = fuzz.token_set_ratio(na, nb)
    partial_score = fuzz.partial_ratio(na, nb)

    min_len = min(len_a, len_b)
    max_len = max(len_a, len_b)

    if min_len >= 4 and (nb in na or na in nb) and max_len > min_len * 1.25:
        # 한쪽이 다른 쪽에 포함된 경우 (예: "캡스톤디자인(캡스톤디자인)" ↔ "캡스톤디자인",
        #                               OCR 부분 인식 "sw개발실습" ↔ "오픈소스를이용한sw개발실습")
        return float(max(ratio_score, token_sort_score, partial_score))
    else:
        len_ratio = min_len / max_len
        penalized_partial = partial_score * len_ratio
        penalized_token_set = token_set_score * len_ratio
        return float(max(ratio_score, token_sort_score, penalized_partial, penalized_token_set))


def compute_similarity(a: str, b: str) -> float:
    na = normalize_text(a)
    nb = normalize_text(b)

    if not na or not nb:
        return 0.0

    score = _score_pair(na, nb)

    # confusion-normalized 비교: 0↔O, 5↔S 같은 OCR 오인식 보정
    # (양쪽 모두 같은 변환을 적용하므로 의미 손실 없음)
    cna = _confusion_normalize(na)
    cnb = _confusion_normalize(nb)
    if cna != na or cnb != nb:
        score = max(score, _score_pair(cna, cnb))

    return score


def _deduplicate_matched_courses(matched_courses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best_by_code: Dict[str, Dict[str, Any]] = {}

    for item in matched_courses:
        course_code = item["course_code"]
        prev = best_by_code.get(course_code)

        if prev is None or item["score"] > prev["score"]:
            best_by_code[course_code] = item

    return list(best_by_code.values())


def _find_best_course_by_exact_name(
    db: Session,
    course_name: str,
    year: Optional[int] = None,
    semester: Optional[int] = None,
) -> Optional[Course]:
    query = db.query(Course).filter(Course.course_name == course_name)
    if year is not None:
        query = query.filter(Course.year == year)
    if semester is not None:
        query = query.filter(Course.semester == semester)
    return query.order_by(Course.year.desc(), Course.semester.desc(), Course.course_id.desc()).first()


def apply_cp1_to_cp2_rule(
    matched_courses: List[Dict[str, Any]],
    db: Session,
    year: Optional[int] = None,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not matched_courses:
        return matched_courses

    matched_names = {item["matched_course_name"] for item in matched_courses}

    has_trigger_course = any(name in matched_names for name in CP2_TRIGGER_COURSES)
    if not has_trigger_course:
        return matched_courses

    cp2_course = _find_best_course_by_exact_name(db, "컴퓨터프로그래밍II", year=year, semester=semester)
    if cp2_course is None:
        return matched_courses

    adjusted: List[Dict[str, Any]] = []

    for item in matched_courses:
        if item["matched_course_name"] == "컴퓨터프로그래밍I":
            new_item = dict(item)
            new_item["matched_course_name"] = cp2_course.course_name
            new_item["course_code"] = cp2_course.course_code
            new_item["course_id"] = cp2_course.course_id
            new_item["rule_applied"] = "cp1_to_cp2_by_timetable_context"
            adjusted.append(new_item)
        else:
            adjusted.append(item)

    return _deduplicate_matched_courses(adjusted)


def _adaptive_threshold(candidate: str, base: float) -> float:
    ratio = _english_char_ratio(candidate)
    if ratio >= 0.5:
        return max(base - 8.0, 58.0)
    if ratio >= 0.2:
        return max(base - 4.0, 62.0)

    # 정규화된 길이가 짧은 과목명은 임계값 완화
    norm = normalize_text(candidate)
    if len(norm) <= 5:
        return max(base - 6.0, 60.0)
    if len(norm) <= 8:
        return max(base - 3.0, 62.0)

    return base


def match_courses_to_db(
    course_names: List[str],
    db: Session,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
    year: Optional[int] = None,
    semester: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    query = db.query(Course)
    if year is not None:
        query = query.filter(Course.year == year)
    if semester is not None:
        query = query.filter(Course.semester == semester)
    courses = query.all()

    if not courses:
        # 해당 년도/학기 과목이 없으면 전체 DB에서 fallback
        courses = db.query(Course).all()

    if not courses:
        return [], [{"ocr_text": name, "reason": "no_courses_in_db"} for name in course_names]

    matched_courses: List[Dict[str, Any]] = []
    ignored_candidates: List[Dict[str, Any]] = []

    for candidate in course_names:
        best_course: Optional[Course] = None
        best_score = -1.0
        second_best_score = -1.0

        for course in courses:
            score = compute_similarity(candidate, course.course_name)

            if score > best_score:
                second_best_score = best_score
                best_score = score
                best_course = course
            elif score > second_best_score:
                second_best_score = score

        effective_threshold = _adaptive_threshold(candidate, threshold)
        if best_course and best_score >= effective_threshold:
            matched_courses.append(
                {
                    "ocr_text": candidate,
                    "normalized_ocr_text": normalize_text(candidate),
                    "matched_course_name": best_course.course_name,
                    "course_code": best_course.course_code,
                    "course_id": best_course.course_id,
                    "score": round(best_score, 2),
                    "second_score": round(second_best_score, 2) if second_best_score >= 0 else None,
                }
            )
        else:
            ignored_candidates.append(
                {
                    "ocr_text": candidate,
                    "best_score": round(best_score, 2) if best_score >= 0 else 0.0,
                    "second_score": round(second_best_score, 2) if second_best_score >= 0 else None,
                    "reason": "below_threshold",
                }
            )

    matched_courses = _deduplicate_matched_courses(matched_courses)
    matched_courses = apply_cp1_to_cp2_rule(matched_courses, db, year=year, semester=semester)

    return matched_courses, ignored_candidates


def process_timetable_image(
    image_path: str,
    db: Session,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> Dict[str, Any]:
    raw_blocks = extract_text_blocks(image_path)
    merged_blocks = merge_nearby_blocks(raw_blocks)
    candidates = build_course_candidates(raw_blocks, merged_blocks)
    detected_year, detected_semester = extract_year_semester_from_blocks(raw_blocks)
    matched_courses, ignored_candidates = match_courses_to_db(
        candidates, db, threshold=threshold, year=detected_year, semester=detected_semester
    )

    return {
        "image_path": image_path,
        "detected_year": detected_year,
        "detected_semester": detected_semester,
        "threshold": threshold,
        "raw_block_count": len(raw_blocks),
        "merged_block_count": len(merged_blocks),
        "candidate_course_names": candidates,
        "matched_courses": matched_courses,
        "ignored_candidates": ignored_candidates,
        "raw_blocks": [
            {
                "id": block["id"],
                "text": block["display_text"],
                "normalized_text": block["normalized_text"],
                "confidence": block["confidence"],
                "x_min": block["x_min"],
                "x_max": block["x_max"],
                "y_min": block["y_min"],
                "y_max": block["y_max"],
            }
            for block in raw_blocks
        ],
        "merged_blocks": [
            {
                "text": block["display_text"],
                "normalized_text": block["normalized_text"],
                "confidence": block["confidence"],
                "merged_count": block.get("merged_count", 1),
                "source_ids": block.get("source_ids", []),
                "x_min": block["x_min"],
                "x_max": block["x_max"],
                "y_min": block["y_min"],
                "y_max": block["y_max"],
            }
            for block in merged_blocks
        ],
    }
