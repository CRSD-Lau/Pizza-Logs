"""
Pizza Logs — Python Parser Service
FastAPI app that accepts WoW combat log files and returns structured encounter data.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from parser_core import CombatLogParser, ParsedEncounter
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
    startedAt:        str
    endedAt:          str
    totalDamage:      float
    totalHealing:     float
    totalDamageTaken: float
    fingerprint:      str
    participants:     list[dict]


class ParseResponse(BaseModel):
    filename:     str
    fileHash:     str
    rawLineCount: int
    encounters:   list[EncounterOut]
    warnings:     list[str] = []


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
            startedAt        = enc.started_at,
            endedAt          = enc.ended_at,
            totalDamage      = enc.total_damage,
            totalHealing     = enc.total_healing,
            totalDamageTaken = enc.total_damage_taken,
            fingerprint      = enc.fingerprint,
            participants     = enc.participants,
        ))

    return ParseResponse(
        filename     = file.filename or "WoWCombatLog.txt",
        fileHash     = file_hash,
        rawLineCount = parser.raw_count,
        encounters   = encounters_out,
        warnings     = warnings,
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
        filename     = p.name,
        fileHash     = file_hash,
        rawLineCount = parser.raw_count,
        encounters   = encounters_out,
        warnings     = parser.warnings,
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
