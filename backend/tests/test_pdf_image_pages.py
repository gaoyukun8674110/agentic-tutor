from pathlib import Path

import pytest
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.config import settings
from app.models.materials import StudyMaterial
from app.services.materials import HashEmbeddingProvider, MaterialService, PdfExtractor, extract_text_from_path
from tests.auth_helpers import create_test_user
from tests.pgvector_helpers import make_pgvector_session_factory

IMAGE_ONLY_MESSAGE = "此 PDF 无文本层，请开启图片处理（设置 RAG_PDF_IMAGE_MODE=ocr 或 vision 后重新上传）"


def build_mixed_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica", 12)
    c.drawString(72, 720, "hello world " * 20)
    c.showPage()
    c.setFillColor(colors.black)
    c.rect(160, 500, 200, 200, fill=True, stroke=False)
    c.save()


def build_image_only_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFillColor(colors.black)
    c.rect(160, 500, 200, 200, fill=True, stroke=False)
    c.save()


def test_image_pages_detected(tmp_path):
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)
    extractor = PdfExtractor(path)

    assert extractor.image_pages() == [2]
    assert extractor.image_pages() == [2]


def test_off_mode_skips_image_page(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "off")
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)

    text = PdfExtractor(path).extract()

    assert "[page 1]" in text
    assert "[page 2: 图片页已跳过]" in text
    assert "[image p2]" not in text


def test_off_mode_all_images_raises_chinese_message(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "off")
    path = tmp_path / "image.pdf"
    build_image_only_pdf(path)

    with pytest.raises(ValueError) as exc_info:
        PdfExtractor(path).extract()

    assert str(exc_info.value) == IMAGE_ONLY_MESSAGE


def test_warnings_flow_into_material_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "RAG_PDF_IMAGE_MODE", "off")
    path = tmp_path / "mixed.pdf"
    build_mixed_pdf(path)
    collected: list[str] = []

    text = extract_text_from_path("mixed.pdf", path, "application/pdf", collected)

    assert text
    assert collected != []
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    try:
        create_test_user(db, username="alice")
        service = MaterialService(
            db,
            embedding_provider=HashEmbeddingProvider(dimensions=settings.RAG_VECTOR_DIM),
            upload_dir=tmp_path,
        )
        pending = service.create_pending_material_from_path(
            "mixed.pdf", path, path.stat().st_size, "application/pdf", "alice"
        )
        service.ingest_material(int(pending["id"]))
        material = db.query(StudyMaterial).filter_by(id=pending["id"]).one()
        assert material.status == "ready"
        assert material.error.startswith("warning: ")
    finally:
        db.close()
        engine.dispose()
