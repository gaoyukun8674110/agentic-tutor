"""Upload validation helpers."""

import codecs
import hashlib
import re
import zipfile
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from app.config import settings
from app.services.materials import SUPPORTED_EXTENSIONS
from app.utils.errors import api_error

ZIP_SIGNATURE = b"PK\x03\x04"
PDF_SIGNATURE = b"%PDF-"
TEXT_EXTENSIONS = {".txt", ".md"}
ZIP_EXTENSIONS = {".docx", ".epub"}


def max_upload_bytes() -> int:
    return max(1, settings.MAX_UPLOAD_SIZE_MB) * 1024 * 1024


async def save_validated_upload(file: UploadFile, dest_dir: Path) -> tuple[Path, int]:
    """Stream an UploadFile to disk and validate the resulting file."""
    filename = file.filename or "material"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise api_error(400, "unsupported_material_type", f"Unsupported material file type: {suffix or 'unknown'}")

    dest_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    total = 0
    temp_path = dest_dir / f".upload-{uuid4().hex}.part"

    try:
        with temp_path.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
                total += len(chunk)
                if total > max_upload_bytes():
                    output.close()
                    temp_path.unlink(missing_ok=True)
                    raise api_error(413, "upload_too_large", f"Upload exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit")
                output.write(chunk)

        validate_uploaded_file(temp_path, filename)
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise

    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(filename).name or "material").strip("._") or "material"
    final_path = dest_dir / f"{digest.hexdigest()[:16]}-{safe_name}"
    temp_path.replace(final_path)
    return final_path, total


def validate_uploaded_file(path: Path, filename: str) -> None:
    """Validate a material file that has already been written to disk."""
    suffix = Path(filename).suffix.lower()
    if suffix in ZIP_EXTENSIONS:
        if not read_file_head(path, 8).startswith(ZIP_SIGNATURE):
            raise api_error(
                400, "invalid_upload_signature", f"{suffix} upload does not look like a valid ZIP-based document"
            )
        try:
            with zipfile.ZipFile(path) as archive:
                uncompressed_size = sum(info.file_size for info in archive.infolist())
        except zipfile.BadZipFile as error:
            raise api_error(
                400, "invalid_upload_signature", f"{suffix} upload is not a readable ZIP archive"
            ) from error
        if uncompressed_size > settings.MAX_ZIP_UNCOMPRESSED_BYTES:
            raise api_error(413, "upload_too_large", "Archive expands beyond the 100 MB safety limit")

    if suffix == ".pdf":
        if not read_file_head(path, 5).startswith(PDF_SIGNATURE):
            raise api_error(400, "invalid_upload_signature", "PDF upload does not start with a PDF signature")
        try:
            reader = PdfReader(path)
        except Exception as error:
            raise api_error(400, "invalid_upload_signature", "PDF upload is not readable") from error
        if len(reader.pages) > settings.MAX_PDF_PAGES:
            raise api_error(413, "upload_too_large", "PDF exceeds the 500 page safety limit")

    if suffix in TEXT_EXTENSIONS:
        decoder = codecs.getincrementaldecoder("utf-8")()
        try:
            with path.open("rb") as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    decoder.decode(chunk)
                decoder.decode(b"", final=True)
        except UnicodeDecodeError as error:
            raise api_error(400, "invalid_text_upload", "Text uploads must be valid UTF-8") from error


def read_file_head(path: Path, size: int = 8) -> bytes:
    """Read up to size bytes from the beginning of a file."""
    with path.open("rb") as source:
        return source.read(size)
