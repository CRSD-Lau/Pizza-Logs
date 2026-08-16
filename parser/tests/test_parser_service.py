"""FastAPI parser-service upload contract tests."""

import io
import os
import sys

import pytest
from fastapi import HTTPException, UploadFile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import main


def test_interactive_parser_docs_are_disabled_by_default():
    paths = {route.path for route in main.app.routes}
    assert "/docs" not in paths
    assert "/redoc" not in paths
    assert "/openapi.json" not in paths


@pytest.mark.anyio
async def test_legacy_parser_routes_are_disabled_by_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(main, "LEGACY_PARSER_ROUTES_ENABLED", False)
    upload = UploadFile(filename="combat.txt", file=io.BytesIO(b"test"))

    with pytest.raises(HTTPException) as exc_info:
        await main.parse_log_stream(file=upload, year_hint=0)

    assert exc_info.value.status_code == 404


@pytest.mark.anyio
async def test_parse_stream_rejects_unsupported_filename_extension(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(main, "LEGACY_PARSER_ROUTES_ENABLED", True)
    upload = UploadFile(
        filename="not-a-log.exe",
        file=io.BytesIO(b"not a combat log"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await main.parse_log_stream(file=upload, year_hint=0)

    assert exc_info.value.status_code == 400
    assert "Only .txt and .log files are supported" in exc_info.value.detail


@pytest.mark.anyio
async def test_legacy_parse_stream_enforces_byte_limit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(main, "LEGACY_PARSER_ROUTES_ENABLED", True)
    monkeypatch.setattr(main, "MAX_COMPRESSED_BYTES", 4)
    upload = UploadFile(filename="combat.txt", file=io.BytesIO(b"12345"))

    with pytest.raises(HTTPException) as exc_info:
        await main.parse_log_stream(file=upload, year_hint=0)

    assert exc_info.value.status_code == 413
