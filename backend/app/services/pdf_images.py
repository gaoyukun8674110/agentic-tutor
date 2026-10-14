from __future__ import annotations

import base64
import logging
from pathlib import Path

from app.config import settings


def render_page_png(path: Path, page_number: int, scale: float = 2.0) -> bytes:
    """Render a 1-based PDF page into PNG bytes."""
    import io

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(path))
    page = pdf[page_number - 1]
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def ocr_page_png(png_bytes: bytes, lang: str = "chi_sim+eng") -> str:
    """Run OCR over PNG bytes and return stripped text."""
    import io

    import pytesseract
    from PIL import Image

    image = Image.open(io.BytesIO(png_bytes))
    return pytesseract.image_to_string(image, lang=lang).strip()


def describe_page_via_vision(png_bytes: bytes, page_number: int) -> str:
    """Describe a rendered PDF page through an OpenAI-compatible vision model."""
    api_key = settings.RAG_VISION_API_KEY
    base_url = settings.RAG_VISION_BASE_URL
    model = settings.RAG_VISION_MODEL
    if not api_key:
        raise RuntimeError("RAG_VISION_API_KEY is not configured")

    from openai import OpenAI

    prompt = f"""这是一份学习资料 PDF 的第 {page_number} 页截图。请把它转写为 Markdown：
- 忠实还原正文文字，不要总结、不要改写、不要补充解释。
- 公式用 LaTeX 行内写法 $...$ 或块级 $$...$$。
- 表格必须转成 Markdown 表格。
- 若这一页是纯插图或照片，用一句话客观描述图中内容即可。
- 只输出转写结果本身，不要任何前后缀说明。"""
    image_url = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('ascii')}"
    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
    )
    return (response.choices[0].message.content or "").strip()


class PageImageProcessor:
    def __init__(self, mode: str, max_pages: int) -> None:
        self.mode = mode
        self.max_pages = max_pages

    def process(self, path: Path, page_numbers: list[int]) -> tuple[dict[int, str], list[int]]:
        """Return processed page text by page number and skipped page numbers."""
        if self.mode not in {"ocr", "vision"}:
            raise ValueError(f"Unsupported page image mode: {self.mode}")

        results: dict[int, str] = {}
        skipped: list[int] = []
        handled = 0
        for page_number in sorted(page_numbers):
            if handled >= self.max_pages:
                skipped.append(page_number)
                continue

            try:
                png = render_page_png(path, page_number)
                if self.mode == "ocr":
                    text = ocr_page_png(png)
                else:
                    text = describe_page_via_vision(png, page_number)
                results[page_number] = text
                handled += 1
            except Exception:
                logging.getLogger(__name__).warning("page %s image processing failed", page_number, exc_info=True)
                skipped.append(page_number)

        return results, skipped
