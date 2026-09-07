"""Archive validation, security controls, and streamed upload integration."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import sys
import threading
import time
import uuid
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import archive_upload  # noqa: E402
import main  # noqa: E402
from archive_upload import ArchiveValidationError, open_combat_log, validate_upload  # noqa: E402
from version import PARSER_VERSION  # noqa: E402
from quick_classifier import quick_classify  # noqa: E402


VALID_LOG = "\n".join([
    '1/1 00:00:01.000  ENCOUNTER_START,1084,"Lord Marrowgar",3,10',
    '1/1 00:00:02.000  SPELL_DAMAGE,0x0600000000000001,"Player1",0x514,0xF130000000000001,"Lord Marrowgar",0xa48,69146,"Coldflame",4,1000,0,4,0,0,0,nil,nil,nil,nil,0',
    '1/1 00:00:03.000  SPELL_DAMAGE,0x0600000000000002,"Player2",0x514,0xF130000000000001,"Lord Marrowgar",0xa48,69146,"Coldflame",4,1000,0,4,0,0,0,nil,nil,nil,nil,0',
    '1/1 00:01:02.000  UNIT_DIED,0x0000000000000000,nil,0x80000000,0xF130000000000001,"Lord Marrowgar",0xa48',
    '1/1 00:01:02.100  ENCOUNTER_END,1084,"Lord Marrowgar",3,10,1',
]) + "\n"


def _zip(path: Path, members: dict[str, str | bytes]) -> Path:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return path


def test_uppercase_txt_member_is_accepted_and_streamed(tmp_path: Path):
    path = _zip(tmp_path / "combat.zip", {"folder/WOWCOMBATLOG.TXT": VALID_LOG})
    selection = validate_upload(path, "combat.ZIP")
    assert selection.member_name == "folder/WOWCOMBATLOG.TXT"
    with open_combat_log(path, selection) as fh:
        assert "ENCOUNTER_START" in fh.read()


def test_archive_rejects_multiple_text_files_instead_of_silently_selecting_one(tmp_path: Path):
    path = _zip(tmp_path / "multiple.zip", {
        "large-readme.txt": "".join(f"not a combat log {i:05d} value {i * 7919}\n" for i in range(5000)),
        "WoWCombatLog.txt": VALID_LOG,
    })
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "MULTIPLE_COMBAT_LOGS"


@pytest.mark.parametrize(
    "filename,members,code",
    [
        ("bad.zip", {"../escape.txt": VALID_LOG}, "UNSAFE_MEMBER_PATH"),
        ("bad.zip", {"nested.zip": b"PK\x03\x04"}, "NESTED_ARCHIVE"),
        ("bad.zip", {"readme.md": "no log"}, "UNSUPPORTED_ARCHIVE_MEMBER"),
    ],
)
def test_archive_security_rejections(tmp_path: Path, filename: str, members: dict[str, str | bytes], code: str):
    path = _zip(tmp_path / filename, members)
    with pytest.raises(ArchiveValidationError) as exc_info:
        validate_upload(path, filename)
    assert exc_info.value.code == code
    assert not (tmp_path.parent / "escape.txt").exists()


def test_magic_byte_mismatch_is_rejected(tmp_path: Path):
    path = tmp_path / "fake.zip"
    path.write_bytes(VALID_LOG.encode())
    with pytest.raises(ArchiveValidationError) as exc_info:
        validate_upload(path, path.name)
    assert exc_info.value.code == "MAGIC_MISMATCH"


def test_compressed_uncompressed_member_and_ratio_limits(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    text_path = tmp_path / "combat.txt"
    text_path.write_text(VALID_LOG, encoding="utf-8")
    monkeypatch.setattr(archive_upload, "MAX_COMPRESSED_BYTES", 1)
    with pytest.raises(ArchiveValidationError, match="compressed-size"):
        validate_upload(text_path, text_path.name)

    monkeypatch.setattr(archive_upload, "MAX_COMPRESSED_BYTES", 100 * 1024 * 1024)
    archive = _zip(tmp_path / "limits.zip", {"one.txt": VALID_LOG, "two.txt": VALID_LOG})
    monkeypatch.setattr(archive_upload, "MAX_ARCHIVE_MEMBERS", 1)
    with pytest.raises(ArchiveValidationError) as exc_info:
        validate_upload(archive, archive.name)
    assert exc_info.value.code == "MEMBER_COUNT_LIMIT"

    monkeypatch.setattr(archive_upload, "MAX_ARCHIVE_MEMBERS", 32)
    monkeypatch.setattr(archive_upload, "MAX_UNCOMPRESSED_BYTES", 8)
    with pytest.raises(ArchiveValidationError) as exc_info:
        validate_upload(archive, archive.name)
    assert exc_info.value.code == "UNCOMPRESSED_SIZE_LIMIT"

    monkeypatch.setattr(archive_upload, "MAX_UNCOMPRESSED_BYTES", 1024 * 1024 * 1024)
    monkeypatch.setattr(archive_upload, "MAX_COMPRESSION_RATIO", 2.0)
    ratio_archive = _zip(tmp_path / "ratio.zip", {"combat.txt": VALID_LOG * 100})
    with pytest.raises(ArchiveValidationError) as exc_info:
        validate_upload(ratio_archive, ratio_archive.name)
    assert exc_info.value.code == "COMPRESSION_RATIO_LIMIT"


def test_quick_classification_is_per_attempt(tmp_path: Path):
    second = VALID_LOG.replace("1084", "1084").replace(",3,10", ",6,25").replace("69146", "70825")
    path = _zip(tmp_path / "two-attempts.zip", {"WoWCombatLog.TxT": VALID_LOG + second})
    selection = validate_upload(path, path.name)
    with open_combat_log(path, selection) as fh:
        results = quick_classify(fh)
    assert [item["mode"] for item in results] == ["10N", "25H"]


def test_heuristic_boss_event_after_quiet_gap_starts_new_attempt():
    lines = []
    for base, spell_id in ((1, 69146), (100, 70825)):
        for offset in range(10):
            minute, second = divmod(base + offset, 60)
            lines.append(
                f'1/1 00:{minute:02d}:{second:02d}.000  SPELL_DAMAGE,'
                f'0x0600000000000001,"Player",0x514,0xF130000000000001,'
                f'"Lord Marrowgar",0xa48,{spell_id},"Coldflame",4,1000,0,4,0,0,0,nil,nil,nil,nil,0'
            )
    results = quick_classify(io.StringIO("\n".join(lines)))
    assert [item["mode"] for item in results] == ["10N", "25H"]


class _StreamingRequest:
    def __init__(self, body: bytes, chunk_size: int = 4096):
        self.body = body
        self.chunk_size = chunk_size
        self.headers = {"content-length": str(len(body)), "content-type": "application/octet-stream"}

    async def stream(self):
        for offset in range(0, len(self.body), self.chunk_size):
            yield self.body[offset:offset + self.chunk_size]


def _sse_events(body: str) -> list[dict]:
    events = []
    for chunk in body.split("\n\n"):
        for line in chunk.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
    return events


@pytest.mark.anyio
async def test_actual_upload_to_quick_classification_and_full_parse_flow(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    archive_path = _zip(tmp_path / "flow.zip", {"WoWCombatLog.txt": VALID_LOG})
    body = archive_path.read_bytes()
    upload_id = str(uuid.uuid4())
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path / "uploads")
    main.UPLOAD_TEMP_DIR.mkdir()

    response = await main.upload_archive_stream(
        upload_id=upload_id,
        request=_StreamingRequest(body),  # type: ignore[arg-type]
        x_filename="flow.zip",
        x_year_hint=2026,
    )
    chunks: list[str] = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
    events = _sse_events("".join(chunks))

    event_types = [event["type"] for event in events]
    assert event_types.index("quick-result") < event_types.index("done")
    assert events[event_types.index("quick-result")]["result"]["encounters"][0]["mode"] == "10N"
    done = events[event_types.index("done")]["data"]
    assert done["encounters"][0]["difficulty"] == "10N"
    assert done["receivedBytes"] == len(body)
    assert done["provenance"]["parserVersion"] == PARSER_VERSION
    assert done["provenance"]["metricSchemaVersion"] == "1"
    assert done["provenance"]["compatibilityProfile"] == "canonical-v1"
    assert done["provenance"]["referenceSha"] is None
    assert done["uploadTimings"]["finalByteToQuickResultMs"] >= 0
    assert main._upload_states[upload_id]["state"] == "complete"
    assert not list(main.UPLOAD_TEMP_DIR.glob("*.part"))
    assert not list(main.UPLOAD_TEMP_DIR.glob("*.upload"))


@pytest.mark.anyio
async def test_upload_rejects_non_uuid_and_oversize_content_length():
    with pytest.raises(Exception) as bad_id:
        await main.upload_archive_stream("by-ip", _StreamingRequest(b"x"), "combat.txt", 2026)  # type: ignore[arg-type]
    assert getattr(bad_id.value, "status_code", None) == 400

    request = _StreamingRequest(b"x")
    request.headers["content-length"] = str(main.MAX_COMPRESSED_BYTES + 1)
    with pytest.raises(Exception) as too_large:
        await main.upload_archive_stream(str(uuid.uuid4()), request, "combat.txt", 2026)  # type: ignore[arg-type]
    assert getattr(too_large.value, "status_code", None) == 413


@pytest.mark.anyio
async def test_upload_rejects_duplicate_client_id(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    upload_id = str(uuid.uuid4())
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    assert main._reserve_upload_state(upload_id, "first.zip") is True

    with pytest.raises(Exception) as duplicate:
        await main.upload_archive_stream(
            upload_id,
            _StreamingRequest(b"not-used"),  # type: ignore[arg-type]
            "second.zip",
            2026,
        )

    assert getattr(duplicate.value, "status_code", None) == 409
    assert main._upload_states[upload_id]["filename"] == "first.zip"


def test_abandoned_partial_upload_cleanup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    stale = tmp_path / f"{uuid.uuid4()}.part"
    stale.write_bytes(b"partial")
    old = time.time() - 7200
    os.utime(stale, (old, old))
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "UPLOAD_ABANDONED_SECONDS", 3600)
    main._cleanup_abandoned_uploads()
    assert not stale.exists()


@pytest.mark.anyio
async def test_full_processing_timeout_returns_clear_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    archive_path = _zip(tmp_path / "timeout.zip", {"WoWCombatLog.txt": VALID_LOG})
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", upload_dir)
    monkeypatch.setattr(main, "UPLOAD_PROCESSING_TIMEOUT_SECONDS", 0.01)

    def slow_full_parse(*_args):
        time.sleep(0.1)
        raise AssertionError("worker result should be ignored after timeout")

    monkeypatch.setattr(main, "_full_parse_path", slow_full_parse)
    response = await main.upload_archive_stream(
        str(uuid.uuid4()),
        _StreamingRequest(archive_path.read_bytes()),  # type: ignore[arg-type]
        "timeout.zip",
        2026,
    )
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
    events = _sse_events("".join(chunks))
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "PROCESSING_TIMEOUT"


def test_archive_counts_directories_and_checks_their_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(archive_upload, "MAX_ARCHIVE_MEMBERS", 2)
    path = _zip(tmp_path / "dirs.zip", {"a/": "", "b/": "", "combat.txt": VALID_LOG})
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "MEMBER_COUNT_LIMIT"
    path = _zip(tmp_path / "unsafe.zip", {"../outside/": "", "combat.txt": VALID_LOG})
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "UNSAFE_MEMBER_PATH"


def test_archive_directory_metadata_is_bounded_before_parsing_entries(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = _zip(tmp_path / "metadata.zip", {"combat.txt": VALID_LOG, "other.txt": VALID_LOG})
    monkeypatch.setattr(archive_upload, "MAX_ARCHIVE_METADATA_BYTES", 100)
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "ARCHIVE_METADATA_LIMIT"


def test_duplicate_zip_names_cannot_select_different_member_metadata(tmp_path: Path):
    path = tmp_path / "duplicate.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("combat.txt", VALID_LOG)
        with pytest.warns(UserWarning, match="Duplicate name"):
            archive.writestr("combat.txt", "unrelated text")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "DUPLICATE_MEMBER"


@pytest.mark.parametrize("method", [zipfile.ZIP_BZIP2, zipfile.ZIP_LZMA])
def test_archive_rejects_unbounded_codecs_before_opening_members(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, method: int):
    path = tmp_path / "unsupported-codec.zip"
    with zipfile.ZipFile(path, "w", compression=method) as archive:
        archive.writestr("combat.txt", VALID_LOG)

    def must_not_open_member(*_args):
        raise AssertionError("Unsupported codecs must be rejected before decompression")

    monkeypatch.setattr(archive_upload, "_assert_usable_combat_log", must_not_open_member)
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "UNSUPPORTED_COMPRESSION"


@pytest.mark.parametrize("method", [zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED])
def test_supported_zip_methods_preserve_streamed_log_content(tmp_path: Path, method: int):
    path = tmp_path / "supported-codec.zip"
    with zipfile.ZipFile(path, "w", compression=method) as archive:
        archive.writestr("combat.txt", VALID_LOG)
    selection = validate_upload(path, path.name)
    with open_combat_log(path, selection) as reader:
        assert "".join(reader) == VALID_LOG


@pytest.mark.parametrize("directory", [False, True])
def test_symlink_members_are_rejected_including_directory_entries(tmp_path: Path, directory: bool):
    path = tmp_path / "symlink.zip"
    link = zipfile.ZipInfo("linked/" if directory else "linked.txt")
    link.create_system = 3
    link.external_attr = 0o120777 << 16
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr(link, "elsewhere")
        archive.writestr("combat.txt", VALID_LOG)
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "SYMLINK_MEMBER"


def test_encrypted_member_is_rejected_before_reading_payload(tmp_path: Path):
    path = _zip(tmp_path / "encrypted.zip", {"combat.txt": VALID_LOG})
    data = bytearray(path.read_bytes())
    local = data.index(b"PK\x03\x04")
    central = data.index(b"PK\x01\x02")
    data[local + 6] |= 1
    data[central + 8] |= 1
    path.write_bytes(data)
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "ENCRYPTED_ARCHIVE"


@pytest.mark.parametrize("suffix", ["txt", "zip"])
def test_line_limit_applies_after_valid_prefix_and_to_all_readers(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, suffix: str):
    limit = 1024
    monkeypatch.setattr(archive_upload, "MAX_COMBAT_LOG_LINE_CHARS", limit)
    body = VALID_LOG + "x" * (limit + 1) + "\n"
    path = tmp_path / f"lines.{suffix}"
    if suffix == "zip":
        _zip(path, {"combat.txt": body})
    else:
        path.write_text(body, encoding="utf-8")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "LINE_LENGTH_LIMIT"


def test_unusable_prefix_cannot_materialize_an_unbounded_line(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(archive_upload, "MAX_COMBAT_LOG_LINE_CHARS", 128)
    path = tmp_path / "line.txt"
    path.write_text("x" * 129, encoding="utf-8")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "LINE_LENGTH_LIMIT"


def test_direct_text_obeys_configured_uncompressed_limit(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "log.txt"
    path.write_text(VALID_LOG, encoding="utf-8")
    monkeypatch.setattr(archive_upload, "MAX_UNCOMPRESSED_BYTES", 100)
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "UNCOMPRESSED_SIZE_LIMIT"


def test_quick_classifier_does_not_swallow_cancellation_or_read_remaining_file():
    class CancellingReader(io.StringIO):
        def readline(self, *_args):
            raise TimeoutError("cancelled")

        def read(self, *_args):
            raise AssertionError("must not materialize remaining input")

    with pytest.raises(TimeoutError, match="cancelled"):
        quick_classify(CancellingReader(VALID_LOG))


@pytest.mark.anyio
async def test_receive_cancellation_releases_admission_and_removes_partial_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    slots = asyncio.Semaphore(1)
    received = asyncio.Event()

    class InterruptedRequest:
        headers = {"content-type": "application/octet-stream"}

        async def stream(self):
            yield b"partial"
            received.set()
            await asyncio.Event().wait()

    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)
    upload_id = str(uuid.uuid4())
    task = asyncio.create_task(main.upload_archive_stream(upload_id, InterruptedRequest(), "combat.txt", 2026))
    await asyncio.wait_for(received.wait(), 1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not slots.locked()
    assert not list(tmp_path.iterdir())
    assert main._upload_states[upload_id]["errorCode"] == "UPLOAD_CANCELLED"


@pytest.mark.anyio
@pytest.mark.parametrize("phase", ["validate", "full"])
async def test_timeout_retains_admission_and_files_until_worker_really_stops(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, phase: str):
    slots = asyncio.Semaphore(1)
    worker_started = threading.Event()
    worker_finish = threading.Event()

    def blocked_worker(*_args):
        worker_started.set()
        worker_finish.wait(2)
        raise TimeoutError("worker stopped")

    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)
    monkeypatch.setattr(main, "UPLOAD_PROCESSING_TIMEOUT_SECONDS", 0.03)
    monkeypatch.setattr(main, "validate_upload" if phase == "validate" else "_full_parse_path", blocked_worker)
    try:
        response = await main.upload_archive_stream(str(uuid.uuid4()), _StreamingRequest(VALID_LOG.encode()), "combat.txt", 2026)
        chunks = [event async for event in response.body_iterator]
        assert worker_started.is_set()
        assert _sse_events("".join(chunks))[-1]["code"] == "PROCESSING_TIMEOUT"
        assert slots.locked()
        files = list(tmp_path.glob("*.upload"))
        assert len(files) == 1
        os.utime(files[0], (1, 1))
        main._cleanup_abandoned_uploads()
        assert files[0].exists()
        with pytest.raises(main.HTTPException) as busy:
            await main.upload_archive_stream(str(uuid.uuid4()), _StreamingRequest(VALID_LOG.encode()), "combat.txt", 2026)
        assert busy.value.status_code == 429
    finally:
        worker_finish.set()
        for _ in range(100):
            if not slots.locked():
                break
            await asyncio.sleep(0.01)
    assert not slots.locked()
    assert not list(tmp_path.glob("*.upload"))


@pytest.mark.anyio
async def test_asgi_send_failure_before_body_iteration_releases_upload(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    slots = asyncio.Semaphore(1)
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)
    upload_id = str(uuid.uuid4())
    response = await main.upload_archive_stream(upload_id, _StreamingRequest(VALID_LOG.encode()), "combat.txt", 2026)

    async def send(_message):
        raise OSError("connection closed")

    async def receive():
        return {"type": "http.disconnect"}

    with pytest.raises(Exception):
        await response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send)
    assert not slots.locked()
    assert not list(tmp_path.iterdir())
    assert main._upload_states[upload_id]["state"] == "error"


def test_progress_state_count_is_bounded_without_evicting_active_uploads(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(main, "_upload_states", {})
    monkeypatch.setattr(main, "UPLOAD_STATE_LIMIT", 2)
    assert main._reserve_upload_state("active", "one.txt")
    assert main._reserve_upload_state("complete", "two.txt")
    main._set_upload_state("complete", "complete")
    assert main._reserve_upload_state("third", "three.txt")
    assert set(main._upload_states) == {"active", "third"}
    with pytest.raises(main.HTTPException) as result:
        main._reserve_upload_state("fourth", "four.txt")
    assert result.value.status_code == 429


@pytest.mark.anyio
async def test_parser_error_logs_and_public_events_exclude_exception_content(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog):
    private_content = "SENSITIVE_TEST_CONTENT"

    def failing_worker(*_args):
        raise ValueError(private_content)

    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_full_parse_path", failing_worker)
    response = await main.upload_archive_stream(str(uuid.uuid4()), _StreamingRequest(VALID_LOG.encode()), "combat.txt", 2026)
    chunks = [event async for event in response.body_iterator]
    assert _sse_events("".join(chunks))[-1]["code"] == "PROCESSING_ERROR"
    assert private_content not in "".join(chunks)
    assert private_content not in caplog.text
    assert '"exceptionType": "ValueError"' in caplog.text


def test_upload_event_logging_preserves_fields_without_forging_lines(caplog):
    payload = {
        "event": 'upload\r\n{"event":"forged"}',
        "uploadId": "untrusted\r\n\x1b[31m\u0085\u2028\u2029",
        "exceptionType": 'Injected\n"event": "success"',
    }
    with caplog.at_level(logging.INFO, logger=main.logger.name):
        main._log_upload_event(payload["event"], payload["uploadId"], exceptionType=payload["exceptionType"])
    assert len(caplog.records) == 1
    entry = caplog.records[0].getMessage()
    assert len(entry.splitlines()) == 1
    assert "\x1b" not in entry
    assert json.loads(entry) == payload


def test_sse_rejects_non_finite_values_before_emitting_invalid_json():
    with pytest.raises(ValueError):
        main._sse({"type": "done", "data": {"totalDamage": float("inf")}})


@pytest.mark.anyio
async def test_consumer_close_after_done_preserves_complete_state(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    slots = asyncio.Semaphore(1)
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)
    upload_id = str(uuid.uuid4())
    response = await main.upload_archive_stream(upload_id, _StreamingRequest(VALID_LOG.encode()), "combat.txt", 2026)
    completed = False
    async for chunk in response.body_iterator:
        event = _sse_events(chunk)[0]
        if event["type"] == "done":
            completed = True
            assert main._upload_states[upload_id]["state"] == "complete"
            await response.body_iterator.aclose()
            break
    assert completed
    assert main._upload_states[upload_id]["state"] == "complete"
    assert "errorCode" not in main._upload_states[upload_id]
    assert not slots.locked()
    assert not list(tmp_path.iterdir())
