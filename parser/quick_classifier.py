"""Low-latency encounter segmentation and difficulty-only classification."""

from __future__ import annotations

import re
from typing import Iterator, TextIO

from bosses import ALL_BOSS_NAMES, lookup_boss, lookup_boss_by_id
from combat_log_events import parse_combat_log_line
from difficulty_detector import (
    DIFFICULTY_SPELLS,
    FREYA_ELDER_MARKERS,
    MIMIRON_HARD_MARKER,
    SIZE_SCOPED_HEROIC_MARKERS,
    VEZAX_HARD_MARKER,
    YOGG_KEEPER_BUFFS,
    detect_difficulty,
)


ENCOUNTER_START = "ENCOUNTER_START"
ENCOUNTER_END = "ENCOUNTER_END"
UNIT_DIED = "UNIT_DIED"
ACTIVE_EVENTS = {
    "SPELL_DAMAGE", "SWING_DAMAGE", "RANGE_DAMAGE", "SPELL_PERIODIC_DAMAGE",
    "DAMAGE_SHIELD", "DAMAGE_SPLIT", "SPELL_BUILDING_DAMAGE",
    "SPELL_HEAL", "SPELL_PERIODIC_HEAL", UNIT_DIED,
}
ENCOUNTER_GAP_SECONDS = 30.0
_RELEVANT_IDS = {
    spell_id
    for modes in DIFFICULTY_SPELLS.values()
    for spell_ids in modes.values()
    for spell_id in spell_ids
} | {
    spell_id for markers in FREYA_ELDER_MARKERS.values() for spell_id in markers
} | set(YOGG_KEEPER_BUFFS) | {MIMIRON_HARD_MARKER, VEZAX_HARD_MARKER} | {
    spell_id for markers in SIZE_SCOPED_HEROIC_MARKERS.values() for spell_id in markers
}
_RELEVANT_ID_RE = re.compile(r",(?:" + "|".join(str(value) for value in sorted(_RELEVANT_IDS)) + r"),")


def _int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _decode_marker(diff_id: int) -> str | None:
    return {3: "10N", 4: "25N", 5: "10H", 6: "25H"}.get(diff_id)


def _is_boss_event(parts: list[str]) -> bool:
    for idx in (2, 5):
        if len(parts) > idx and parts[idx].strip('"').strip().lower() in ALL_BOSS_NAMES:
            return True
    return False


def _infer_boss(segment: list[tuple[str, list[str], float]]) -> str | None:
    counts: dict[str, int] = {}
    for _, parts, _ in segment:
        for idx in (2, 5):
            if len(parts) <= idx:
                continue
            candidate = parts[idx].strip('"').strip()
            boss = lookup_boss(candidate)
            if boss:
                counts[boss.name] = counts.get(boss.name, 0) + 1
    return max(counts, key=counts.get) if counts else None


def iter_encounter_segments(fh: TextIO, cancel_event=None) -> Iterator[list[tuple[str, list[str], float]]]:
    """Yield one bounded encounter at a time from a combat-log text stream."""
    current: list[tuple[str, list[str], float]] = []
    has_markers = False
    in_marker_encounter = False
    heuristic_active = False
    last_boss_ts = 0.0

    for line_number, raw_line in enumerate(fh, start=1):
        if cancel_event is not None and line_number % 4096 == 0 and cancel_event.is_set():
            raise TimeoutError("Quick classification was cancelled after the processing timeout")
        parsed = parse_combat_log_line(raw_line)
        if parsed.line is None:
            continue
        item = (parsed.line.ts_str, parsed.line.parts, parsed.line.ts)
        parts = parsed.line.parts
        event = parts[0]

        if event == ENCOUNTER_START:
            if current:
                yield current
            has_markers = True
            in_marker_encounter = True
            heuristic_active = False
            current = [item]
            continue
        if event == ENCOUNTER_END:
            has_markers = True
            if in_marker_encounter:
                current.append(item)
                yield current
            current = []
            in_marker_encounter = False
            continue
        if has_markers:
            if in_marker_encounter:
                current.append(item)
            continue

        boss_event = _is_boss_event(parts)
        if heuristic_active:
            if parsed.line.ts - last_boss_ts > ENCOUNTER_GAP_SECONDS:
                if current:
                    yield current
                current = []
                heuristic_active = False
                if event in ACTIVE_EVENTS and boss_event:
                    heuristic_active = True
                    last_boss_ts = parsed.line.ts
                    current = [item]
            elif boss_event:
                last_boss_ts = parsed.line.ts
                current.append(item)
            else:
                current.append(item)
        elif event in ACTIVE_EVENTS and boss_event:
            heuristic_active = True
            last_boss_ts = parsed.line.ts
            current = [item]

    if current:
        yield current


def _classify_segment(segment: list[tuple[str, list[str], float]]) -> dict[str, object] | None:
    boss_name: str | None = None
    encounter_mode: str | None = None
    group_size: int | None = None
    started_at = segment[0][0] if segment else ""
    ended_at = segment[-1][0] if segment else ""
    for _, parts, _ in segment:
        if parts and parts[0] == ENCOUNTER_START and len(parts) >= 5:
            boss_id = _int(parts[1])
            marker_name = parts[2].strip('"').strip()
            boss = lookup_boss_by_id(boss_id) or lookup_boss(marker_name)
            boss_name = boss.name if boss else marker_name
            encounter_mode = _decode_marker(_int(parts[3]))
            marker_size = _int(parts[4])
            group_size = marker_size if marker_size in (10, 25) else None
            break
    if not boss_name:
        boss_name = _infer_boss(segment)
    if not boss_name:
        return None
    detection = detect_difficulty(
        boss_name,
        segment,
        encounter_mode=encounter_mode,
        encounter_group_size=group_size,
    )
    return {
        "bossName": boss_name,
        "startedAt": started_at,
        "endedAt": ended_at,
        **detection.as_dict(),
    }


def quick_classify(fh: TextIO, cancel_event=None) -> list[dict[str, object]]:
    # Marker logs have explicit encounter boundaries and group size. Scan their
    # bulk damage lines as raw text and CSV-parse only boundaries or candidate
    # difficulty spells. This is materially faster for large archived logs.
    prefix: list[str] = []
    try:
        start_position = fh.tell()
        marker_line: str | None = None
        for _ in range(2048):
            if cancel_event is not None and cancel_event.is_set():
                raise TimeoutError("Quick classification was cancelled after the processing timeout")
            raw_line = fh.readline()
            if not raw_line:
                break
            prefix.append(raw_line)
            if "  ENCOUNTER_START," in raw_line:
                marker_line = raw_line
                break
        if marker_line is not None:
            results: list[dict[str, object]] = []
            segment: list[tuple[str, list[str], float]] = []

            def add_line(raw_line: str) -> None:
                parsed = parse_combat_log_line(raw_line)
                if parsed.line is not None:
                    segment.append((parsed.line.ts_str, parsed.line.parts, parsed.line.ts))

            add_line(marker_line)
            for line_number, raw_line in enumerate(fh, start=1):
                if cancel_event is not None and line_number % 4096 == 0 and cancel_event.is_set():
                    raise TimeoutError("Quick classification was cancelled after the processing timeout")
                if "  ENCOUNTER_START," in raw_line:
                    if segment:
                        result = _classify_segment(segment)
                        if result:
                            results.append(result)
                    segment = []
                    add_line(raw_line)
                elif "  ENCOUNTER_END," in raw_line:
                    add_line(raw_line)
                    result = _classify_segment(segment)
                    if result:
                        results.append(result)
                    segment = []
                elif segment and _RELEVANT_ID_RE.search(raw_line):
                    add_line(raw_line)
            if segment:
                result = _classify_segment(segment)
                if result:
                    results.append(result)
            return results
        fh.seek(start_position)
    except (AttributeError, OSError):
        # All production readers are seekable. Retain a safe fallback for custom
        # file-like callers that are not.
        if prefix:
            import io

            fh = io.StringIO("".join(prefix) + fh.read())

    results: list[dict[str, object]] = []
    for segment in iter_encounter_segments(fh, cancel_event):
        result = _classify_segment(segment)
        if result:
            results.append(result)
    return results
