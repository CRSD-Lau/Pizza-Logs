"""Auditable, per-encounter WotLK raid difficulty detection.

The identifying spell ranks are a clean-room transcription of factual spell IDs
from the pinned uwu-logs behavioral reference.  Detection always receives one
already-segmented encounter; it never scans an entire uploaded log.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence


DETECTOR_VERSION = "pizza-difficulty-v2"
VALID_MODES = ("10N", "10H", "25N", "25H")


def _modes(*families: Sequence[str]) -> dict[str, frozenset[int]]:
    result: dict[str, set[int]] = {mode: set() for mode in VALID_MODES}
    for family in families:
        for mode, spell_id in zip(VALID_MODES, family):
            if spell_id:
                result[mode].add(int(spell_id))
    return {mode: frozenset(ids) for mode, ids in result.items() if ids}


# boss -> mode -> all alternative identifying spell IDs.  Alternative spell
# families are deliberately unioned so no synthetic boss2 keys or duplicate-key
# overwrites are possible.
DIFFICULTY_SPELLS: dict[str, dict[str, frozenset[int]]] = {
    # Icecrown Citadel
    "Lord Marrowgar": _modes(("69146", "70824", "70823", "70825")),
    "Lady Deathwhisper": _modes(
        ("71254", "72503", "72008", "72504"),
        ("71001", "72109", "72108", "72110"),
    ),
    "Gunship Battle": _modes(
        ("70162", "72567", "72566", "72568"),
        ("70161", "72540", "72539", "72541"),
    ),
    "Deathbringer Saurfang": _modes(
        ("72380", "72439", "72438", "72440"),
        ("72385", "72442", "72441", "72443"),
    ),
    "Festergut": _modes(("72219", "72552", "72551", "72553")),
    "Rotface": _modes(("69674", "73022", "71224", "73023")),
    "Professor Putricide": _modes(
        ("70402", "72512", "72511", "72513"),
        ("70351", "71967", "71966", "71968"),
    ),
    "Blood Prince Council": _modes(("71405", "72805", "72804", "72806")),
    "Blood-Queen Lana'thel": _modes(("70985", "71699", "71698", "71700")),
    "Valithria Dreamwalker": _modes(("70759", "72015", "71889", "72016")),
    "Sindragosa": _modes(("70084", "71051", "71050", "71052")),
    "The Lich King": _modes(("70541", "73780", "73779", "73781")),

    # Ruby Sanctum
    "Saviana Ragefire": _modes(("74403", "", "74404", "")),
    "General Zarithrian": _modes(("74394", "", "74395", "")),
    "Halion": _modes(("74525", "74527", "74526", "74528")),

    # Trial of the Crusader.  Faction Champions contains every alternative
    # family, including both Mana Burn and Fan of Knives from the duplicated
    # key in the reference implementation.
    "Northrend Beasts": _modes(("66331", "67478", "67477", "67479")),
    "Lord Jaraxxus": _modes(("66532", "66964", "66963", "66965")),
    "Faction Champions": _modes(
        ("65546", "68625", "68624", "68626"),
        ("65973", "68101", "68100", "68102"),
        ("65868", "67989", "67988", "67990"),
        ("65821", "68152", "68151", "68153"),
        ("65807", "68004", "68003", "68005"),
        ("66047", "67936", "67935", "67937"),
        ("66178", "68760", "68759", "68761"),
        ("66100", "68027", "68026", "68028"),
        ("65955", "68098", "68097", "68099"),
    ),
    "Twin Val'kyr": _modes(("65767", "67275", "67274", "67276")),
    "Anub'arak": _modes(("66013", "68509", "67700", "68510")),

    # WotLK raids without Heroic modes in the reference mapping.
    "Malygos": _modes(("61693", "", "61694", "")),
    "Sartharion": _modes(("56908", "", "58956", "")),
    "Toravon the Ice Watcher": _modes(("72082", "", "72097", "")),
    "Koralon the Flame Watcher": _modes(("66670", "", "67329", "")),
    "Archavon the Stone Watcher": _modes(
        ("58696", "", "60884", ""),
        ("58695", "", "60883", ""),
    ),
    "Emalon the Storm Watcher": _modes(("64213", "", "64215", "")),

    # Ulduar hard-mode-only rank markers.  Freya, Mimiron, Vezax and Yogg use
    # explicit rules below because one marker alone is not a complete answer.
    "XT-002 Deconstructor": _modes(("", "64227", "", "64236")),
    "Assembly of Iron": _modes(("", "64637", "", "61888")),
    "Thorim": _modes(
        ("", "62597", "", "62605"),
        ("", "62583", "", "62601"),
        ("", "62580", "", "62604"),
    ),
    "Freya": _modes(
        ("", "62437", "", "62859"),
        ("", "62861", "", "62438"),
        ("", "62451", "", "62865"),
    ),
    "Mimiron": _modes(("", "64582", "", "64582")),
    "General Vezax": _modes(("", "63420", "", "63420")),
}

ULD_NORMAL_WHEN_HARD_MARKER_MISSING = frozenset({
    "XT-002 Deconstructor",
    "Assembly of Iron",
    "Thorim",
    "Mimiron",
    "General Vezax",
})
MIMIRON_HARD_MARKER = 64582
VEZAX_HARD_MARKER = 63420
FREYA_ELDER_MARKERS = {
    10: frozenset({62437, 62438, 62623}),
    25: frozenset({62859, 62861, 62872}),
}
YOGG_KEEPER_BUFFS = frozenset({62650, 62670, 62671, 62702})
UNSUPPORTED_SPECIAL_CASES = {
    "Hodir": "Hodir hard mode has no supported identifying rule",
    "Sartharion": "Sartharion drake count is not supported",
}
SIZE_SCOPED_HEROIC_MARKERS = {
    "Deathbringer Saurfang": frozenset({72769, 72771}),
    "Valithria Dreamwalker": frozenset({71940, 71941}),
}


@dataclass(frozen=True)
class DifficultyDetection:
    mode: str
    confidence: str
    evidence: tuple[str, ...]
    reason: str
    detector_version: str = DETECTOR_VERSION

    def as_dict(self) -> dict[str, object]:
        return {
            "mode": self.mode,
            "confidence": self.confidence,
            "evidence": list(self.evidence),
            "reason": self.reason,
            "detectorVersion": self.detector_version,
        }


def _spell_ids(segment: Iterable[tuple[str, list[str], float]]) -> set[int]:
    found: set[int] = set()
    for _, parts, _ in segment:
        if not parts or parts[0] in {"SWING_DAMAGE", "UNIT_DIED", "ENCOUNTER_START", "ENCOUNTER_END"}:
            continue
        if len(parts) <= 7:
            continue
        try:
            found.add(int(parts[7]))
        except (TypeError, ValueError):
            continue
    return found


def _is_player_guid(guid: str) -> bool:
    upper = guid.upper()
    return upper.startswith("PLAYER-") or upper.startswith("0X06") or upper.startswith("0X0000000000")


def _player_count(segment: Iterable[tuple[str, list[str], float]]) -> int:
    players: set[str] = set()
    for _, parts, _ in segment:
        for idx in (1, 4):
            if len(parts) > idx and _is_player_guid(parts[idx]):
                players.add(parts[idx])
    players.discard("0x0000000000000000")
    players.discard("0X0000000000000000")
    return len(players)


def _size_evidence(
    segment: Iterable[tuple[str, list[str], float]],
    encounter_group_size: int | None,
) -> tuple[int | None, str]:
    if encounter_group_size in (10, 25):
        return encounter_group_size, f"encounter_group_size:{encounter_group_size}"
    count = _player_count(segment)
    if count <= 0:
        return None, "player_guids:0"
    size = 25 if count > 10 else 10
    return size, f"player_guids:{count}=>{size}"


def _result(mode: str, confidence: str, evidence: list[str], reason: str) -> DifficultyDetection:
    return DifficultyDetection(mode, confidence, tuple(sorted(set(evidence))), reason)


def detect_difficulty(
    boss_name: str,
    segment: list[tuple[str, list[str], float]],
    *,
    encounter_mode: str | None = None,
    encounter_group_size: int | None = None,
) -> DifficultyDetection:
    """Classify one segmented encounter using aggregate, boss-scoped evidence."""
    spell_ids = _spell_ids(segment)
    size, size_evidence = _size_evidence(segment, encounter_group_size)

    unsupported_reason = UNSUPPORTED_SPECIAL_CASES.get(boss_name)
    if unsupported_reason:
        return _result("UNKNOWN", "none", [size_evidence], unsupported_reason)

    size_scoped_markers = spell_ids & SIZE_SCOPED_HEROIC_MARKERS.get(boss_name, frozenset())
    if size_scoped_markers:
        if size not in (10, 25):
            return _result("UNKNOWN", "none", [*(f"spell:{sid}" for sid in sorted(size_scoped_markers)), size_evidence], f"{boss_name} heroic marker found but raid size is unknown")
        return _result(
            f"{size}H",
            "high",
            [size_evidence, *(f"spell:{sid}" for sid in sorted(size_scoped_markers))],
            f"{boss_name} heroic-only marker is present",
        )

    # Freya needs all three Elder abilities; a single Elder marker is not hard
    # mode proof.  This explicit rule intentionally precedes generic rank lookup.
    if boss_name == "Freya":
        if size not in (10, 25):
            return _result("UNKNOWN", "none", [size_evidence], "Freya raid size is unknown")
        required = FREYA_ELDER_MARKERS[size]
        present = required & spell_ids
        evidence = [size_evidence, *(f"spell:{sid}" for sid in sorted(present))]
        if present == required:
            return _result(f"{size}H", "high", evidence, "All three Freya Elder markers are present")
        return _result(f"{size}N", "medium", evidence, "Fewer than three Freya Elder markers are present")

    if boss_name == "Yogg-Saron":
        if size not in (10, 25):
            return _result("UNKNOWN", "none", [size_evidence], "Yogg-Saron raid size is unknown")
        keepers = spell_ids & YOGG_KEEPER_BUFFS
        evidence = [size_evidence, *(f"keeper_buff:{sid}" for sid in sorted(keepers))]
        if len(keepers) <= 1:
            return _result(f"{size}H", "medium", evidence, "Zero or one distinct Keeper buff indicates hard mode")
        return _result(f"{size}N", "medium", evidence, "Two or more distinct Keeper buffs indicate normal mode")

    if boss_name in {"Mimiron", "General Vezax"}:
        if size not in (10, 25):
            return _result("UNKNOWN", "none", [size_evidence], f"{boss_name} raid size is unknown")
        marker = MIMIRON_HARD_MARKER if boss_name == "Mimiron" else VEZAX_HARD_MARKER
        if marker in spell_ids:
            return _result(f"{size}H", "high", [size_evidence, f"spell:{marker}"], f"{boss_name} hard-mode marker is present")
        return _result(f"{size}N", "medium", [size_evidence], f"{boss_name} hard-mode marker is absent")

    spell_map = DIFFICULTY_SPELLS.get(boss_name)
    matched: dict[str, set[int]] = {}
    if spell_map:
        for mode, ids in spell_map.items():
            overlap = ids & spell_ids
            if overlap:
                matched[mode] = overlap

    spell_evidence = [
        f"spell:{spell_id}=>{mode}"
        for mode, ids in matched.items()
        for spell_id in sorted(ids)
    ]
    if len(matched) > 1:
        return _result("UNKNOWN", "none", spell_evidence, "Conflicting difficulty-specific spell IDs")
    if len(matched) == 1:
        mode = next(iter(matched))
        return _result(mode, "high", spell_evidence, "One unambiguous boss-specific spell mode matched")

    if boss_name in ULD_NORMAL_WHEN_HARD_MARKER_MISSING:
        if size not in (10, 25):
            return _result("UNKNOWN", "none", [size_evidence], f"{boss_name} raid size is unknown")
        return _result(f"{size}N", "medium", [size_evidence], f"{boss_name} hard-mode markers are absent")

    # A valid encounter marker is a documented compatibility fallback for a
    # mapped boss only.  Boss-specific spell ranks remain stronger evidence.
    if spell_map and encounter_mode in spell_map:
        return _result(
            encounter_mode,
            "medium",
            [f"encounter_start:{encounter_mode}"],
            "Supported ENCOUNTER_START mode used because no spell-rank evidence was present",
        )

    if not spell_map:
        return _result("UNKNOWN", "none", [size_evidence], "Boss has no supported difficulty rule")
    return _result("UNKNOWN", "none", [size_evidence], "No supported difficulty evidence was found")
