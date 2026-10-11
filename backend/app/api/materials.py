"""Study material upload and retrieval API."""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import SessionLocal, get_db
from app.models.user import User
from app.services.materials import SUPPORTED_EXTENSIONS, MaterialService
from app.utils.errors import api_error
from app.utils.upload import max_upload_bytes, save_validated_upload

router = APIRouter(prefix="/api/materials", tags=["materials"], dependencies=[Depends(get_current_user)])


def ingest_material_background(material_id: int) -> None:
    """Ingest a material in a fresh session owned by the background task."""
    db = SessionLocal()
    try:
        MaterialService(db).ingest_material(material_id)
    finally:
        db.close()


class MaterialSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    material_ids: list[int] | None = None
    top_k: int | None = Field(default=None, ge=1, le=10)


@router.post("/upload", response_model=dict, status_code=202)
async def upload_material(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload one learning material and make it searchable."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_upload_bytes() + 1024 * 1024:
        raise api_error(413, "upload_too_large", f"Upload exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit")

    try:
        path, size = await save_validated_upload(file, Path(settings.RAG_UPLOAD_DIR))
        service = MaterialService(db)
        material = service.create_pending_material_from_path(
            filename=file.filename or "material",
            storage_path=path,
            size_bytes=size,
            content_type=file.content_type,
            user_id=current_user.username,
        )
        background_tasks.add_task(ingest_material_background, int(material["id"]))
        return material
    except ValueError as error:
        raise api_error(400, "invalid_material", str(error)) from error


@router.delete("/{material_id}", response_model=dict)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = MaterialService(db)
    return service.delete_material(material_id, user_id=current_user.username)


@router.get("", response_model=dict)
def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List uploaded learning materials."""
    service = MaterialService(db)
    return {
        "materials": service.list_materials(user_id=current_user.username),
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
    }


@router.post("/search", response_model=dict)
def search_materials(
    request: MaterialSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search uploaded learning materials for Tutor context."""
    service = MaterialService(db)
    chunks: list[dict[str, Any]] = service.search_materials(
        query=request.query,
        user_id=current_user.username,
        material_ids=request.material_ids,
        top_k=request.top_k,
    )
    return {"chunks": chunks, "embedding_mode": service.embedding_mode}
