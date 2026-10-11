import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.materials import ingest_material_background, router as materials_router
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.materials import HashEmbeddingProvider, MaterialService
from tests.auth_helpers import create_test_user
from tests.pgvector_helpers import make_pgvector_session_factory


def test_background_ingest_closes_session_on_failure():
    class IngestFailed(Exception):
        pass

    fake_session = Mock()

    class FailingService:
        def __init__(self, session):
            assert session is fake_session

        def ingest_material(self, material_id):
            assert material_id == 123
            raise IngestFailed

    with (
        patch("app.api.materials.SessionLocal", return_value=fake_session),
        patch("app.api.materials.MaterialService", FailingService),
    ):
        try:
            ingest_material_background(123)
        except IngestFailed:
            pass
        else:
            raise AssertionError("ingest failure should propagate")

    fake_session.close.assert_called_once_with()


def test_upload_returns_202_pending_material():
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    tmpdir = tempfile.TemporaryDirectory()
    previous_upload_dir = settings.RAG_UPLOAD_DIR
    settings.RAG_UPLOAD_DIR = tmpdir.name
    try:
        create_test_user(db, username="alice")
        app = FastAPI()

        def override_db():
            yield db

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: User(
            id=1,
            username="alice",
            email=None,
            is_active=True,
            created_at="now",
            updated_at="now",
        )
        app.include_router(materials_router)
        client = TestClient(app)

        service_sessions = []

        def material_service(session):
            service_sessions.append(session)
            return MaterialService(
                session,
                embedding_provider=HashEmbeddingProvider(dimensions=settings.RAG_VECTOR_DIM),
                upload_dir=Path(tmpdir.name),
            )

        with (
            patch("app.api.materials.MaterialService", side_effect=material_service),
            patch("app.api.materials.SessionLocal", side_effect=SessionLocal),
        ):
            response = client.post(
                "/api/materials/upload",
                files={"file": ("notes.md", b"# Notes\n\nposterior probability", "text/markdown")},
            )

        assert response.status_code == 202
        payload = response.json()
        assert payload["status"] == "pending"
        assert payload["chunk_count"] == 0
        assert isinstance(payload["id"], int)
        assert payload["filename"] == "notes.md"
        assert service_sessions[0] is db
        assert service_sessions[1] is not db

        verify_db = SessionLocal()
        try:
            persisted = MaterialService(
                verify_db,
                embedding_provider=HashEmbeddingProvider(dimensions=settings.RAG_VECTOR_DIM),
                upload_dir=Path(tmpdir.name),
            ).list_materials(user_id="alice")[0]
            assert persisted["status"] == "ready"
        finally:
            verify_db.close()
    finally:
        settings.RAG_UPLOAD_DIR = previous_upload_dir
        db.close()
        engine.dispose()
        tmpdir.cleanup()
