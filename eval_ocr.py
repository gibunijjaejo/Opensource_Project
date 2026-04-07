"""
OCR 파이프라인 평가 스크립트
- OCR service: localhost:8001 (docker-compose ports: 8001:8000)
- 실행: python eval_ocr.py
- 평가 대상: dataset/images/ + timetable_labels.json
"""

import json
import os
import re
import sys
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx
from rapidfuzz import fuzz

# ── 설정 ────────────────────────────────────────────────────────────────────
OCR_SERVICE_URL = "http://localhost:8001"
LABELS_FILE = "timetable_labels.json"
CANDIDATE_MATCH_THRESHOLD = 55.0   # 후보 레벨에서 GT 매칭 임계값 (느슨하게)


# ── image_service.py 에서 복사한 텍스트 처리 함수들 ──────────────────────────
_WEEKDAY_WORDS = {"월", "화", "수", "목", "금", "토", "일"}
_WEEKDAY_LONG_WORDS = {"월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"}


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


def clean_display_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    text = normalize_course_suffix(text)
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
    if re.fullmatch(r"[a-z]{2,3}\d{2,4}", norm):
        return True
    if re.fullmatch(r"[a-z]\d{3,4}", norm):
        return True
    if re.fullmatch(r"\d{3,4}[a-z]?", norm):
        return True
    if re.fullmatch(r"[가-힣]{2,4}[a-z]?\d{3,4}[a-z]?", norm):
        return True
    return False


def is_course_line_like(text: str) -> bool:
    display = clean_display_text(text)
    norm = normalize_text(display)
    if not norm:
        return False
    if display in _WEEKDAY_WORDS or display in _WEEKDAY_LONG_WORDS:
        return False
    if is_time_like(display):
        return False
    if norm.isdigit():
        return False
    if is_room_like(display):
        return False
    if len(norm) < 2:
        return re.fullmatch(r"[가-힣]", norm) is not None
    return True


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


def horizontal_overlap_ratio(a: Dict, b: Dict) -> float:
    overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    if overlap <= 0:
        return 0.0
    min_width = max(min(a["width"], b["width"]), 1.0)
    return overlap / min_width


def should_merge_course_lines(a: Dict, b: Dict) -> bool:
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
    same_column_like = x_overlap >= 0.25 or center_diff <= width_ref * 0.55
    if not same_column_like:
        return False
    a_norm = normalize_text(a["display_text"])
    b_norm = normalize_text(b["display_text"])
    if len(b_norm) <= 5 and re.fullmatch(r"[a-z]?\d{3,4}[a-z]?", b_norm):
        return False
    if len(b_norm) == 1 and re.fullmatch(r"[가-힣]", b_norm):
        if vertical_gap > height_ref * 1.5:
            return False
        return len(a_norm) >= 3
    if vertical_gap > height_ref * 2.2:
        return False
    if len(a_norm) >= 6 and len(b_norm) >= 4:
        if x_overlap < 0.35:
            return False
    short_tail = len(b_norm) <= 6
    likely_wrapped_title = len(a_norm) >= 4 and len(b_norm) >= 2
    return short_tail or likely_wrapped_title


def build_merge_graph(blocks: List[Dict]) -> Dict[int, Set[int]]:
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


def _merge_group(group: List[Dict]) -> Dict:
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
        "x_min": x_min, "x_max": x_max,
        "y_min": y_min, "y_max": y_max,
        "width": x_max - x_min, "height": y_max - y_min,
        "x_center": (x_min + x_max) / 2,
        "y_center": (y_min + y_max) / 2,
        "merged_count": len(group),
    }


def merge_nearby_blocks(blocks: List[Dict]) -> List[Dict]:
    if not blocks:
        return []
    graph = build_merge_graph(blocks)
    comps = connected_components(graph)
    merged = []
    for comp in comps:
        group = [blocks[i] for i in comp]
        merged.append(_merge_group(group))
    merged.sort(key=lambda b: (b["y_center"], b["x_center"]))
    return merged


def deduplicate_course_names(course_names: List[str]) -> List[str]:
    seen = set()
    result = []
    for name in course_names:
        display = clean_display_text(name)
        normalized = normalize_text(display)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(display)
    return result


_MAX_MERGED_NORM_LEN = 18
_KOREAN_START_RE = re.compile(r"[가-힣]{4,}.*")


def _clean_noise_prefix(text: str) -> Optional[str]:
    norm = normalize_text(text)
    m = _KOREAN_START_RE.search(norm)
    if m and m.start() >= 2:
        return m.group(0)
    return None


def build_course_candidates(raw_blocks: List[Dict], merged_blocks: List[Dict]) -> List[str]:
    candidates = []
    raw_block_by_id = {b["id"]: b for b in raw_blocks}
    merged_source_ids: Set[int] = set()
    for block in merged_blocks:
        for sid in block.get("source_ids", []):
            merged_source_ids.add(sid)
    for block in merged_blocks:
        norm = normalize_text(block["display_text"])
        if len(norm) > _MAX_MERGED_NORM_LEN:
            for sid in block.get("source_ids", []):
                raw_b = raw_block_by_id.get(sid)
                if raw_b and is_probable_course_candidate(raw_b["display_text"]):
                    candidates.append(raw_b["display_text"])
        elif is_probable_course_candidate(block["display_text"]):
            candidates.append(block["display_text"])
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


def extract_year_semester(blocks: List[Dict]) -> Tuple[Optional[int], Optional[int]]:
    full_re = re.compile(r"(20[12][0-9])\s*년[^0-9]{0,8}([1-4])\s*학기")
    year_sem_re = re.compile(r"(20[12][0-9])[^0-9]{0,6}([1-4])")
    semester_re = re.compile(r"([1-4])\s*학기")
    year_re = re.compile(r"(20[12][0-9])(?!\d)")
    sorted_by_y = sorted(blocks, key=lambda b: b["y_center"])
    found_year: Optional[int] = None
    found_semester: Optional[int] = None
    for block in sorted_by_y[:30]:
        text = block["display_text"]
        if found_year is None or found_semester is None:
            m = full_re.search(text)
            if m:
                found_year, found_semester = int(m.group(1)), int(m.group(2))
                continue
        if found_year is None or found_semester is None:
            m = year_sem_re.search(text)
            if m:
                y, s = int(m.group(1)), int(m.group(2))
                if 2010 <= y <= 2040:
                    if found_year is None: found_year = y
                    if found_semester is None: found_semester = s
        if found_semester is None:
            m = semester_re.search(text)
            if m: found_semester = int(m.group(1))
        if found_year is None:
            m = year_re.search(text)
            if m:
                y = int(m.group(1))
                if 2010 <= y <= 2040: found_year = y
    return found_year, found_semester


# ── 유사도 계산 ────────────────────────────────────────────────────────────
_CONFUSION_TABLE = str.maketrans({"0": "o", "5": "s"})
_JAVA_SUFFIX_PATTERN = re.compile(r"(java)(io|lo|l0|10|lO|IO|iO|h|언0|언o)", re.IGNORECASE)


def _confusion_normalize(text: str) -> str:
    text = text.translate(_CONFUSION_TABLE)
    text = _JAVA_SUFFIX_PATTERN.sub(r"\1언어", text)
    return text


def compute_similarity(a: str, b: str) -> float:
    na = normalize_text(a)
    nb = normalize_text(b)
    if not na or not nb:
        return 0.0
    len_a, len_b = len(na), len(nb)
    ratio_score = fuzz.ratio(na, nb)
    token_sort_score = fuzz.token_sort_ratio(na, nb)
    token_set_score = fuzz.token_set_ratio(na, nb)
    partial_score = fuzz.partial_ratio(na, nb)
    min_len = min(len_a, len_b)
    max_len = max(len_a, len_b)
    if min_len >= 4 and (nb in na or na in nb) and max_len > min_len * 1.25:
        score = float(max(ratio_score, token_sort_score, partial_score))
    else:
        len_ratio = min_len / max_len
        penalized_partial = partial_score * len_ratio
        penalized_token_set = token_set_score * len_ratio
        score = float(max(ratio_score, token_sort_score, penalized_partial, penalized_token_set))
    cna, cnb = _confusion_normalize(na), _confusion_normalize(nb)
    if cna != na or cnb != nb:
        score = max(score, compute_similarity.__wrapped__(cna, cnb) if hasattr(compute_similarity, '__wrapped__') else score)
    return score


def best_candidate_score(gt_name: str, candidates: List[str]) -> Tuple[float, str]:
    best_score = 0.0
    best_cand = ""
    gt_norm = normalize_text(gt_name)
    for cand in candidates:
        cand_norm = normalize_text(cand)
        if not cand_norm:
            continue
        len_a, len_b = len(gt_norm), len(cand_norm)
        r = fuzz.ratio(gt_norm, cand_norm)
        ts = fuzz.token_sort_ratio(gt_norm, cand_norm)
        tset = fuzz.token_set_ratio(gt_norm, cand_norm)
        p = fuzz.partial_ratio(gt_norm, cand_norm)
        min_len = min(len_a, len_b)
        max_len = max(len_a, len_b) or 1
        if min_len >= 4 and (cand_norm in gt_norm or gt_norm in cand_norm) and max_len > min_len * 1.25:
            s = float(max(r, ts, p))
        else:
            lr = min_len / max_len
            s = float(max(r, ts, p * lr, tset * lr))
        # confusion
        cn_gt = _confusion_normalize(gt_norm)
        cn_c = _confusion_normalize(cand_norm)
        if cn_gt != gt_norm or cn_c != cand_norm:
            r2 = fuzz.ratio(cn_gt, cn_c)
            ts2 = fuzz.token_sort_ratio(cn_gt, cn_c)
            p2 = fuzz.partial_ratio(cn_gt, cn_c)
            s = max(s, float(max(r2, ts2, p2)))
        if s > best_score:
            best_score = s
            best_cand = cand
    return best_score, best_cand


# ── OCR 호출 ────────────────────────────────────────────────────────────────
def call_ocr(image_path: str) -> List[Dict]:
    with open(image_path, "rb") as f:
        resp = httpx.post(f"{OCR_SERVICE_URL}/ocr", files={"file": f}, timeout=120.0)
    resp.raise_for_status()
    return resp.json()["blocks"]


# ── 메인 평가 ────────────────────────────────────────────────────────────────
def evaluate():
    with open(LABELS_FILE, encoding="utf-8") as f:
        labels = json.load(f)

    total_gt = 0
    total_found = 0
    total_images = 0
    miss_counter: Dict[str, int] = {}   # 놓친 과목명 → 횟수
    all_missed_details: List[Dict] = []

    print(f"{'='*70}")
    print(f"OCR 평가 | {len(labels)}개 라벨 | OCR 서비스: {OCR_SERVICE_URL}")
    print(f"{'='*70}\n")

    for label in labels:
        image_path = label["image_path"]
        if not os.path.exists(image_path):
            print(f"[SKIP] {image_path} 파일 없음")
            continue

        gt = label["ground_truth"]
        gt_year = gt["year"]
        gt_semester = gt["semester"]
        gt_courses = gt["major_courses"]

        try:
            raw_blocks = call_ocr(image_path)
        except Exception as e:
            print(f"[ERROR] {label['image_id']}: OCR 호출 실패 - {e}")
            continue

        merged_blocks = merge_nearby_blocks(raw_blocks)
        candidates = build_course_candidates(raw_blocks, merged_blocks)
        detected_year, detected_semester = extract_year_semester(raw_blocks)

        found_courses = []
        missed_courses = []

        for gt_course in gt_courses:
            score, best_cand = best_candidate_score(gt_course, candidates)
            if score >= CANDIDATE_MATCH_THRESHOLD:
                found_courses.append((gt_course, best_cand, score))
            else:
                missed_courses.append((gt_course, best_cand, score))
                miss_counter[gt_course] = miss_counter.get(gt_course, 0) + 1

        n_found = len(found_courses)
        n_gt = len(gt_courses)
        total_gt += n_gt
        total_found += n_found
        total_images += 1

        status = "OK" if n_found == n_gt else f"MISS {n_gt - n_found}/{n_gt}"
        year_ok = "O" if detected_year == gt_year else f"X(감지:{detected_year})"
        sem_ok = "O" if detected_semester == gt_semester else f"X(감지:{detected_semester})"

        print(f"[{label['image_id']:12s}] {gt_year}/{gt_semester}학기 | 연도:{year_ok} 학기:{sem_ok} | 과목: {status}")

        if missed_courses:
            for gt_c, best_c, sc in missed_courses:
                best_info = f'"{best_c}" ({sc:.0f}점)' if best_c else "후보 없음"
                print(f"    MISS  GT='{gt_c}'  →  최고후보={best_info}")
                all_missed_details.append({
                    "image_id": label["image_id"],
                    "gt": gt_course,
                    "best_cand": best_c,
                    "score": sc,
                    "candidates": candidates,
                })

        if "--verbose" in sys.argv:
            print(f"    후보 목록: {candidates}")
            print(f"    raw 블록 텍스트: {[b['display_text'] for b in raw_blocks]}")

    recall = total_found / total_gt * 100 if total_gt else 0
    print(f"\n{'='*70}")
    print(f"전체 Recall:  {total_found}/{total_gt} = {recall:.1f}%  ({total_images}장)")
    print(f"{'='*70}")

    if miss_counter:
        print("\n자주 놓친 과목 (빈도순):")
        for name, cnt in sorted(miss_counter.items(), key=lambda x: -x[1]):
            print(f"  {cnt}회 놓침  →  '{name}'")

    # 놓친 케이스에서 OCR이 실제로 읽은 원본 블록 출력 (분석용)
    if "--debug" in sys.argv and all_missed_details:
        print("\n[DEBUG] 놓친 과목의 후보 목록 및 원본 블록:")
        for d in all_missed_details[:10]:
            print(f"\n  [{d['image_id']}] GT='{d['gt']}'")
            print(f"  후보: {d['candidates']}")


if __name__ == "__main__":
    evaluate()
