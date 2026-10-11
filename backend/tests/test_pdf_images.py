import inspect
import shutil
from pathlib import Path

from reportlab.pdfgen import canvas

import app.services.pdf_images as pdf_images
from app.services.pdf_images import PageImageProcessor, render_page_png


def build_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path))
    c.drawString(72, 720, "hello pdf")
    c.save()


def test_module_imports_without_tesseract():
    assert hasattr(pdf_images, "render_page_png")
    assert hasattr(pdf_images, "PageImageProcessor")
    top_level_imports = [
        line
        for line in inspect.getsource(pdf_images).splitlines()
        if line.startswith(("import ", "from "))
    ]
    assert not any("import pypdfium2" in line for line in top_level_imports)
    assert not any("import pytesseract" in line for line in top_level_imports)
    assert not any("from PIL" in line for line in top_level_imports)
    assert not any("from openai" in line for line in top_level_imports)


def test_render_page_png_returns_png(tmp_path):
    path = tmp_path / "page.pdf"
    build_pdf(path)

    png = render_page_png(path, 1)

    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(png) > 1000


def test_processor_respects_max_pages(tmp_path):
    path = tmp_path / "page.pdf"
    build_pdf(path)

    results, skipped = PageImageProcessor("ocr", max_pages=1).process(path, [1])

    if shutil.which("tesseract"):
        assert skipped == []
        assert 1 in results
    else:
        assert skipped == [1]
        assert results == {}
