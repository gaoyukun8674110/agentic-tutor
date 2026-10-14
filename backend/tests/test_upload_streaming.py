import asyncio
import tracemalloc

import pytest
from starlette.datastructures import UploadFile

from app.utils.upload import max_upload_bytes, save_validated_upload


class RepeatingStream:
    def __init__(self, total: int, chunk: bytes = b"a" * (1024 * 1024)):
        self.remaining = total
        self.chunk = chunk

    def read(self, size: int = -1) -> bytes:
        if self.remaining <= 0:
            return b""
        amount = min(self.remaining, len(self.chunk), size if size >= 0 else len(self.chunk))
        self.remaining -= amount
        return self.chunk[:amount]


def test_streams_large_txt_to_disk(tmp_path):
    total = 35 * 1024 * 1024
    upload = UploadFile(file=RepeatingStream(total), filename="large.txt")

    path, size = asyncio.run(save_validated_upload(upload, tmp_path))

    assert size == total
    assert path.exists()
    assert path.stat().st_size == total


def test_streaming_peak_memory_is_bounded(tmp_path):
    total = 35 * 1024 * 1024
    upload = UploadFile(file=RepeatingStream(total), filename="large.txt")

    tracemalloc.start()
    try:
        asyncio.run(save_validated_upload(upload, tmp_path))
        peak = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()

    assert peak < 16 * 1024 * 1024


def test_overflow_raises_413_and_leaves_no_temp_file(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)
    upload = UploadFile(file=RepeatingStream(max_upload_bytes() + 1), filename="too-large.txt")

    with pytest.raises(Exception) as exc_info:
        asyncio.run(save_validated_upload(upload, tmp_path))

    assert exc_info.value.status_code == 413
    assert list(tmp_path.iterdir()) == []


def test_bad_pdf_signature_raises_400_and_leaves_no_temp_file(tmp_path):
    upload = UploadFile(file=RepeatingStream(len(b"not a pdf at all"), b"not a pdf at all"), filename="x.pdf")

    with pytest.raises(Exception) as exc_info:
        asyncio.run(save_validated_upload(upload, tmp_path))

    assert exc_info.value.status_code == 400
    assert list(tmp_path.iterdir()) == []
