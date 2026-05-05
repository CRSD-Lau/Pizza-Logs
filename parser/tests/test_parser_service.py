"""FastAPI parser-service upload contract tests."""

import io
import os
import sys

import pytest
from fastapi import HTTPException, UploadFile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import parse_log_stream


@pytest.mark.anyio
async def test_parse_stream_rejects_unsupported_filename_extension():
    upload = UploadFile(
        filename="not-a-log.exe",
        file=io.BytesIO(b"not a combat log"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await parse_log_stream(file=upload, year_hint=0)

    assert exc_info.value.status_code == 400
    assert "Only .txt and .log files are supported" in exc_info.value.detail
