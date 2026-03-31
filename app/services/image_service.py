# 이미지 처리 로직

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple, Set

import numpy as np
from PIL import Image, ImageEnhance
from paddleocr import PaddleOCR
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.models.course import Course


_OCR_ENGINE_KO: Optional[PaddleOCR] = None
_OCR_ENGINE_EN: Optional[PaddleOCR] = None

DEFAULT_MATCH_THRESHOLD = 78.0

# OCR 인식 신뢰도 최솟값 — 이 값 미만인 블록은 노이즈로 간주하고 제외
_MIN_OCR_CONFIDENCE = 0.5

# 듀얼 OCR 병합 파라미터
# EN 엔진 결과를 신뢰하려면 영어 알파벳 비율·신뢰도가 이 값 이상이어야 함
_EN_ENGLISH_RATIO_MIN = 0.5
_EN_CONFIDENCE_MIN    = 0.65
# 두 블록이 "같은 위치"로 간주되는 IoU 하한
_IOU_OVERLAP_MIN = 0.3

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


def get_ocr_engine(lang: str = "korean") -> PaddleOCR:
    global _OCR_ENGINE_KO, _OCR_ENGINE_EN
    _OCR_PARAMS = dict(
        use_angle_cls=True,
        show_log=False,
        det_db_thresh=0.2,
        det_db_box_thresh=0.5,
        det_db_unclip_ratio=1.8,
    )
    if lang == "en":
        if _OCR_ENGINE_EN is None:
            _OCR_ENGINE_EN = PaddleOCR(lang="en", **_OCR_PARAMS)
        return _OCR_ENGINE_EN
    if _OCR_ENGINE_KO is None:
        _OCR_ENGINE_KO = PaddleOCR(lang="korean", **_OCR_PARAMS)
    return _OCR_ENGINE_KO


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """
    OCR 정확도를 높이기 위한 이미지 전처리.
    1. 해상도가 낮으면 upscale (PaddleOCR은 큰 이미지에서 정확도가 높음)
    2. 대비(Contrast) 강화
    3. 선명도(Sharpness) 강화
    """
    w, h = image.size
    if w < 1200:
        scale = 1200 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    image = ImageEnhance.Contrast(image).enhance(1.3)
    image = ImageEnhance.Sharpness(image).enhance(1.5)
    return image


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
    """
    강의실 텍스트처럼 보이는 경우 판별.
    예: K401, AS303, J311, 401, B12
    """
    text = clean_display_text(text)
    norm = normalize_text(text)

    if not norm:
        return False

    # 영문 2~3자 + 숫자 2~4자리: AS303, BC12 등 강의실 패턴
    if re.fullmatch(r"[a-z]{2,3}\d{2,4}", norm):
        return True
    # 영문 1자 + 숫자 3~4자리: K401, J3112 등 (숫자 3자리 이상 요구로 오필터 방지)
    if re.fullmatch(r"[a-z]\d{3,4}", norm):
        return True
    # 숫자로 시작하는 강의실: 401, 3011 등
    if re.fullmatch(r"\d{3,4}[a-z]?", norm):
        return True

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
    """
    '과목명의 일부 줄'인지 넉넉하게 판정.
    예: '문제해결프로', '그래밍실습', '와분석' 같은 줄도 True가 되도록.
    """
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
        return False

    return True


def _bbox_stats(bbox: List[List[float]]) -> Dict[str, float]:
    xs = [pt[0] for pt in bbox]
    ys = [pt[1] for pt in bbox]

    x_min = min(xs)
    x_max = max(xs)
    y_min = min(ys)
    y_max = max(ys)

    return {
        "x_min": x_min,
        "x_max": x_max,
        "y_min": y_min,
        "y_max": y_max,
        "width": x_max - x_min,
        "height": y_max - y_min,
        "x_center": (x_min + x_max) / 2,
        "y_center": (y_min + y_max) / 2,
    }


def _bbox_iou(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    """두 블록 바운딩박스의 IoU(Intersection over Union)를 반환합니다."""
    x_overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    y_overlap = min(a["y_max"], b["y_max"]) - max(a["y_min"], b["y_min"])
    if x_overlap <= 0 or y_overlap <= 0:
        return 0.0
    intersection = x_overlap * y_overlap
    area_a = a["width"] * a["height"]
    area_b = b["width"] * b["height"]
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def _parse_ocr_result(ocr_result) -> List[Dict[str, Any]]:
    """PaddleOCR 결과를 블록 리스트로 파싱합니다 (id 미부여)."""
    blocks: List[Dict[str, Any]] = []
    if not ocr_result:
        return blocks
    for page in ocr_result:
        if not page:
            continue
        for line in page:
            if not line or len(line) < 2:
                continue
            bbox = line[0]
            text_info = line[1]
            if not text_info or len(text_info) < 2:
                continue
            raw_text = str(text_info[0]).strip()
            score = float(text_info[1])
            if not raw_text or score < _MIN_OCR_CONFIDENCE:
                continue
            stats = _bbox_stats(bbox)
            blocks.append({
                "text": raw_text,
                "display_text": clean_display_text(raw_text),
                "normalized_text": normalize_text(raw_text),
                "confidence": round(score, 4),
                "bbox": bbox,
                **stats,
            })
    return blocks


def _merge_dual_ocr_blocks(
    ko_blocks: List[Dict[str, Any]],
    en_blocks: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    KO OCR 결과를 기반으로 EN OCR 결과를 보완합니다.

    Pass 1: KO 블록과 위치가 겹치는 EN 블록이 있고 영어 비율·신뢰도가 기준 이상이면
            EN 결과로 교체 (KO 엔진이 영어를 오인식하는 문제 보정).
    Pass 2: KO가 아예 감지하지 못한 고신뢰도 영어 전용 블록은 추가.
    """
    result = list(ko_blocks)
    en_used: Set[int] = set()

    # Pass 1: 겹치는 KO 블록을 EN 블록으로 교체
    for i, ko_block in enumerate(result):
        best_iou = 0.0
        best_en_idx = -1
        for j, en_block in enumerate(en_blocks):
            iou = _bbox_iou(ko_block, en_block)
            if iou > best_iou:
                best_iou = iou
                best_en_idx = j

        if best_iou < _IOU_OVERLAP_MIN or best_en_idx < 0:
            continue

        en_block = en_blocks[best_en_idx]
        if (
            _english_char_ratio(en_block["text"]) >= _EN_ENGLISH_RATIO_MIN
            and en_block["confidence"] >= _EN_CONFIDENCE_MIN
        ):
            result[i] = en_block
            en_used.add(best_en_idx)

    # Pass 2: KO가 놓친 고신뢰도 영어 블록 추가
    for j, en_block in enumerate(en_blocks):
        if j in en_used:
            continue
        if (
            _english_char_ratio(en_block["text"]) >= _EN_ENGLISH_RATIO_MIN
            and en_block["confidence"] >= _EN_CONFIDENCE_MIN
        ):
            max_iou = max((_bbox_iou(ko, en_block) for ko in ko_blocks), default=0.0)
            if max_iou < _IOU_OVERLAP_MIN:
                result.append(en_block)

    return result


def extract_text_blocks(image_path: str) -> List[Dict[str, Any]]:
    image = Image.open(image_path).convert("RGB")
    image = preprocess_for_ocr(image)
    image_array = np.array(image)

    ko_blocks = _parse_ocr_result(get_ocr_engine("korean").ocr(image_array, cls=True))
    en_blocks = _parse_ocr_result(get_ocr_engine("en").ocr(image_array, cls=True))

    blocks = _merge_dual_ocr_blocks(ko_blocks, en_blocks)

    for idx, block in enumerate(blocks):
        block["id"] = idx

    return blocks


def horizontal_overlap_ratio(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    if overlap <= 0:
        return 0.0
    min_width = max(min(a["width"], b["width"]), 1.0)
    return overlap / min_width


def should_merge_course_lines(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """
    같은 셀 내부에서 여러 줄 과목명인지 판정.
    """
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

    if vertical_gap > height_ref * 2.2:
        return False

    a_norm = normalize_text(a["display_text"])
    b_norm = normalize_text(b["display_text"])

    short_tail = len(b_norm) <= 6
    likely_wrapped_title = len(a_norm) >= 4 and len(b_norm) >= 2

    return short_tail or likely_wrapped_title


def build_merge_graph(blocks: List[Dict[str, Any]]) -> Dict[int, Set[int]]:
    """
    인접 가능성이 있는 블록들끼리 그래프를 만들어 연결요소로 병합.
    """
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
    """
    같은 시간표 셀 안에서 여러 줄로 끊긴 과목명을 하나로 병합.
    """
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


def build_course_candidates(
    raw_blocks: List[Dict[str, Any]],
    merged_blocks: List[Dict[str, Any]],
) -> List[str]:
    candidates: List[str] = []

    merged_source_ids: Set[int] = set()
    for block in merged_blocks:
        for sid in block.get("source_ids", []):
            merged_source_ids.add(sid)

    for block in merged_blocks:
        if is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])

    for block in raw_blocks:
        if block["id"] in merged_source_ids:
            continue
        if is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])

    return deduplicate_course_names(candidates)


def extract_year_semester_from_blocks(
    blocks: List[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[int]]:
    """
    OCR 블록에서 연도·학기를 추출합니다.
    시간표 상단에 위치한 '2026년 1학기' 형태의 텍스트를 찾습니다.

    - y좌표 기준 상위 20개 블록을 우선 탐색합니다.
    - 찾지 못하면 전체 블록으로 범위를 확장합니다.
    - 추출 실패 시 (None, None)을 반환합니다.
    """
    if not blocks:
        return None, None

    year_re = re.compile(r"(\d{4})\s*년")
    semester_re = re.compile(r"([1-4])\s*학기")

    sorted_by_y = sorted(blocks, key=lambda b: b["y_center"])
    # 상단 20개 블록 우선, 못 찾으면 전체 탐색
    search_order = [sorted_by_y[:20], sorted_by_y[20:]]

    found_year: Optional[int] = None
    found_semester: Optional[int] = None

    for block_group in search_order:
        for block in block_group:
            text = block["display_text"]

            if found_year is None:
                m = year_re.search(text)
                if m:
                    found_year = int(m.group(1))

            if found_semester is None:
                m = semester_re.search(text)
                if m:
                    found_semester = int(m.group(1))

        if found_year is not None and found_semester is not None:
            break

    return found_year, found_semester


def compute_similarity(a: str, b: str) -> float:
    """
    OCR 후보(a)와 DB 과목명(b)의 유사도를 계산합니다.

    문제: fuzz.partial_ratio는 짧은 문자열이 긴 문자열에 포함될 때 과도하게 높은 점수를 줍니다.
         예) OCR="기초인공지능프로그래밍", DB="기초인공지능" → partial_ratio=100 (false positive)

    해결:
    1. DB 과목명(nb)이 OCR 텍스트(na) 안에 완전히 포함되고 OCR이 25% 이상 길면
       partial_ratio를 완전히 제외하고 ratio/token_sort_ratio만 사용합니다.
    2. 그 외 경우에는 길이 비율(len_ratio)을 곱해 partial_ratio에 패널티를 적용합니다.
       → OCR이 잘려 나온 경우(예: "데이터베이" vs "데이터베이스")는 여전히 높은 점수를 줍니다.
    """
    na = normalize_text(a)
    nb = normalize_text(b)

    if not na or not nb:
        return 0.0

    len_a, len_b = len(na), len(nb)

    ratio_score = fuzz.ratio(na, nb)
    token_sort_score = fuzz.token_sort_ratio(na, nb)
    partial_score = fuzz.partial_ratio(na, nb)

    # Case 1: DB 과목명이 OCR 텍스트에 포함되면서 OCR 텍스트가 더 긴 경우
    # → partial_ratio는 완전히 배제 (substring false positive 방지)
    if nb in na and len_a > len_b * 1.25:
        score = max(ratio_score, token_sort_score)
    else:
        # Case 2: 길이 차이에 비례해 partial_ratio에 패널티 적용
        len_ratio = min(len_a, len_b) / max(len_a, len_b)
        penalized_partial = partial_score * len_ratio
        score = max(ratio_score, token_sort_score, penalized_partial)

    return float(score)


def _deduplicate_matched_courses(matched_courses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best_by_code: Dict[str, Dict[str, Any]] = {}

    for item in matched_courses:
        course_code = item["course_code"]
        prev = best_by_code.get(course_code)

        if prev is None or item["score"] > prev["score"]:
            best_by_code[course_code] = item

    return list(best_by_code.values())


def _find_best_course_by_exact_name(db: Session, course_name: str) -> Optional[Course]:
    return (
        db.query(Course)
        .filter(Course.course_name == course_name)
        .order_by(Course.year.desc(), Course.semester.desc(), Course.course_id.desc())
        .first()
    )


def apply_cp1_to_cp2_rule(
    matched_courses: List[Dict[str, Any]],
    db: Session,
) -> List[Dict[str, Any]]:
    """
    같은 시간표 안에 특정 과목들이 존재하고 동시에 '컴퓨터프로그래밍I'이 잡히면
    해당 과목을 '컴퓨터프로그래밍II'로 강제 보정.
    """
    if not matched_courses:
        return matched_courses

    matched_names = {item["matched_course_name"] for item in matched_courses}

    has_trigger_course = any(name in matched_names for name in CP2_TRIGGER_COURSES)
    if not has_trigger_course:
        return matched_courses

    cp2_course = _find_best_course_by_exact_name(db, "컴퓨터프로그래밍II")
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
    """
    영어 비율이 높은 후보일수록 임계값을 완화합니다.
    OCR이 영어 알파벳을 1~2자 오인식해도 임계값 미달로 탈락하는 문제를 방지합니다.
    - 영어 비율 50% 이상: -8점 (최저 65)
    - 영어 비율 20~50%:  -4점 (최저 70)
    """
    ratio = _english_char_ratio(candidate)
    if ratio >= 0.5:
        return max(base - 8.0, 65.0)
    if ratio >= 0.2:
        return max(base - 4.0, 70.0)
    return base


def match_courses_to_db(
    course_names: List[str],
    db: Session,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
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
    matched_courses = apply_cp1_to_cp2_rule(matched_courses, db)

    return matched_courses, ignored_candidates


def process_timetable_image(
    image_path: str,
    db: Session,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> Dict[str, Any]:
    raw_blocks = extract_text_blocks(image_path)
    merged_blocks = merge_nearby_blocks(raw_blocks)
    candidates = build_course_candidates(raw_blocks, merged_blocks)
    matched_courses, ignored_candidates = match_courses_to_db(candidates, db, threshold=threshold)

    # 시간표 상단에서 연도·학기 자동 추출
    detected_year, detected_semester = extract_year_semester_from_blocks(raw_blocks)

    result = {
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

    return result