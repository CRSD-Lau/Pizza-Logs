"""Hostile uploads are synthetic; never exercise production or real raw logs."""

import asyncio
import io
import threading
import uuid
import zipfile
from pathlib import Path

import pytest

import archive_upload
import main
import parser_core
import upload_limits
from archive_upload import ArchiveValidationError, open_combat_log, validate_upload
from quick_classifier import quick_classify
from tests.test_archive_upload import VALID_LOG, _StreamingRequest, _sse_events, _zip


@pytest.mark.parametrize("suffix", ["txt", "zip"])
@pytest.mark.parametrize("tail,code", [
    ("console.log('junk');\n", "INVALID_LOG_CONTENT"),
    ("1/1 00:00:01.000  NOT_A_WOW_EVENT,junk\n", "INVALID_LOG_CONTENT"),
    ("1/1 00:00:01.000  SPELL_DAMAGE,0x1,Player,0x1,0x2,Target,0x1\n", "INVALID_LOG_CONTENT"),
    ("\x00MZbinary\n", "INVALID_TEXT_CONTENT"),
])
def test_entire_file_is_validated_after_large_valid_prefix(tmp_path, suffix, tail, code):
    body = VALID_LOG * 450 + tail
    path = tmp_path / f"late-payload.{suffix}"
    if suffix == "zip":
        # Avoid an artificially repetitive fixture tripping the separate ratio gate.
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.writestr("combat.txt", body)
    else:
        path.write_text(body, encoding="utf-8")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == code


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "cp1252"])
def test_text_encoding_preserves_non_ascii_character_names(tmp_path, encoding):
    body = VALID_LOG.replace("Player1", "Éowyn’s")
    path = tmp_path / "combat.txt"
    path.write_bytes(body.encode(encoding))
    selection = validate_upload(path, path.name)
    with open_combat_log(path, selection) as reader:
        assert "".join(reader) == body


def test_undecodable_bytes_are_rejected_without_replacement_characters(tmp_path):
    path = tmp_path / "combat.txt"
    path.write_bytes(VALID_LOG.encode().replace(b"Player1", b"Player\x81"))
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "INVALID_TEXT_ENCODING"


@pytest.mark.parametrize("member,payload", [("payload.exe", b"MZ"), ("payload.exe/", b"MZ")])
def test_zip_cannot_hide_unrelated_content_as_files_or_folders(tmp_path, member, payload):
    path = _zip(tmp_path / "junk.zip", {"combat.txt": VALID_LOG, member: payload})
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "UNSUPPORTED_ARCHIVE_MEMBER"


def test_one_log_with_empty_folders_is_supported(tmp_path):
    path = _zip(tmp_path / "log.zip", {"folder/": "", "folder/combat.LOG": VALID_LOG})
    assert validate_upload(path, path.name).member_name == "folder/combat.LOG"


def test_every_canonical_upload_fixture_passes_strict_admission():
    fixtures = list((Path(__file__).parent / "fixtures").glob("*/combatlog.txt"))
    assert len(fixtures) >= 3
    for path in fixtures:
        assert validate_upload(path, path.name).format == "text"


@pytest.mark.parametrize("limit,value", [
    ("MAX_LOG_RECORDS", 2), ("MAX_LOG_UNITS", 1),
    ("MAX_LOG_NAMES", 1), ("MAX_LOG_SPELLS", 0),
    ("MAX_LOG_ACTOR_SPELL_PAIRS", 1), ("MAX_LOG_FIELDS", 10),
    ("MAX_LOG_FIELD_CHARS", 5),
])
def test_complexity_limits_reject_before_aggregation(tmp_path, monkeypatch, limit, value):
    monkeypatch.setattr(archive_upload, limit, value)
    path = tmp_path / "combat.txt"
    path.write_text(VALID_LOG, encoding="utf-8")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "LOG_COMPLEXITY_LIMIT"


@pytest.mark.parametrize("markers", [False, True])
@pytest.mark.parametrize("limit,value", [("MAX_ENCOUNTER_EVENTS", 1), ("MAX_ENCOUNTER_TEXT_CHARS", 100)])
def test_crafted_unfinished_encounter_is_bounded_in_both_workers(monkeypatch, markers, limit, value):
    monkeypatch.setattr(upload_limits, limit, value)
    body = VALID_LOG if markers else "\n".join(VALID_LOG.splitlines()[1:4])
    for parse in (quick_classify, parser_core.CombatLogParser().parse_file):
        with pytest.raises(ArchiveValidationError) as result:
            parse(io.StringIO(body))
        assert result.value.code == "LOG_COMPLEXITY_LIMIT"


def test_session_unit_map_has_cumulative_limit(monkeypatch):
    monkeypatch.setattr(parser_core, "MAX_SESSION_UNIT_ENTRIES", 1)
    with pytest.raises(ArchiveValidationError) as result:
        parser_core.CombatLogParser().parse_file(io.StringIO(VALID_LOG))
    assert result.value.code == "LOG_COMPLEXITY_LIMIT"


def test_many_spell_names_with_same_actor_cannot_expand_maps(tmp_path, monkeypatch):
    monkeypatch.setattr(archive_upload, "MAX_LOG_SPELLS", 2)
    hit = VALID_LOG.splitlines()[1]
    path = tmp_path / "spells.txt"
    path.write_text("\n".join(hit.replace("Coldflame", f"Spell {index}") for index in range(3)), encoding="utf-8")
    with pytest.raises(ArchiveValidationError) as result:
        validate_upload(path, path.name)
    assert result.value.code == "LOG_COMPLEXITY_LIMIT"


def test_same_timestamp_damage_cannot_grow_quadratic_history(monkeypatch):
    monkeypatch.setattr(parser_core, "MAX_RECENT_DAMAGE_EVENTS", 2)
    hit = VALID_LOG.splitlines()[1].replace(
        '0x0600000000000001,"Player1",0x514,0xF130000000000001,"Lord Marrowgar",0xa48',
        '0xF130000000000001,"Lord Marrowgar",0xa48,0x0600000000000001,"Player1",0x514',
    )
    body = "\n".join([VALID_LOG.splitlines()[0], hit, hit, hit])
    with pytest.raises(ArchiveValidationError) as result:
        parser_core.CombatLogParser().parse_file(io.StringIO(body))
    assert result.value.code == "LOG_COMPLEXITY_LIMIT"


def test_retained_reports_have_cumulative_detail_budget(monkeypatch):
    monkeypatch.setattr(upload_limits, "MAX_PARSED_DETAIL_BYTES", 1)
    with pytest.raises(ArchiveValidationError) as result:
        parser_core.CombatLogParser().parse_file(io.StringIO(VALID_LOG))
    assert result.value.code == "LOG_COMPLEXITY_LIMIT"


def test_aggregation_cooperatively_stops_after_reader_finishes():
    cancelled = threading.Event()
    cancelled.set()
    with pytest.raises(TimeoutError, match="aggregation"):
        parser_core.CombatLogParser().parse_file(io.StringIO(VALID_LOG), cancel_event=cancelled)


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["/parse", "/parse/", "/parse-debug", "/parse-stream"])
async def test_disabled_legacy_routes_reject_before_reading_multipart_body(monkeypatch, path):
    monkeypatch.setattr(main, "LEGACY_PARSER_ROUTES_ENABLED", False)
    sent = []

    async def receive():
        raise AssertionError("Disabled legacy routes must not read or spool a request body")

    async def send(message):
        sent.append(message)

    await main.app({
        "type": "http", "asgi": {"version": "3.0"}, "method": "POST",
        "path": path, "raw_path": path.encode(), "root_path": "", "query_string": b"",
        "headers": [(b"content-type", b"multipart/form-data; boundary=attack")],
        "server": ("test", 80), "client": ("test", 123), "scheme": "http", "http_version": "1.1",
    }, receive, send)
    assert sent[0]["status"] == 404


@pytest.mark.anyio
@pytest.mark.parametrize("header,value,status", [
    ("content-type", "multipart/form-data", 415),
    ("content-encoding", "gzip", 415),
    ("content-length", "+10", 400),
])
async def test_invalid_transport_is_rejected_before_reading_bytes(header, value, status):
    request = _StreamingRequest(VALID_LOG.encode())
    request.headers[header] = value

    async def stream():
        raise AssertionError("Invalid transport must be rejected before body reading")
        yield b""  # pragma: no cover

    request.stream = stream
    with pytest.raises(main.HTTPException) as result:
        await main.upload_archive_stream(str(uuid.uuid4()), request, "combat.txt", 2026)
    assert result.value.status_code == status


@pytest.mark.anyio
async def test_body_length_mismatch_cleans_files_and_releases_admission(tmp_path, monkeypatch):
    slots = asyncio.Semaphore(1)
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)
    request = _StreamingRequest(VALID_LOG.encode())
    request.headers["content-length"] = "1"
    with pytest.raises(main.HTTPException) as result:
        await main.upload_archive_stream(str(uuid.uuid4()), request, "combat.txt", 2026)
    assert result.value.status_code == 400
    assert not slots.locked()
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_invalid_content_never_reaches_classification_or_full_parse(tmp_path, monkeypatch):
    slots = asyncio.Semaphore(1)
    monkeypatch.setattr(main, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(main, "_upload_slots", slots)

    def must_not_run(*_args):
        raise AssertionError("Invalid input must not reach aggregation")

    monkeypatch.setattr(main, "_quick_classify_path", must_not_run)
    monkeypatch.setattr(main, "_full_parse_path", must_not_run)
    response = await main.upload_archive_stream(
        str(uuid.uuid4()), _StreamingRequest((VALID_LOG + "junk\n").encode()), "combat.txt", 2026,
    )
    events = _sse_events("".join([chunk async for chunk in response.body_iterator]))
    assert events[-1]["code"] == "INVALID_LOG_CONTENT"
    assert not any(event["type"] in {"quick-result", "done"} for event in events)
    assert not slots.locked()
    assert not list(tmp_path.iterdir())
