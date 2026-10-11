from pathlib import Path

import pytest

from app.config import settings
from app.models.materials import StudyMaterial, StudyMaterialChunk
from app.services.materials import HashEmbeddingProvider, MaterialService, extract_text_from_path
from tests.auth_helpers import create_test_user
from tests.pgvector_helpers import make_pgvector_session_factory


@pytest.fixture
def db_session():
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def service_for(db, tmp_path: Path) -> MaterialService:
    return MaterialService(
        db,
        embedding_provider=HashEmbeddingProvider(dimensions=settings.RAG_VECTOR_DIM),
        upload_dir=tmp_path,
    )


def test_pending_then_ingest_reaches_ready(db_session, tmp_path):
    create_test_user(db_session, username="alice")
    path = tmp_path / "a.md"
    path.write_text(("中文 English mixed content for retrieval.\n" * 80), encoding="utf-8")
    service = service_for(db_session, tmp_path)

    pending = service.create_pending_material_from_path("a.md", path, path.stat().st_size, "text/markdown", "alice")
    assert pending["status"] == "pending"
    assert pending["chunk_count"] == 0

    ready = service.ingest_material(int(pending["id"]))
    assert ready["status"] == "ready"
    assert ready["chunk_count"] > 0
    assert ready["char_count"] > 0
    chunk_count = db_session.query(StudyMaterialChunk).filter_by(material_id=ready["id"]).count()
    assert chunk_count == ready["chunk_count"]


def test_extraction_happens_exactly_once(db_session, tmp_path, monkeypatch):
    create_test_user(db_session, username="alice")
    path = tmp_path / "a.md"
    path.write_text("single extraction path\n" * 100, encoding="utf-8")
    service = service_for(db_session, tmp_path)
    pending = service.create_pending_material_from_path("a.md", path, path.stat().st_size, "text/markdown", "alice")
    calls = {"count": 0}

    def wrapper(*args, **kwargs):
        calls["count"] += 1
        return extract_text_from_path(*args, **kwargs)

    monkeypatch.setattr("app.services.materials.extract_text_from_path", wrapper)
    service.ingest_material(int(pending["id"]))

    assert calls["count"] == 1


def test_ingest_failure_marks_failed(db_session, tmp_path):
    create_test_user(db_session, username="alice")
    path = tmp_path / "broken.pdf"
    path.write_bytes(b"not a pdf")
    service = service_for(db_session, tmp_path)
    pending = service.create_pending_material_from_path("broken.pdf", path, path.stat().st_size, "application/pdf", "alice")

    with pytest.raises(Exception):
        service.ingest_material(int(pending["id"]))

    material = db_session.query(StudyMaterial).filter_by(id=pending["id"]).one()
    assert material.status == "failed"
    assert material.error
