"""Archive validation, security controls, and streamed upload integration."""

from __future__ import annotations

import io
import json
import os
import sys
import time
import uuid
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import archive_upload  # noqa: E402
import main  # noqa: E402
from archive_upload import ArchiveValidationError, open_combat_log, validate_upload  # noqa: E402
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


def test_validator_selects_a_usable_log_instead_of_only_the_largest_txt(tmp_path: Path):
    path = _zip(tmp_path / "multiple.zip", {
        "large-readme.txt": "".join(f"not a combat log {i:05d} value {i * 7919}\n" for i in range(5000)),
        "WoWCombatLog.txt": VALID_LOG,
    })
    selection = validate_upload(path, path.name)
    assert selection.member_name == "WoWCombatLog.txt"


@pytest.mark.parametrize(
    "filename,members,code",
    [
        ("bad.zip", {"../escape.txt": VALID_LOG}, "UNSAFE_MEMBER_PATH"),
        ("bad.zip", {"nested.zip": b"PK\x03\x04"}, "NESTED_ARCHIVE"),
        ("bad.zip", {"readme.md": "no log"}, "NO_USABLE_COMBAT_LOG"),
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
        self.headers = {"content-length": str(len(body))}

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
