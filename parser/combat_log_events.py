"""Combat-log line tokenizing helpers.

This module is intentionally small: it knows how to split one raw
WoWCombatLog.txt line into timestamp, CSV parts, and seconds since midnight.
Encounter policy stays in parser_core.py.
"""

from __future__ import annotations

import csv as _csv
import io
import re
from dataclasses import dataclass
from typing import Optional


TS_RE = re.compile(
    r"^(\d{1,2})/(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})"
)


@dataclass(frozen=True)
class CombatLogLine:
    ts_str: str
    parts: list[str]
    ts: float


@dataclass(frozen=True)
class ParsedLineResult:
    line: Optional[CombatLogLine]
    skip_reason: Optional[str] = None


def csv_split(s: str) -> list[str]:
    reader = _csv.reader(io.StringIO(s), skipinitialspace=True)
    return [x.strip() for x in next(reader)]


def parse_ts(ts_str: str) -> float:
    m = TS_RE.match(ts_str)
    if not m:
        return 0.0
    _, _, hh, mm, ss, ms = m.groups()
    return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000


def parse_combat_log_line(raw_line: str) -> ParsedLineResult:
    line = raw_line.strip()
    if not line:
        return ParsedLineResult(None, "blank")

    space_idx = line.find("  ")
    if space_idx == -1:
        return ParsedLineResult(None, "missing_timestamp_separator")

    ts_str = line[:space_idx].strip()
    rest = line[space_idx + 2:]
    try:
        parts = csv_split(rest)
    except Exception:
        return ParsedLineResult(None, "malformed_csv")

    if len(parts) < 2:
        return ParsedLineResult(None, "too_few_fields")

    return ParsedLineResult(CombatLogLine(ts_str=ts_str, parts=parts, ts=parse_ts(ts_str)))
