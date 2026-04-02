import io
import re
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Set

import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image, ImageEnhance
from paddleocr import PaddleOCR


_MIN_OCR_CONFIDENCE = 0.5
_EN_ENGLISH_RATIO_MIN = 0.5
_EN_CONFIDENCE_MIN = 0.65
_IOU_OVERLAP_MIN = 0.3

_OCR_ENGINE_KO: Optional[PaddleOCR] = None
_OCR_ENGINE_EN: Optional[PaddleOCR] = None

_OCR_PARAMS = dict(
    use_angle_cls=True,
    show_log=False,
    det_db_thresh=0.2,
    det_db_box_thresh=0.5,
    det_db_unclip_ratio=1.8,
)


def get_ocr_engine(lang: str = "korean") -> PaddleOCR:
    global _OCR_ENGINE_KO, _OCR_ENGINE_EN
    if lang == "en":
        if _OCR_ENGINE_EN is None:
            _OCR_ENGINE_EN = PaddleOCR(lang="en", **_OCR_PARAMS)
        return _OCR_ENGINE_EN
    if _OCR_ENGINE_KO is None:
        _OCR_ENGINE_KO = PaddleOCR(lang="korean", **_OCR_PARAMS)
    return _OCR_ENGINE_KO


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


def _english_char_ratio(text: str) -> float:
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return 0.0
    return sum(1 for c in alpha if c.isascii()) / len(alpha)


def _bbox_stats(bbox: List[List[float]]) -> Dict[str, float]:
    xs = [pt[0] for pt in bbox]
    ys = [pt[1] for pt in bbox]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    return {
        "x_min": x_min, "x_max": x_max,
        "y_min": y_min, "y_max": y_max,
        "width": x_max - x_min, "height": y_max - y_min,
        "x_center": (x_min + x_max) / 2, "y_center": (y_min + y_max) / 2,
    }


def _bbox_iou(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    x_overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    y_overlap = min(a["y_max"], b["y_max"]) - max(a["y_min"], b["y_min"])
    if x_overlap <= 0 or y_overlap <= 0:
        return 0.0
    intersection = x_overlap * y_overlap
    union = a["width"] * a["height"] + b["width"] * b["height"] - intersection
    return intersection / union if union > 0 else 0.0


def _parse_ocr_result(ocr_result) -> List[Dict[str, Any]]:
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
    result = list(ko_blocks)
    en_used: Set[int] = set()

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


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    w, h = image.size
    if w < 1200:
        scale = 1200 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.3)
    image = ImageEnhance.Sharpness(image).enhance(1.5)
    return image


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_ocr_engine("korean")
    get_ocr_engine("en")
    yield


app = FastAPI(title="OCR Service", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    image = preprocess_for_ocr(image)
    image_array = np.array(image)

    ko_blocks = _parse_ocr_result(get_ocr_engine("korean").ocr(image_array, cls=True))
    en_blocks = _parse_ocr_result(get_ocr_engine("en").ocr(image_array, cls=True))
    blocks = _merge_dual_ocr_blocks(ko_blocks, en_blocks)

    for idx, block in enumerate(blocks):
        block["id"] = idx

    return {"blocks": blocks}
