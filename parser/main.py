"""
Pizza Logs — Python Parser Service
FastAPI app that accepts WoW combat log files and returns structured encounter data.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from parser_core import CombatLogParser, ParsedEncounter, DebugInfo
from bosses import lookup_boss, lookup_boss_by_id

# ── App setup ─────────────────────────────────────────────────────

app = FastAPI(
    title="Pizza Logs Parser",
    description="WoW combat log parsing service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Response models ───────────────────────────────────────────────

class SpellBreakdownEntry(BaseModel):
    damage:  float
    healing: float
    hits:    int
    crits:   int
    school:  int


class ParticipantOut(BaseModel):
    name:           str
    class_:         Optional[str] = None
    totalDamage:    float
    totalHealing:   float
    damageTaken:    float
    dps:            float
    hps:            float
    deaths:         int
    critPct:        float
    spellBreakdown: dict[str, SpellBreakdownEntry] = {}

    class Config:
        populate_by_name = True


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
    totalDamageTaken: float
    fingerprint:      str
    participants:     list[dict]


class ParseResponse(BaseModel):
    filename:      str
    fileHash:      str
    rawLineCount:  int
    encounters:    list[EncounterOut]
    warnings:      list[str] = []
    sessionDamage: dict[str, float] = {}


# ── Routes ────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "pizza-logs-parser"}


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
    if file.filename and not file.filename.lower().endswith((".txt", ".log")):
        raise HTTPException(400, "Only .txt and .log files are supported")

    # Stream upload to a temp file while computing SHA-256 in chunks
    sha256 = hashlib.sha256()
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
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except Exception as exc:
        if tmp_path:
            os.unlink(tmp_path)
        raise HTTPException(500, f"Failed to read uploaded file: {exc}") from exc

    file_hash = sha256.hexdigest()
    file_year = year_hint if year_hint > 2000 else _infer_year(first_chunk)

    warnings: list[str] = []
    try:
        parser = CombatLogParser(file_year=file_year)
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as fh:
            encounters_raw = parser.parse_file(fh)
    except Exception as exc:
        raise HTTPException(500, f"Parse error: {exc}") from exc
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
            totalDamageTaken = enc.total_damage_taken,
            fingerprint      = enc.fingerprint,
            participants     = enc.participants,
        ))

    return ParseResponse(
        filename      = file.filename or "WoWCombatLog.txt",
        fileHash      = file_hash,
        rawLineCount  = parser.raw_count,
        encounters    = encounters_out,
        warnings      = warnings,
        sessionDamage = {str(k): v for k, v in parser.session_damage.items()},
    )


@app.post("/parse-path")
async def parse_log_by_path(body: dict) -> ParseResponse:
    """
    Parse a log file already on disk (used when the Next.js app has saved
    the file locally and wants to avoid re-uploading it over HTTP).
    """
    path = body.get("path")
    year_hint = int(body.get("year_hint", 0))
    if not path or not Path(path).exists():
        raise HTTPException(404, "File not found")

    p = Path(path)
    content_bytes = p.read_bytes()
    file_hash = hashlib.sha256(content_bytes).hexdigest()
    file_year = year_hint if year_hint > 2000 else _infer_year(content_bytes)

    text = content_bytes.decode("utf-8", errors="replace")
    parser = CombatLogParser(file_year=file_year)
    fh = io.StringIO(text)
    encounters_raw = parser.parse_file(fh)

    encounters_out = [
        EncounterOut(
            bossName         = e.boss_name,
            bossId           = e.boss_id,
            difficulty       = e.difficulty,
            groupSize        = e.group_size,
            outcome          = e.outcome,
            durationSeconds  = e.duration_seconds,
            durationMs       = round(e.duration_seconds * 1000),
            startedAt        = e.started_at,
            endedAt          = e.ended_at,
            totalDamage      = e.total_damage,
            totalHealing     = e.total_healing,
            totalDamageTaken = e.total_damage_taken,
            fingerprint      = e.fingerprint,
            participants     = e.participants,
        )
        for e in encounters_raw
    ]

    return ParseResponse(
        filename      = p.name,
        fileHash      = file_hash,
        rawLineCount  = parser.raw_count,
        encounters    = encounters_out,
        warnings      = parser.warnings,
        sessionDamage = {str(k): v for k, v in parser.session_damage.items()},
    )


# ── Debug parse endpoint ─────────────────────────────────────────

class DebugInfoOut(BaseModel):
    bossName: str
    difficultyMethod: str
    difficultyRaw: str
    difficultyFinal: str
    heroicMarkersFound: list[str]
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
    debugInfo: list[DebugInfoOut]


@app.post("/parse-debug", response_model=DebugParseResponse)
async def parse_debug(
    file: UploadFile = File(...),
    year_hint: int = Form(default=0),
) -> DebugParseResponse:
    """Admin-only: parse and return per-encounter debug metadata.
    Not exposed in production UI."""
    if file.filename and not file.filename.lower().endswith((".txt", ".log")):
        raise HTTPException(400, "Only .txt and .log files are supported")

    # Stream upload to a temp file while computing SHA-256 in chunks
    sha256 = hashlib.sha256()
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
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except Exception as exc:
        if tmp_path:
            os.unlink(tmp_path)
        raise HTTPException(500, f"Failed to read uploaded file: {exc}") from exc

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
        raise HTTPException(500, f"Parse error: {exc}") from exc
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
            totalDamageTaken = enc.total_damage_taken,
            fingerprint      = enc.fingerprint,
            participants     = enc.participants,
        ))

    return DebugParseResponse(
        filename      = file.filename or "WoWCombatLog.txt",
        fileHash      = file_hash,
        rawLineCount  = parser.raw_count,
        encounters    = encounters_out,
        warnings      = warnings,
        sessionDamage = {str(k): v for k, v in parser.session_damage.items()},
        debugInfo     = debug_infos,
    )


# ── SSE streaming parse endpoint ─────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

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
        totalDamageTaken = enc.total_damage_taken,
        fingerprint      = enc.fingerprint,
        participants     = enc.participants,
        sessionIndex     = enc.session_index,
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
    # ── Write file to disk NOW (before returning StreamingResponse) ──
    sha256     = hashlib.sha256()
    first_chunk= b""
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".txt", delete=False) as tmp:
            tmp_path = tmp.name
            while True:
                chunk = await file.read(8 * 1024 * 1024)
                if not chunk:
                    break
                sha256.update(chunk)
                if not first_chunk:
                    first_chunk = chunk[:4096]
                tmp.write(chunk)
    except Exception as exc:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(500, f"Failed to receive file: {exc}") from exc

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
        except Exception as exc:
            os.unlink(tmp_path)
            yield _sse({"type": "error", "msg": f"Line count failed: {exc}"})
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
        except Exception as exc:
            yield _sse({"type": "error", "msg": f"Parse error: {exc}"})
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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
