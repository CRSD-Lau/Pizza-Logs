"""
Pizza Logs — Python Parser Service
FastAPI app that accepts WoW combat log files and returns structured encounter data.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import hashlib
import json
import logging
import os
import shutil
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from archive_upload import (
    MAX_COMPRESSED_BYTES,
    ArchiveSelection,
    ArchiveValidationError,
    open_combat_log,
    validate_upload,
)
from parser_core import CombatLogParser, ParsedEncounter
from quick_classifier import quick_classify
from upload_lifecycle import UploadLease, UploadStreamingResponse, active_upload_paths
from version import PARSER_VERSION, make_parser_provenance

# ── App setup ─────────────────────────────────────────────────────

PARSER_DOCS_ENABLED = os.getenv("ENABLE_PARSER_DOCS", "").lower() in {"1", "true", "yes"}

app = FastAPI(
    title="Pizza Logs Parser",
    description="WoW combat log parsing service",
    version=PARSER_VERSION,
    docs_url="/docs" if PARSER_DOCS_ENABLED else None,
    redoc_url=None,
    openapi_url="/openapi.json" if PARSER_DOCS_ENABLED else None,
)

logger = logging.getLogger("pizza_logs.parser")
logger.setLevel(logging.INFO)
if not logger.handlers:
    log_handler = logging.StreamHandler()
    log_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(log_handler)

UPLOAD_TEMP_DIR = Path(os.getenv(
    "UPLOAD_TEMP_DIR",
    str(Path(tempfile.gettempdir()) / "pizza-logs-uploads"),
))
UPLOAD_TEMP_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_ABANDONED_SECONDS = int(os.getenv("UPLOAD_ABANDONED_SECONDS", "3600"))
UPLOAD_PROCESSING_TIMEOUT_SECONDS = int(os.getenv("UPLOAD_PROCESSING_TIMEOUT_SECONDS", "240"))
UPLOAD_RECEIVE_TIMEOUT_SECONDS = int(os.getenv("UPLOAD_RECEIVE_TIMEOUT_SECONDS", "300"))
UPLOAD_CONCURRENCY = max(1, int(os.getenv("UPLOAD_CONCURRENCY", "4")))
UPLOAD_STATE_LIMIT = max(UPLOAD_CONCURRENCY, int(os.getenv("UPLOAD_STATE_LIMIT", "256")))
FULL_PROCESSING_WORKERS = max(1, int(os.getenv("FULL_PROCESSING_WORKERS", "2")))
QUICK_CLASSIFICATION_WORKERS = max(1, int(os.getenv("QUICK_CLASSIFICATION_WORKERS", "2")))
LEGACY_PARSER_ROUTES_ENABLED = os.getenv("ENABLE_LEGACY_PARSER_ROUTES", "").lower() in {"1", "true", "yes"}

_upload_slots = asyncio.Semaphore(UPLOAD_CONCURRENCY)
_full_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=FULL_PROCESSING_WORKERS,
    thread_name_prefix="pizza-full-parse",
)
_quick_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=QUICK_CLASSIFICATION_WORKERS,
    thread_name_prefix="pizza-quick-classify",
)
_upload_states: dict[str, dict[str, object]] = {}
_upload_states_lock = threading.Lock()

# ── Response models ───────────────────────────────────────────────

class EncounterOut(BaseModel):
    bossName:         str
    bossId:           Optional[int]
    difficulty:       str
    groupSize:        int
    outcome:          str
    durationSeconds:  int
    durationMs:       int = 0
    startedAt:        str
    endedAt:          str
    totalDamage:      float
    totalHealing:     float
    totalAbsorbs:     float = 0
    unattributedAbsorbs: float = 0
    totalDamageTaken: float
    fingerprint:      str
    participants:     list[dict]
    difficultyDetection: dict = Field(default_factory=dict)


class ParseResponse(BaseModel):
    filename:      str
    fileHash:      str
    rawLineCount:  int
    encounters:    list[EncounterOut]
    warnings:      list[str] = Field(default_factory=list)
    sessionDamage: dict[str, float] = Field(default_factory=dict)
    sessionAnalytics: dict[str, dict] = Field(default_factory=dict)
    receivedBytes: int
    provenance: dict[str, str | None] = Field(default_factory=make_parser_provenance)


def session_analytics_payload(parser: CombatLogParser) -> dict[str, dict]:
    return {str(k): v for k, v in parser.session_analytics.items()}


def _require_legacy_parser_routes() -> None:
    if not LEGACY_PARSER_ROUTES_ENABLED:
        raise HTTPException(404, "Not found")


# ── Routes ────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "pizza-logs-parser"}


@app.get("/ready")
async def ready() -> JSONResponse:
    """Storage readiness; busy upload admission remains a separate 429 signal."""
    try:
        usable = (UPLOAD_TEMP_DIR.is_dir()
                  and os.access(UPLOAD_TEMP_DIR, os.W_OK | os.X_OK)
                  and shutil.disk_usage(UPLOAD_TEMP_DIR).free >= MAX_COMPRESSED_BYTES)
    except OSError:
        usable = False
    return JSONResponse(
        {"status": "ready" if usable else "unavailable", "service": "pizza-logs-parser",
         "storage": "ok" if usable else "unavailable"},
        status_code=200 if usable else 503,
    )


@app.post("/parse", response_model=ParseResponse)
async def parse_log(
    file: UploadFile = File(...),
    year_hint: int   = Form(default=0),
) -> ParseResponse:
    """
    Parse a WoW combat log file.
    Accepts multipart/form-data with 'file' field.
    Streams to disk to avoid loading the entire file into memory.
    """
    _require_legacy_parser_routes()
    if file.filename and not file.filename.lower().endswith((".txt", ".log")):
        raise HTTPException(400, "Only .txt and .log files are supported")

    # Stream upload to a temp file while computing SHA-256 in chunks
    sha256 = hashlib.sha256()
    received_bytes = 0
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".txt", delete=False
        ) as tmp:
            tmp_path = tmp.name
            first_chunk: bytes = b""
            chunk_size = 8 * 1024 * 1024  # 8 MB chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                received_bytes += len(chunk)
                if received_bytes > MAX_COMPRESSED_BYTES:
                    raise HTTPException(413, "Upload exceeds the compressed-size limit.")
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except HTTPException:
        if tmp_path:
            os.unlink(tmp_path)
        raise
    except Exception as exc:
        logger.exception("Failed to receive legacy parser upload")
        if tmp_path:
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to receive uploaded file.") from exc

    file_hash = sha256.hexdigest()
    file_year = year_hint if year_hint > 2000 else _infer_year(first_chunk)

    warnings: list[str] = []
    try:
        parser = CombatLogParser(file_year=file_year)
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as fh:
            encounters_raw = parser.parse_file(fh)
    except Exception as exc:
        logger.exception("Legacy parser route failed")
        raise HTTPException(500, "Combat log parsing failed.") from exc
    finally:
        os.unlink(tmp_path)

    if parser.warnings:
        warnings.extend(parser.warnings)
    if not encounters_raw:
        warnings.append("No raid boss encounters were detected in this log.")

    encounters_out: list[EncounterOut] = []
    for enc in encounters_raw:
        encounters_out.append(EncounterOut(
            bossName         = enc.boss_name,
            bossId           = enc.boss_id,
            difficulty       = enc.difficulty,
            groupSize        = enc.group_size,
            outcome          = enc.outcome,
            durationSeconds  = enc.duration_seconds,
            durationMs       = round(enc.duration_seconds * 1000),
            startedAt        = enc.started_at,
            endedAt          = enc.ended_at,
            totalDamage      = enc.total_damage,
            totalHealing     = enc.total_healing,
            totalAbsorbs     = enc.total_absorbs,
            unattributedAbsorbs = enc.unattributed_absorbs,
            totalDamageTaken = enc.total_damage_taken,
            fingerprint      = enc.fingerprint,
            participants     = enc.participants,
            difficultyDetection = enc.difficulty_detection.as_dict(),
        ))

    return ParseResponse(
        filename      = file.filename or "WoWCombatLog.txt",
        fileHash      = file_hash,
        rawLineCount  = parser.raw_count,
        encounters    = encounters_out,
        warnings      = warnings,
        sessionDamage = {str(k): v for k, v in parser.session_damage.items()},
        sessionAnalytics = session_analytics_payload(parser),
        receivedBytes = received_bytes,
    )


# ── Debug parse endpoint ─────────────────────────────────────────

class DebugInfoOut(BaseModel):
    bossName: str
    difficultyMethod: str
    difficultyRaw: str
    difficultyFinal: str
    heroicMarkersFound: list[str]
    difficultyConfidence: str
    difficultyEvidence: list[str]
    difficultyReason: str
    detectorVersion: str
    outcomeMethod: str
    outcomeEvidence: str
    eventCount: int
    skippedEventCount: int
    petRemaps: list[str]
    actorCount: int
    bossGuidCount: int
    parserWarnings: list[str]


class DebugParseResponse(BaseModel):
    filename: str
    fileHash: str
    rawLineCount: int
    encounters: list[EncounterOut]
    warnings: list[str]
    sessionDamage: dict[str, float]
    sessionAnalytics: dict[str, dict]
    debugInfo: list[DebugInfoOut]
    receivedBytes: int
    provenance: dict[str, str | None] = Field(default_factory=make_parser_provenance)


@app.post("/parse-debug", response_model=DebugParseResponse)
async def parse_debug(
    file: UploadFile = File(...),
    year_hint: int = Form(default=0),
) -> DebugParseResponse:
    """Admin-only: parse and return per-encounter debug metadata.
    Not exposed in production UI."""
    _require_legacy_parser_routes()
    if file.filename and not file.filename.lower().endswith((".txt", ".log")):
        raise HTTPException(400, "Only .txt and .log files are supported")

    # Stream upload to a temp file while computing SHA-256 in chunks
    sha256 = hashlib.sha256()
    received_bytes = 0
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".txt", delete=False
        ) as tmp:
            tmp_path = tmp.name
            first_chunk: bytes = b""
            chunk_size = 8 * 1024 * 1024  # 8 MB chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                received_bytes += len(chunk)
                if received_bytes > MAX_COMPRESSED_BYTES:
                    raise HTTPException(413, "Upload exceeds the compressed-size limit.")
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except HTTPException:
        if tmp_path:
            os.unlink(tmp_path)
        raise
    except Exception as exc:
        logger.exception("Failed to receive legacy debug upload")
        if tmp_path:
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to receive uploaded file.") from exc

    file_hash = sha256.hexdigest()
    file_year = year_hint if year_hint > 2000 else _infer_year(first_chunk)

    warnings: list[str] = []
    try:
        # First pass: normal parse for encounters
        parser = CombatLogParser(file_year=file_year)
        with open(tmp_path, encoding="utf-8", errors="replace") as fh:
            encounters_raw = parser.parse_file(fh)

        # Second pass: debug pass to collect DebugInfo per segment
        parser2 = CombatLogParser(file_year=file_year)
        with open(tmp_path, encoding="utf-8", errors="replace") as fh2:
            lines_gen = parser2._iter_lines(fh2)
            segments, pet_owner = parser2._segment_encounters(lines_gen)
        debug_infos: list[DebugInfoOut] = []
        for seg in segments:
            result = parser2._aggregate_segment(seg, pet_owner, debug=True)
            if isinstance(result, tuple):
                _, dbg = result
                if dbg is not None:
                    debug_infos.append(DebugInfoOut(
                        bossName=dbg.boss_name,
                        difficultyMethod=dbg.difficulty_method,
                        difficultyRaw=dbg.difficulty_raw,
                        difficultyFinal=dbg.difficulty_final,
                        heroicMarkersFound=dbg.heroic_markers_found,
                        difficultyConfidence=dbg.difficulty_confidence,
                        difficultyEvidence=dbg.difficulty_evidence,
                        difficultyReason=dbg.difficulty_reason,
                        detectorVersion=dbg.detector_version,
                        outcomeMethod=dbg.outcome_method,
                        outcomeEvidence=dbg.outcome_evidence,
                        eventCount=dbg.event_count,
                        skippedEventCount=dbg.skipped_event_count,
                        petRemaps=dbg.pet_remaps,
                        actorCount=dbg.actor_count,
                        bossGuidCount=dbg.boss_guid_count,
                        parserWarnings=dbg.parser_warnings,
                    ))
    except Exception as exc:
        logger.exception("Legacy debug parser route failed")
        raise HTTPException(500, "Combat log parsing failed.") from exc
    finally:
        if tmp_path:
            os.unlink(tmp_path)

    if parser.warnings:
        warnings.extend(parser.warnings)
    if not encounters_raw:
        warnings.append("No raid boss encounters were detected in this log.")

    encounters_out: list[EncounterOut] = []
    for enc in encounters_raw:
        encounters_out.append(EncounterOut(
            bossName         = enc.boss_name,
            bossId           = enc.boss_id,
            difficulty       = enc.difficulty,
            groupSize        = enc.group_size,
            outcome          = enc.outcome,
            durationSeconds  = enc.duration_seconds,
            durationMs       = round(enc.duration_seconds * 1000),
            startedAt        = enc.started_at,
            endedAt          = enc.ended_at,
            totalDamage      = enc.total_damage,
            totalHealing     = enc.total_healing,
            totalAbsorbs     = enc.total_absorbs,
            unattributedAbsorbs = enc.unattributed_absorbs,
            totalDamageTaken = enc.total_damage_taken,
            fingerprint      = enc.fingerprint,
            participants     = enc.participants,
            difficultyDetection = enc.difficulty_detection.as_dict(),
        ))

    return DebugParseResponse(
        filename      = file.filename or "WoWCombatLog.txt",
        fileHash      = file_hash,
        rawLineCount  = parser.raw_count,
        encounters    = encounters_out,
        warnings      = warnings,
        sessionDamage = {str(k): v for k, v in parser.session_damage.items()},
        sessionAnalytics = session_analytics_payload(parser),
        debugInfo     = debug_infos,
        receivedBytes = received_bytes,
    )


# ── SSE streaming parse endpoint ─────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, allow_nan=False)}\n\n"


def _log_upload_event(event: str, upload_id: str, *, level: int = logging.INFO,
                      **fields: object) -> None:
    # Only explicit operational fields belong here: never filenames, raw log
    # lines, player names, exception messages or local paths.
    entry = json.dumps({"event": event, "uploadId": upload_id, **fields}, allow_nan=False, ensure_ascii=True)
    # Keep the single-line guarantee at the log sink as well as in JSON encoding.
    logger.log(level, entry.replace("\r", "\\r").replace("\n", "\\n"))

def _parse_msg(pct: int) -> str:
    if pct < 38: return "Parser reading combat events…"
    if pct < 52: return "Detecting boss encounters…"
    if pct < 68: return "Aggregating DPS and HPS…"
    if pct < 82: return "Building encounter data…"
    return "Finalising…"

def _enc_to_dict(enc: ParsedEncounter) -> dict:
    return dict(
        bossName         = enc.boss_name,
        bossId           = enc.boss_id,
        difficulty       = enc.difficulty,
        groupSize        = enc.group_size,
        outcome          = enc.outcome,
        durationSeconds  = enc.duration_seconds,
        durationMs       = round(enc.duration_seconds * 1000),
        startedAt        = enc.started_at,
        endedAt          = enc.ended_at,
        totalDamage      = enc.total_damage,
        totalHealing     = enc.total_healing,
        totalAbsorbs     = enc.total_absorbs,
        unattributedAbsorbs = enc.unattributed_absorbs,
        totalDamageTaken = enc.total_damage_taken,
        fingerprint      = enc.fingerprint,
        participants     = enc.participants,
        sessionIndex     = enc.session_index,
        difficultyDetection = enc.difficulty_detection.as_dict(),
    )


def _set_upload_state(upload_id: str, state: str, **extra: object) -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    with _upload_states_lock:
        current = _upload_states.get(upload_id, {"uploadId": upload_id, "createdAt": now})
        current.update({"state": state, "updatedAt": now, **extra})
        _upload_states[upload_id] = current
        return dict(current)


def _reserve_upload_state(upload_id: str, filename: str) -> bool:
    """Atomically reserve a client upload ID before receiving its body."""
    now = datetime.now(timezone.utc).isoformat()
    with _upload_states_lock:
        if upload_id in _upload_states:
            return False
        while len(_upload_states) >= UPLOAD_STATE_LIMIT:
            terminal = next((key for key, value in _upload_states.items()
                             if value.get("state") in {"complete", "error"}), None)
            if terminal is None:
                raise HTTPException(429, "Upload progress capacity is busy; retry shortly.")
            _upload_states.pop(terminal)
        _upload_states[upload_id] = {
            "uploadId": upload_id,
            "createdAt": now,
            "updatedAt": now,
            "state": "uploading",
            "filename": filename,
            "receivedBytes": 0,
        }
        return True


def _mark_interrupted_upload(upload_id: str) -> None:
    with _upload_states_lock:
        state = _upload_states.get(upload_id)
        if state is not None and state.get("state") not in {"complete", "error"}:
            state.update({"state": "error", "errorCode": "UPLOAD_CANCELLED",
                          "error": "Upload was cancelled.",
                          "updatedAt": datetime.now(timezone.utc).isoformat()})


def _cleanup_abandoned_uploads() -> None:
    cutoff = time.time() - UPLOAD_ABANDONED_SECONDS
    active_paths = active_upload_paths()
    for candidate in UPLOAD_TEMP_DIR.glob("*"):
        if candidate.suffix not in {".part", ".upload"} or candidate in active_paths:
            continue
        try:
            if candidate.stat().st_mtime < cutoff:
                candidate.unlink()
        except (FileNotFoundError, OSError):
            continue
    with _upload_states_lock:
        stale_ids = []
        for upload_id, state in _upload_states.items():
            updated = state.get("updatedAt")
            try:
                updated_ts = datetime.fromisoformat(str(updated)).timestamp()
            except (TypeError, ValueError):
                updated_ts = 0.0
            if updated_ts < cutoff:
                stale_ids.append(upload_id)
        for upload_id in stale_ids:
            _upload_states.pop(upload_id, None)


def _valid_upload_id(upload_id: str) -> bool:
    try:
        parsed = uuid.UUID(upload_id)
    except ValueError:
        return False
    return parsed.version == 4 and str(parsed) == upload_id


def _quick_classify_path(
    path: Path,
    selection: ArchiveSelection,
    file_year: int,
    cancel_event: threading.Event,
) -> list[dict[str, object]]:
    with open_combat_log(path, selection, cancel_event) as fh:
        return quick_classify(fh, cancel_event, file_year=file_year)


def _full_parse_path(
    path: Path,
    selection: ArchiveSelection,
    file_year: int,
    cancel_event: threading.Event,
) -> tuple[CombatLogParser, list[ParsedEncounter]]:
    parser = CombatLogParser(file_year=file_year)
    with open_combat_log(path, selection, cancel_event) as fh:
        encounters = parser.parse_file(fh, cancel_event=cancel_event)
    return parser, encounters


@app.get("/uploads/{upload_id}")
async def get_upload_state(upload_id: str) -> dict[str, object]:
    """Return the latest ephemeral processing state for one random upload ID."""
    if not _valid_upload_id(upload_id):
        raise HTTPException(400, "upload_id must be a lowercase UUIDv4")
    with _upload_states_lock:
        state = _upload_states.get(upload_id)
        if state is None:
            raise HTTPException(404, "Upload not found")
        return dict(state)


@app.post("/uploads/{upload_id}/stream")
async def upload_archive_stream(
    upload_id: str,
    request: Request,
    x_filename: str = Header(default="WoWCombatLog.txt"),
    x_year_hint: int = Header(default=0),
) -> StreamingResponse:
    """Receive one raw streamed upload, then emit quick and full SSE results.

    The client creates a random UUIDv4 before upload, so progress never keys on
    an IP address and multiple users behind NAT cannot collide.
    """
    if not _valid_upload_id(upload_id):
        raise HTTPException(400, "upload_id must be a lowercase UUIDv4")
    try:
        await asyncio.wait_for(_upload_slots.acquire(), timeout=0.01)
    except TimeoutError as exc:
        raise HTTPException(429, "Upload capacity is busy; retry shortly.") from exc

    try:
        _cleanup_abandoned_uploads()
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                declared_bytes = int(content_length)
                if declared_bytes < 0:
                    raise ValueError("negative length")
                if declared_bytes > MAX_COMPRESSED_BYTES:
                    raise HTTPException(413, "Upload exceeds the compressed-size limit.")
            except ValueError:
                raise HTTPException(400, "Invalid Content-Length header.")
        if not _reserve_upload_state(upload_id, Path(x_filename).name):
            raise HTTPException(409, "This upload ID is already in use.")
    except Exception:
        _upload_slots.release()
        raise

    # Never derive filesystem paths from request data. The client ID remains the
    # public progress key; an independent server-generated token names temp files.
    upload_file_token = uuid.uuid4().hex
    part_path = UPLOAD_TEMP_DIR / f"{upload_file_token}.part"
    final_path = UPLOAD_TEMP_DIR / f"{upload_file_token}.upload"
    lease = UploadLease(_upload_slots, part_path, final_path,
                        on_finish=lambda: _mark_interrupted_upload(upload_id))

    receive_started = time.perf_counter()
    final_byte_at = receive_started
    sha256 = hashlib.sha256()
    received_bytes = 0
    try:
        async with asyncio.timeout(UPLOAD_RECEIVE_TIMEOUT_SECONDS):
            with part_path.open("xb") as tmp:
                async for chunk in request.stream():
                    if not chunk:
                        continue
                    received_bytes += len(chunk)
                    if received_bytes > MAX_COMPRESSED_BYTES:
                        raise HTTPException(413, "Upload exceeds the compressed-size limit.")
                    sha256.update(chunk)
                    tmp.write(chunk)
                    _set_upload_state(upload_id, "uploading", receivedBytes=received_bytes)
                tmp.flush()
                os.fsync(tmp.fileno())
        final_byte_at = time.perf_counter()
        os.replace(part_path, final_path)
    except TimeoutError as exc:
        _set_upload_state(upload_id, "error", errorCode="UPLOAD_TIMEOUT", error="Upload receive timeout.")
        lease.finish()
        raise HTTPException(408, "Upload receive timeout.") from exc
    except asyncio.CancelledError:
        _set_upload_state(upload_id, "error", errorCode="UPLOAD_CANCELLED", error="Upload was cancelled.")
        lease.finish()
        raise
    except Exception as exc:
        _log_upload_event("upload_receive_error", upload_id, level=logging.ERROR,
                          exceptionType=type(exc).__name__)
        _set_upload_state(upload_id, "error", errorCode="UPLOAD_RECEIVE_ERROR", error="Upload receive failed.")
        lease.finish()
        raise

    upload_ms = round((final_byte_at - receive_started) * 1000, 2)
    file_hash = sha256.hexdigest()
    _set_upload_state(
        upload_id,
        "validating",
        receivedBytes=received_bytes,
        fileHash=file_hash,
        timings={"networkUploadMs": upload_ms},
    )

    async def archive_events() -> AsyncGenerator[str, None]:
        validation_ms = 0.0
        quick_ms = 0.0
        full_ms = 0.0
        file_year = x_year_hint if x_year_hint > 2000 else datetime.now(timezone.utc).year
        quick_cancel = lease.cancel_event
        full_cancel = lease.cancel_event
        try:
            yield _sse({"type": "state", "uploadId": upload_id, "state": "validating", "pct": 28, "msg": "Validating archive…"})
            validation_started = time.perf_counter()
            selection = await lease.run(
                _quick_executor, validate_upload, final_path, x_filename,
                lease.cancel_event, timeout=min(UPLOAD_PROCESSING_TIMEOUT_SECONDS, 60),
            )
            validation_ms = round((time.perf_counter() - validation_started) * 1000, 2)

            _set_upload_state(
                upload_id,
                "classifying",
                archive=selection.as_dict(),
                timings={"networkUploadMs": upload_ms, "archiveValidationMs": validation_ms},
            )
            yield _sse({"type": "state", "uploadId": upload_id, "state": "classifying", "pct": 36, "msg": "Classifying boss attempts…"})

            quick_started = time.perf_counter()
            try:
                quick_result = await lease.run(
                    _quick_executor, _quick_classify_path, final_path, selection, file_year, quick_cancel,
                    timeout=min(UPLOAD_PROCESSING_TIMEOUT_SECONDS, 60),
                )
            except asyncio.TimeoutError:
                quick_cancel.set()
                raise
            quick_ms = round((time.perf_counter() - quick_started) * 1000, 2)
            final_byte_to_quick_ms = round((time.perf_counter() - final_byte_at) * 1000, 2)
            timings = {
                "networkUploadMs": upload_ms,
                "archiveValidationMs": validation_ms,
                "quickClassificationMs": quick_ms,
                "finalByteToQuickResultMs": final_byte_to_quick_ms,
            }
            quick_payload = {"encounters": quick_result, "archive": selection.as_dict()}
            _set_upload_state(
                upload_id,
                "quick-result-ready",
                quickResult=quick_payload,
                timings=timings,
            )
            yield _sse({
                "type": "quick-result",
                "uploadId": upload_id,
                "state": "quick-result-ready",
                "pct": 45,
                "msg": f"Quick classification ready for {len(quick_result)} attempt(s).",
                "result": quick_payload,
                "timings": timings,
            })

            _set_upload_state(upload_id, "full-processing", quickResult=quick_payload, timings=timings)
            yield _sse({"type": "state", "uploadId": upload_id, "state": "full-processing", "pct": 52, "msg": "Building full reports…"})
            full_started = time.perf_counter()
            try:
                parser, encounters_raw = await lease.run(
                    _full_executor, _full_parse_path, final_path, selection,
                    file_year,
                    full_cancel,
                    timeout=UPLOAD_PROCESSING_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                full_cancel.set()
                raise
            full_ms = round((time.perf_counter() - full_started) * 1000, 2)
            timings["fullProcessingMs"] = full_ms

            encounters_out = [_enc_to_dict(enc) for enc in encounters_raw]
            warnings = list(parser.warnings)
            if not encounters_raw:
                warnings.append("No raid boss encounters were detected in this log.")
            _set_upload_state(
                upload_id,
                "complete",
                quickResult=quick_payload,
                timings=timings,
                encounterCount=len(encounters_out),
            )
            _log_upload_event("upload_complete", upload_id, receivedBytes=received_bytes,
                              encounterCount=len(encounters_out), timings=timings)
            yield _sse({
                "type": "done",
                "data": {
                    "filename": Path(x_filename).name,
                    "fileHash": file_hash,
                    "rawLineCount": parser.raw_count,
                    "encounters": encounters_out,
                    "warnings": warnings,
                    "sessionDamage": {str(k): v for k, v in parser.session_damage.items()},
                    "sessionAnalytics": session_analytics_payload(parser),
                    "uploadId": upload_id,
                    "receivedBytes": received_bytes,
                    "uploadTimings": timings,
                    "provenance": make_parser_provenance(),
                },
            })
        except ArchiveValidationError as exc:
            _log_upload_event("upload_rejected", upload_id, code=exc.code)
            _set_upload_state(upload_id, "error", errorCode=exc.code, error=exc.message)
            yield _sse({"type": "error", "uploadId": upload_id, "code": exc.code, "msg": exc.message})
        except asyncio.TimeoutError:
            _log_upload_event("upload_timeout", upload_id)
            _set_upload_state(upload_id, "error", errorCode="PROCESSING_TIMEOUT", error="Upload processing timed out.")
            yield _sse({"type": "error", "uploadId": upload_id, "code": "PROCESSING_TIMEOUT", "msg": "Upload processing timed out."})
        except (asyncio.CancelledError, GeneratorExit):
            # The web consumer closes its reader once it receives done. That
            # acknowledgement must not downgrade a completed parser result.
            _mark_interrupted_upload(upload_id)
            raise
        except Exception as exc:
            _log_upload_event("upload_processing_error", upload_id, level=logging.ERROR,
                              exceptionType=type(exc).__name__)
            _set_upload_state(upload_id, "error", errorCode="PROCESSING_ERROR", error="Upload processing failed.")
            yield _sse({"type": "error", "uploadId": upload_id, "code": "PROCESSING_ERROR", "msg": "Upload processing failed."})
        finally:
            lease.finish()

    return UploadStreamingResponse(
        archive_events(),
        lease=lease,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "X-Upload-ID": upload_id,
        },
    )


@app.post("/parse-stream")
async def parse_log_stream(
    file: UploadFile = File(...),
    year_hint: int   = Form(default=0),
) -> StreamingResponse:
    """
    Like /parse but streams SSE progress events while processing.
    Final event: {"type":"done","data":{...ParseResponse fields...}}

    IMPORTANT: We must write the file to disk BEFORE returning StreamingResponse.
    FastAPI closes UploadFile when the endpoint function returns, so the async
    generator cannot read from `file` after that point.
    """
    _require_legacy_parser_routes()
    if file.filename and not file.filename.lower().endswith((".txt", ".log")):
        raise HTTPException(400, "Only .txt and .log files are supported")

    # ── Write file to disk NOW (before returning StreamingResponse) ──
    sha256     = hashlib.sha256()
    first_chunk= b""
    received_bytes = 0
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".txt", delete=False) as tmp:
            tmp_path = tmp.name
            while True:
                chunk = await file.read(8 * 1024 * 1024)
                if not chunk:
                    break
                received_bytes += len(chunk)
                if received_bytes > MAX_COMPRESSED_BYTES:
                    raise HTTPException(413, "Upload exceeds the compressed-size limit.")
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except HTTPException:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    except Exception as exc:
        logger.exception("Failed to receive legacy streamed upload")
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to receive uploaded file.") from exc

    file_hash = sha256.hexdigest()
    file_year = year_hint if year_hint > 2000 else _infer_year(first_chunk)
    orig_filename = file.filename or "WoWCombatLog.txt"

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Optional[dict]] = asyncio.Queue()

    async def event_stream() -> AsyncGenerator[str, None]:

        # ── Phase 2: count lines (fast sequential scan) ───────────
        yield _sse({"type": "progress", "pct": 28, "msg": "Counting lines…"})
        try:
            with open(tmp_path, "r", encoding="utf-8", errors="replace") as fh:
                total_lines = sum(1 for _ in fh)
        except Exception:
            os.unlink(tmp_path)
            logger.exception("Legacy streamed upload line count failed")
            yield _sse({"type": "error", "code": "PROCESSING_ERROR", "msg": "Upload processing failed."})
            return

        yield _sse({"type": "progress", "pct": 33, "msg": "Parser reading combat events…"})

        # ── Phase 3: parse in thread executor ─────────────────────
        def do_parse() -> tuple[CombatLogParser, list[ParsedEncounter]]:
            def on_progress(lines_done: int, total: int) -> None:
                pct = 33 + int((lines_done / total) * 55) if total else 60
                asyncio.run_coroutine_threadsafe(
                    queue.put({"type": "progress", "pct": min(pct, 88), "msg": _parse_msg(pct)}),
                    loop,
                )
            parser = CombatLogParser(file_year=file_year)
            with open(tmp_path, "r", encoding="utf-8", errors="replace") as fh:  # type: ignore[arg-type]
                encounters = parser.parse_file(fh, total_lines=total_lines, progress_cb=on_progress)
            return parser, encounters

        parse_task = asyncio.ensure_future(loop.run_in_executor(None, do_parse))

        # Drain progress queue while task runs
        while not parse_task.done():
            await asyncio.sleep(0.15)
            while not queue.empty():
                yield _sse(queue.get_nowait())

        # Drain any remaining events
        while not queue.empty():
            yield _sse(queue.get_nowait())

        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

        # Get result (raises if parser threw)
        try:
            parser, encounters_raw = await parse_task
        except Exception:
            logger.exception("Legacy streamed upload parse failed")
            yield _sse({"type": "error", "code": "PROCESSING_ERROR", "msg": "Upload processing failed."})
            return

        yield _sse({"type": "progress", "pct": 90, "msg": "Building encounters…"})

        # ── Serialize ─────────────────────────────────────────────
        encounters_out = [_enc_to_dict(e) for e in encounters_raw]
        warnings: list[str] = list(parser.warnings)
        if not encounters_raw:
            warnings.append("No raid boss encounters were detected in this log.")

        yield _sse({
            "type": "done",
            "data": {
                "filename":      orig_filename,
                "fileHash":      file_hash,
                "rawLineCount":  parser.raw_count,
                "encounters":    encounters_out,
                "warnings":      warnings,
                "sessionDamage": {str(k): v for k, v in parser.session_damage.items()},
                "sessionAnalytics": session_analytics_payload(parser),
                "provenance": make_parser_provenance(),
                "receivedBytes": received_bytes,
            },
        })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache, no-transform",
            "X-Accel-Buffering":"no",   # disable nginx / Railway proxy buffering
        },
    )


# ── Helpers ────────────────────────────────────────────────────────

def _infer_year(content: bytes) -> int:
    """Try to extract the year from the first timestamp line."""
    for line in content[:4096].decode("utf-8", errors="replace").splitlines():
        # WotLK timestamp doesn't include year, use current year
        break
    return datetime.now(timezone.utc).year


# ── Entrypoint ────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    # Container ingress requires binding beyond loopback; host exposure is set by the platform.
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)  # nosec B104
