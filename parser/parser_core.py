"""
WoW combat log parser — stream-processes large files, extracts raid boss
encounters, aggregates DPS/HPS per player, produces encounter fingerprints.

Supports:
  - ENCOUNTER_START / ENCOUNTER_END events (modern WotLK private servers)
  - Heuristic name-based detection fallback
  - Both 3.3.5a and 3.x log formats
"""

from __future__ import annotations

import hashlib
import re
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Generator, Optional, TextIO

from bosses import BossDef, lookup_boss, lookup_boss_by_id

# ── Constants ─────────────────────────────────────────────────────

DMG_EVENTS = {
    "SPELL_DAMAGE",
    "SWING_DAMAGE",
    "RANGE_DAMAGE",
    "SPELL_PERIODIC_DAMAGE",
    "DAMAGE_SHIELD",
    "SPELL_BUILDING_DAMAGE",
}

HEAL_EVENTS = {
    "SPELL_HEAL",
    "SPELL_PERIODIC_HEAL",
    "SPELL_HEAL_ABSORBED",
}

UNIT_DIED_EVENT = "UNIT_DIED"
ENCOUNTER_START  = "ENCOUNTER_START"
ENCOUNTER_END    = "ENCOUNTER_END"

# GUID prefix for player characters (0x0000000000 prefix bits)
PLAYER_GUID_RE = re.compile(r"^Player-", re.I)

# Gap in seconds that signals a new encounter when no ENCOUNTER events present
ENCOUNTER_GAP_SECONDS = 30

# Minimum events to treat a fight segment as a real encounter
MIN_ENCOUNTER_EVENTS = 10

# Timestamp regex: "M/D HH:MM:SS.mmm"
TS_RE = re.compile(
    r"^(\d{1,2})/(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})"
)


# ── Data classes ──────────────────────────────────────────────────

@dataclass
class SpellStats:
    damage:  float = 0.0
    healing: float = 0.0
    hits:    int   = 0
    crits:   int   = 0
    school:  int   = 1


@dataclass
class ActorStats:
    name:         str
    guids:        set[str]  = field(default_factory=set)
    wow_class:    Optional[str] = None
    total_damage: float = 0.0
    total_healing:float = 0.0
    damage_taken: float = 0.0
    deaths:       int   = 0
    hit_count:    int   = 0
    crit_count:   int   = 0
    spells:       dict[str, SpellStats] = field(default_factory=dict)


@dataclass
class RawEncounterEvent:
    ts:        float   # seconds since midnight
    event:     str
    src_name:  str
    src_guid:  str
    dst_name:  str
    dst_guid:  str
    spell_name:str
    school:    int
    amount:    float
    overkill:  float
    is_crit:   bool
    is_heal:   bool


@dataclass
class ParsedEncounter:
    boss_name:         str
    boss_def:          Optional[BossDef]
    boss_id:           Optional[int]
    difficulty:        str
    group_size:        int
    outcome:           str    # KILL | WIPE | UNKNOWN
    duration_seconds:  int
    started_at:        str    # ISO-8601 UTC
    ended_at:          str
    total_damage:      float
    total_healing:     float
    total_damage_taken:float
    fingerprint:       str
    participants:      list[dict]
    raw_event_count:   int


# ── CSV line splitter ──────────────────────────────────────────────

def csv_split(s: str) -> list[str]:
    """Split a WoW log CSV line, honouring quoted strings."""
    out: list[str] = []
    cur: list[str] = []
    in_q = False
    for ch in s:
        if ch == '"':
            in_q = not in_q
        elif ch == ',' and not in_q:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return out


# ── Timestamp parser ───────────────────────────────────────────────

def parse_ts(ts_str: str) -> float:
    """Return seconds-since-midnight float from 'M/D HH:MM:SS.mmm'."""
    m = TS_RE.match(ts_str.strip())
    if not m:
        return 0.0
    h, mn, s, ms = int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6))
    return h * 3600 + mn * 60 + s + ms / 1000.0


def parse_ts_to_iso(ts_str: str, year_hint: int = 2024) -> str:
    """Return an ISO timestamp string. Year is inferred from context (file mtime)."""
    m = TS_RE.match(ts_str.strip())
    if not m:
        return datetime.now(timezone.utc).isoformat()
    mo, day = int(m.group(1)), int(m.group(2))
    h, mn, s, ms = int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6))
    try:
        dt = datetime(year_hint, mo, day, h, mn, s, ms * 1000, tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


# ── Main parser class ──────────────────────────────────────────────

class CombatLogParser:
    def __init__(self, file_year: int = 2024):
        self.file_year   = file_year
        self.raw_count   = 0
        self.warnings: list[str] = []

    def parse_file(self, fh: TextIO) -> list[ParsedEncounter]:
        """Main entry point — returns list of raid boss encounters."""
        lines = self._iter_lines(fh)
        segments = self._segment_encounters(lines)
        encounters: list[ParsedEncounter] = []
        for seg in segments:
            enc = self._aggregate_segment(seg)
            if enc:
                encounters.append(enc)
        return encounters

    # ── Internal: line iteration ─────────────────────────────────

    def _iter_lines(self, fh: TextIO) -> Generator[tuple[str, list[str], float], None, None]:
        """Yield (raw_ts_str, parts, ts_float) for every parseable line."""
        for raw_line in fh:
            self.raw_count += 1
            line = raw_line.strip()
            if not line:
                continue
            # Split timestamp from the rest
            space_idx = line.find("  ")
            if space_idx == -1:
                continue
            ts_str = line[:space_idx].strip()
            rest   = line[space_idx + 2:]
            try:
                parts = csv_split(rest)
            except Exception:
                continue
            if len(parts) < 2:
                continue
            ts = parse_ts(ts_str)
            yield ts_str, parts, ts

    # ── Internal: segmentation ───────────────────────────────────

    def _segment_encounters(
        self, lines: Generator[tuple[str, list[str], float], None, None]
    ) -> list[list[tuple[str, list[str], float]]]:
        """
        Group lines into encounter segments.

        Strategy (priority order):
          1. ENCOUNTER_START / ENCOUNTER_END events
          2. Heuristic: known boss name appears in dst_name + gap detection
        """
        segments: list[list[tuple[str, list[str], float]]] = []

        # ── Path A: ENCOUNTER_START/END present ─────────────────
        # We do a quick scan first to see if the file has these events.
        # If yes, we use them exclusively. If not, we fall back to heuristic.
        # Because the file can be huge, we do a single-pass approach that
        # buffers the current encounter.

        current_segment: list[tuple[str, list[str], float]] = []
        in_encounter = False
        has_encounter_events = False
        heuristic_boss: Optional[BossDef] = None
        last_ts: float = 0.0

        for ts_str, parts, ts in lines:
            event = parts[0]

            # ── ENCOUNTER_START ──────────────────────────────────
            if event == ENCOUNTER_START:
                has_encounter_events = True
                in_encounter = True
                current_segment = [(ts_str, parts, ts)]
                continue

            # ── ENCOUNTER_END ────────────────────────────────────
            if event == ENCOUNTER_END:
                has_encounter_events = True
                if current_segment:
                    current_segment.append((ts_str, parts, ts))
                    if len(current_segment) >= MIN_ENCOUNTER_EVENTS:
                        segments.append(current_segment)
                current_segment = []
                in_encounter = False
                continue

            # ── Damage / Heal events ─────────────────────────────
            if event in DMG_EVENTS or event in HEAL_EVENTS or event == UNIT_DIED_EVENT:
                if in_encounter or (not has_encounter_events and self._is_boss_event(parts)):
                    # Gap detection (heuristic path only)
                    if not has_encounter_events and current_segment:
                        gap = ts - last_ts
                        if gap > ENCOUNTER_GAP_SECONDS:
                            if len(current_segment) >= MIN_ENCOUNTER_EVENTS:
                                segments.append(current_segment)
                            current_segment = []
                            heuristic_boss = None
                    current_segment.append((ts_str, parts, ts))
                    last_ts = ts

                    # Start heuristic encounter if not in one
                    if not has_encounter_events and not current_segment[:-1]:
                        heuristic_boss = self._detect_boss_from_parts(parts)

        # Flush trailing segment
        if current_segment and len(current_segment) >= MIN_ENCOUNTER_EVENTS:
            segments.append(current_segment)

        return segments

    def _is_boss_event(self, parts: list[str]) -> bool:
        """Quick check: does this event involve a known boss?"""
        # dst_name is usually index 5 for SPELL_DAMAGE, 5 for SWING_DAMAGE
        if len(parts) < 6:
            return False
        dst = parts[5].strip('"').strip()
        src = parts[2].strip('"').strip()
        return dst.lower() in self._boss_names or src.lower() in self._boss_names

    @property
    def _boss_names(self) -> set[str]:
        from bosses import ALL_BOSS_NAMES
        return ALL_BOSS_NAMES

    def _detect_boss_from_parts(self, parts: list[str]) -> Optional[BossDef]:
        if len(parts) < 6:
            return None
        for name_field in (parts[5], parts[2]):
            name = name_field.strip('"').strip()
            boss = lookup_boss(name)
            if boss:
                return boss
        return None

    # ── Internal: aggregation ────────────────────────────────────

    def _aggregate_segment(
        self, segment: list[tuple[str, list[str], float]]
    ) -> Optional[ParsedEncounter]:
        """Turn a list of raw log lines into a ParsedEncounter."""
        if not segment:
            return None

        # Determine boss from ENCOUNTER_START if present
        boss_name: Optional[str] = None
        boss_id:   Optional[int] = None
        difficulty = "10N"
        group_size = 10
        outcome    = "UNKNOWN"
        first_ts_str = segment[0][0]
        last_ts_str  = segment[-1][0]

        # Check for ENCOUNTER_START / ENCOUNTER_END markers
        for ts_str, parts, ts in segment:
            if parts[0] == ENCOUNTER_START and len(parts) >= 5:
                boss_id   = _safe_int(parts[1])
                boss_name = parts[2].strip('"').strip()
                diff_id   = _safe_int(parts[3])
                group_size = _safe_int(parts[4]) or 10
                difficulty = _decode_difficulty(diff_id, group_size)
                first_ts_str = ts_str
            elif parts[0] == ENCOUNTER_END and len(parts) >= 6:
                success   = _safe_int(parts[5])
                outcome   = "KILL" if success == 1 else "WIPE"
                last_ts_str = ts_str

        # Heuristic boss detection if no ENCOUNTER_START
        if not boss_name:
            boss_name, boss_id = self._infer_boss(segment)
            group_size, difficulty = self._infer_difficulty(segment)
            outcome = self._infer_outcome(segment, boss_name)

        if not boss_name:
            return None  # Cannot identify boss — skip

        boss_def = (lookup_boss_by_id(boss_id) if boss_id else None) or lookup_boss(boss_name)

        # Aggregate actors
        actors: dict[str, ActorStats] = {}
        targets_hit: set[str] = set()

        for ts_str, parts, ts in segment:
            event = parts[0]
            if event in (ENCOUNTER_START, ENCOUNTER_END):
                continue

            if event == UNIT_DIED_EVENT:
                if len(parts) >= 6:
                    dead_name = parts[5].strip('"').strip()
                    if dead_name in actors:
                        actors[dead_name].deaths += 1
                continue

            is_heal = event in HEAL_EVENTS

            # Parse SWING_DAMAGE (no spell fields)
            if event == "SWING_DAMAGE":
                if len(parts) < 14:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                amount   = _safe_float(parts[7])
                overkill = _safe_float(parts[8])
                school   = _safe_int(parts[9]) or 1
                is_crit  = parts[13] == "1"
                spell_name = "Auto Attack"
            elif is_heal:
                # SPELL_HEAL: ...spellID,spellName,spellSchool,amount,overhealing,absorbed,critical
                if len(parts) < 15:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                spell_name = parts[8].strip('"').strip()
                school     = _safe_int(parts[9]) or 2
                amount     = _safe_float(parts[10])
                overkill   = 0.0
                is_crit    = len(parts) > 14 and parts[14] == "1"
            else:
                # SPELL_DAMAGE / SPELL_PERIODIC_DAMAGE / RANGE_DAMAGE etc.
                if len(parts) < 15:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                spell_name = parts[8].strip('"').strip()
                school     = _safe_int(parts[9]) or 1
                amount     = _safe_float(parts[10])
                overkill   = _safe_float(parts[11])
                is_crit    = len(parts) > 17 and parts[17] == "1"

            if amount <= 0:
                continue

            # Only count player sources as DPS/HPS
            if not _is_player(src_guid):
                # Track damage taken by players from boss
                if _is_player(dst_guid) and dst_name:
                    a = _get_actor(actors, dst_name, dst_guid)
                    a.damage_taken += amount
                continue

            if not src_name:
                continue

            a = _get_actor(actors, src_name, src_guid)
            ss = a.spells.setdefault(spell_name, SpellStats(school=school))

            if is_heal:
                a.total_healing += amount
                ss.healing += amount
            else:
                a.total_damage += amount
                ss.damage += amount
                targets_hit.add(dst_name)

            ss.hits  += 1
            ss.crits += int(is_crit)
            a.hit_count  += 1
            a.crit_count += int(is_crit)

        # Duration
        start_ts = parse_ts(first_ts_str)
        end_ts   = parse_ts(last_ts_str)
        # Handle midnight rollover
        if end_ts < start_ts:
            end_ts += 86400
        duration = max(1, int(end_ts - start_ts))

        # Build participant list
        participants = []
        for actor in actors.values():
            dps = actor.total_damage / duration
            hps = actor.total_healing / duration
            crit_pct = (actor.crit_count / actor.hit_count * 100) if actor.hit_count else 0.0
            spell_breakdown = {
                name: {
                    "damage":  s.damage,
                    "healing": s.healing,
                    "hits":    s.hits,
                    "crits":   s.crits,
                    "school":  s.school,
                }
                for name, s in actor.spells.items()
            }
            participants.append({
                "name":           actor.name,
                "class":          actor.wow_class,
                "totalDamage":    actor.total_damage,
                "totalHealing":   actor.total_healing,
                "damageTaken":    actor.damage_taken,
                "dps":            round(dps, 2),
                "hps":            round(hps, 2),
                "deaths":         actor.deaths,
                "critPct":        round(crit_pct, 1),
                "spellBreakdown": spell_breakdown,
            })

        total_damage  = sum(a.total_damage  for a in actors.values())
        total_healing = sum(a.total_healing for a in actors.values())
        total_taken   = sum(a.damage_taken  for a in actors.values())

        started_at = parse_ts_to_iso(first_ts_str, self.file_year)
        ended_at   = parse_ts_to_iso(last_ts_str,  self.file_year)

        fingerprint = _fingerprint(
            boss_name    = boss_def.name if boss_def else boss_name,
            difficulty   = difficulty,
            started_at   = started_at,
            participants = [p["name"] for p in participants],
        )

        return ParsedEncounter(
            boss_name         = boss_def.name if boss_def else boss_name,
            boss_def          = boss_def,
            boss_id           = boss_id,
            difficulty        = difficulty,
            group_size        = group_size,
            outcome           = outcome,
            duration_seconds  = duration,
            started_at        = started_at,
            ended_at          = ended_at,
            total_damage      = total_damage,
            total_healing     = total_healing,
            total_damage_taken= total_taken,
            fingerprint       = fingerprint,
            participants      = participants,
            raw_event_count   = len(segment),
        )

    def _infer_boss(
        self, segment: list[tuple[str, list[str], float]]
    ) -> tuple[Optional[str], Optional[int]]:
        """Count boss name occurrences in dst_name / src_name fields."""
        counts: dict[str, int] = {}
        for _, parts, _ in segment:
            if parts[0] in (UNIT_DIED_EVENT,):
                continue
            for idx in (2, 5):
                if len(parts) > idx:
                    name = parts[idx].strip('"').strip()
                    if name.lower() in self._boss_names:
                        counts[name] = counts.get(name, 0) + 1
        if not counts:
            return None, None
        boss_name = max(counts, key=lambda k: counts[k])
        boss_def  = lookup_boss(boss_name)
        return (boss_def.name if boss_def else boss_name), (boss_def.wow_boss_id if boss_def else None)

    def _infer_difficulty(
        self, segment: list[tuple[str, list[str], float]]
    ) -> tuple[int, str]:
        """Estimate group size from unique player GUIDs."""
        players: set[str] = set()
        for _, parts, _ in segment:
            if len(parts) > 1 and _is_player(parts[1]):
                players.add(parts[1])
        n = len(players)
        if n <= 12:
            return 10, "10N"
        return 25, "25N"

    def _infer_outcome(
        self, segment: list[tuple[str, list[str], float]], boss_name: Optional[str]
    ) -> str:
        """Heuristic: boss died = KILL, else WIPE."""
        if not boss_name:
            return "UNKNOWN"
        bn = boss_name.lower()
        for _, parts, _ in segment:
            if parts[0] == UNIT_DIED_EVENT and len(parts) >= 6:
                name = parts[5].strip('"').strip().lower()
                if name == bn or name in self._boss_names:
                    return "KILL"
        return "WIPE"


# ── Helpers ────────────────────────────────────────────────────────

def _safe_int(s: str) -> int:
    try:
        return int(s.strip(), 0)
    except (ValueError, TypeError):
        return 0


def _safe_float(s: str) -> float:
    try:
        v = float(s.strip())
        return max(0.0, v)
    except (ValueError, TypeError):
        return 0.0


def _is_player(guid: str) -> bool:
    """Player GUIDs start with 0x0 or 'Player-' depending on server."""
    if not guid:
        return False
    g = guid.upper()
    # Classic/WotLK format: 0x0000000000000000 where type nibble = 0x4 (player)
    if g.startswith("0X"):
        # Check creature type bits — players have type 0x4xx... or 0x000...
        # Actually simplest: non-zero, non-creature prefix
        # Type is bits 52-55 of the GUID. In hex: position 3-4 of the 16-char hex.
        # 0x0000000000000000 — if all zeros, skip
        if g == "0X0000000000000000" or g == "0XNIL":
            return False
        # type nibble at position 4 (0-indexed after '0x')
        hex_part = g[2:]  # 16 hex chars
        if len(hex_part) >= 4:
            type_nibble = int(hex_part[3], 16) if hex_part[3] in "0123456789ABCDEF" else 0
            # Player = 0x4, Pet = 0x5, NPC = 0x3
            return type_nibble == 4
        return True  # assume player if we can't tell
    if g.startswith("PLAYER-"):
        return True
    return False


def _get_actor(actors: dict[str, ActorStats], name: str, guid: str) -> ActorStats:
    if name not in actors:
        actors[name] = ActorStats(name=name, guids={guid})
    else:
        actors[name].guids.add(guid)
    return actors[name]


def _decode_difficulty(diff_id: int, group_size: int) -> str:
    """Map WoW difficultyID to our label."""
    # WotLK: 3=10N, 4=25N, 5=10H, 6=25H
    mapping = {3: "10N", 4: "25N", 5: "10H", 6: "25H"}
    if diff_id in mapping:
        return mapping[diff_id]
    # Fallback by group size
    return "25N" if group_size >= 20 else "10N"


def _fingerprint(
    boss_name: str, difficulty: str, started_at: str, participants: list[str]
) -> str:
    """
    Deterministic SHA-256 fingerprint for deduplication.
    Uses boss name + difficulty + ISO week + sorted participant names.
    """
    # Round to nearest minute to tolerate small time offsets
    try:
        dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        # Truncate to nearest 5 minutes
        minute_block = (dt.hour * 60 + dt.minute) // 5
        week = dt.isocalendar()
        time_key = f"{week[0]}-W{week[1]}-{week[2]}-{minute_block}"
    except Exception:
        time_key = started_at[:16]

    sorted_names = "|".join(sorted(participants[:25]))  # top 25 is enough
    raw = f"{boss_name.lower()}|{difficulty}|{time_key}|{sorted_names}"
    return hashlib.sha256(raw.encode()).hexdigest()
