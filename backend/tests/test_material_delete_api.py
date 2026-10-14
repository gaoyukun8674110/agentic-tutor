from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.materials import router as materials_router
from app.config import settings
from app.database import get_db
from app.models.materials import StudyMaterial
from app.models.user import User
from app.services.materials import HashEmbeddingProvider, MaterialService
from tests.auth_helpers import create_test_user
from tests.pgvector_helpers import make_pgvector_session_factory


def build_client(db):
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
    return TestClient(app)


def service_for(db, tmp_path: Path) -> MaterialService:
    return MaterialService(
        db,
        embedding_provider=HashEmbeddingProvider(dimensions=settings.RAG_VECTOR_DIM),
        upload_dir=tmp_path,
    )


def test_delete_removes_material_and_file(tmp_path):
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    try:
        create_test_user(db, username="alice")
        path = tmp_path / "delete-me.md"
        path.write_text("delete me", encoding="utf-8")
        service = service_for(db, tmp_path)
        material = service.create_pending_material_from_path("delete-me.md", path, path.stat().st_size, None, "alice")
        client = build_client(db)

        with patch("app.api.materials.MaterialService", side_effect=lambda session: service_for(session, tmp_path)):
            response = client.delete(f"/api/materials/{material['id']}")
            list_response = client.get("/api/materials")

        assert response.status_code == 200
        assert response.json() == {"id": material["id"], "deleted": True}
        assert material["id"] not in [item["id"] for item in list_response.json()["materials"]]
        assert not path.exists()
    finally:
        db.close()
        engine.dispose()


def test_delete_missing_material_returns_404(tmp_path):
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    try:
        create_test_user(db, username="alice")
        client = build_client(db)

        with patch("app.api.materials.MaterialService", side_effect=lambda session: service_for(session, tmp_path)):
            response = client.delete("/api/materials/999999")

        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "material_not_found"
    finally:
        db.close()
        engine.dispose()


def test_delete_other_users_material_returns_404(tmp_path):
    engine, SessionLocal = make_pgvector_session_factory()
    db = SessionLocal()
    try:
        create_test_user(db, username="alice")
        create_test_user(db, username="someone-else")
        path = tmp_path / "other.md"
        path.write_text("belongs to someone else", encoding="utf-8")
        service = service_for(db, tmp_path)
        material = service.create_pending_material_from_path(
            "other.md", path, path.stat().st_size, None, "someone-else"
        )
        client = build_client(db)

        with patch("app.api.materials.MaterialService", side_effect=lambda session: service_for(session, tmp_path)):
            response = client.delete(f"/api/materials/{material['id']}")

        assert response.status_code == 404
        assert db.query(StudyMaterial).filter_by(id=material["id"]).one_or_none() is not None
    finally:
        db.close()
        engine.dispose()
