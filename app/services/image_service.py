# 이미지 처리 로직

import json
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple, Set

import numpy as np
from PIL import Image
from paddleocr import PaddleOCR
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.models.course import Course


_OCR_ENGINE: Optional[PaddleOCR] = None

DEFAULT_MATCH_THRESHOLD = 83.0

_WEEKDAY_WORDS = {"월", "화", "수", "목", "금", "토", "일"}
_WEEKDAY_LONG_WORDS = {
    "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"
}


def get_ocr_engine() -> PaddleOCR:
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        _OCR_ENGINE = PaddleOCR(
            use_angle_cls=True,
            lang="korean",
            show_log=False,
        )
    return _OCR_ENGINE


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

    # 영문+숫자 조합
    if re.fullmatch(r"[a-z]{1,3}\d{2,4}", norm):
        return True

    # 숫자+영문 1자리 정도
    if re.fullmatch(r"\d{2,4}[a-z]{0,1}", norm):
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

    # 너무 짧은 일반 노이즈 제외
    if len(norm) < 2:
        return False

    return True


def normalized_is_pure_time_or_index(norm: str, display: str) -> bool:
    if is_time_like(display):
        return True
    if norm.isdigit():
        return True
    return False


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


def extract_text_blocks(image_path: str) -> List[Dict[str, Any]]:
    image = Image.open(image_path).convert("RGB")
    image_array = np.array(image)

    ocr_engine = get_ocr_engine()
    ocr_result = ocr_engine.ocr(image_array, cls=True)

    blocks: List[Dict[str, Any]] = []

    if not ocr_result:
        return blocks

    idx = 0
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

            if not raw_text:
                continue

            stats = _bbox_stats(bbox)

            blocks.append(
                {
                    "id": idx,
                    "text": raw_text,
                    "display_text": clean_display_text(raw_text),
                    "normalized_text": normalize_text(raw_text),
                    "confidence": round(score, 4),
                    "bbox": bbox,
                    **stats,
                }
            )
            idx += 1

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
    핵심:
    - 세로로 인접
    - x축이 거의 같은 열/셀 안
    - 둘 다 과목 줄처럼 보임
    - 강의실/요일/시간은 제외
    """
    if not is_course_line_like(a["display_text"]) or not is_course_line_like(b["display_text"]):
        return False

    # b가 아래쪽 줄이라고 가정
    if b["y_center"] < a["y_center"]:
        a, b = b, a

    vertical_gap = b["y_min"] - a["y_max"]
    if vertical_gap < -max(a["height"], b["height"]) * 0.35:
        return False

    height_ref = max(a["height"], b["height"], 1.0)
    width_ref = max(a["width"], b["width"], 1.0)
    x_overlap = horizontal_overlap_ratio(a, b)
    center_diff = abs(a["x_center"] - b["x_center"])

    # 같은 셀/열 안인지 더 엄격하게
    same_column_like = (
        x_overlap >= 0.35
        or center_diff <= width_ref * 0.45
    )

    if not same_column_like:
        return False

    # 줄 간격 허용
    if vertical_gap > height_ref * 1.9:
        return False

    a_norm = normalize_text(a["display_text"])
    b_norm = normalize_text(b["display_text"])

    # 매우 짧은 꼬리 텍스트는 더 잘 붙이기
    short_tail = len(b_norm) <= 6

    # 위 줄 자체가 이미 긴 과목명 일부처럼 보이면 우선 병합
    likely_wrapped_title = len(a_norm) >= 4 and len(b_norm) >= 2

    return short_tail or likely_wrapped_title


def build_merge_graph(blocks: List[Dict[str, Any]]) -> Dict[int, Set[int]]:
    """
    전역 정렬 후 바로 이전 블록 하나만 보는 대신,
    인접 가능성이 있는 블록들끼리 그래프를 만들어 연결요소로 병합.
    """
    graph: Dict[int, Set[int]] = {i: set() for i in range(len(blocks))}
    sorted_indices = sorted(range(len(blocks)), key=lambda i: (blocks[i]["y_center"], blocks[i]["x_center"]))

    for pos, i in enumerate(sorted_indices):
        a = blocks[i]

        # 너무 멀리 있는 블록까지 볼 필요 없음
        for j in sorted_indices[pos + 1:]:
            b = blocks[j]

            # 세로 거리 너무 멀면 break
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
    """
    핵심 변경:
    - raw_blocks는 주 후보가 아님
    - merged_blocks를 우선 사용
    - raw_blocks는 어떤 merged group에도 포함되지 않은 고립 텍스트만 fallback
    """
    candidates: List[str] = []

    merged_source_ids: Set[int] = set()
    for block in merged_blocks:
        for sid in block.get("source_ids", []):
            merged_source_ids.add(sid)

    # 1) 병합 결과를 최우선 후보로 사용
    for block in merged_blocks:
        if is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])

    # 2) 병합에 포함되지 않은 raw block만 fallback 후보로 사용
    for block in raw_blocks:
        if block["id"] in merged_source_ids:
            continue
        if is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])

    return deduplicate_course_names(candidates)


def compute_similarity(a: str, b: str) -> float:
    na = normalize_text(a)
    nb = normalize_text(b)

    if not na or not nb:
        return 0.0

    score = max(
        fuzz.ratio(na, nb),
        fuzz.partial_ratio(na, nb),
        fuzz.token_sort_ratio(na, nb),
    )
    return float(score)


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

        if best_course and best_score >= threshold:
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

    return matched_courses, ignored_candidates


def _deduplicate_matched_courses(matched_courses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best_by_code: Dict[str, Dict[str, Any]] = {}

    for item in matched_courses:
        course_code = item["course_code"]
        prev = best_by_code.get(course_code)

        if prev is None or item["score"] > prev["score"]:
            best_by_code[course_code] = item

    return list(best_by_code.values())


def process_timetable_image(
    image_path: str,
    db: Session,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> Dict[str, Any]:
    raw_blocks = extract_text_blocks(image_path)
    merged_blocks = merge_nearby_blocks(raw_blocks)
    candidates = build_course_candidates(raw_blocks, merged_blocks)
    matched_courses, ignored_candidates = match_courses_to_db(candidates, db, threshold=threshold)

    result = {
        "image_path": image_path,
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


def save_ocr_result_json(student_id: int, semester: int, result: Dict[str, Any]) -> str:
    base_dir = os.path.join("data", "timetable_ocr", str(student_id))
    os.makedirs(base_dir, exist_ok=True)

    json_path = os.path.join(base_dir, f"{student_id}_{semester}.json")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return json_path