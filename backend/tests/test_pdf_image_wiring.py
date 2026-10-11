import shutil
from pathlib import Path

import pytest
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.config import settings
from app.services.materials import PdfExtractor


def build_mixed_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.drawString(72, 720, "hello world " * 20)
    c.showPage()
    c.setFillColor(colors.black)
    c.rect(160, 500, 200, 200, fill=True, stroke=False)
    c.save()


def test_off_mode_never_instantiates_processor(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "off")
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)

    def bomb(*args, **kwargs):
        raise AssertionError("must not be instantiated")

    monkeypatch.setattr("app.services.pdf_images.PageImageProcessor", bomb)

    text = PdfExtractor(path).extract()

    assert "[page 2: 图片页已跳过]" in text


def test_ocr_mode_emits_image_marker_or_skip_line(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "ocr")
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)

    text = PdfExtractor(path).extract()

    if shutil.which("tesseract"):
        assert "[image p2]" in text
    else:
        assert "[page 2: 图片页已跳过（超过 RAG_PDF_MAX_VISION_PAGES 上限或处理失败）]" in text


def test_unknown_mode_falls_back_to_off_with_warning(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "auto")
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)
    extractor = PdfExtractor(path)

    text = extractor.extract()

    assert "[page 2: 图片页已跳过]" in text
    assert any(warning.startswith("[config]") for warning in extractor.skip_warnings())
