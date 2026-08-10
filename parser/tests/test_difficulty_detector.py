"""Regression coverage for the per-attempt auditable difficulty detector."""

from __future__ import annotations

import os
import sys
import io

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from difficulty_detector import (  # noqa: E402
    DETECTOR_VERSION,
    DIFFICULTY_SPELLS,
    FREYA_ELDER_MARKERS,
    YOGG_KEEPER_BUFFS,
    detect_difficulty,
)
from parser_core import CombatLogParser  # noqa: E402


def _spell(spell_id: int, player: int = 1) -> tuple[str, list[str], float]:
    return (
        "1/1 00:00:01.000",
        [
            "SPELL_DAMAGE",
            f"0x060000000000{player:04X}",
            f"Player{player}",
            "0x514",
            "0xF130000000000001",
            "Boss",
            "0xa48",
            str(spell_id),
            "Marker",
            "1",
            "1",
        ],
        1.0,
    )


def _players(count: int) -> list[tuple[str, list[str], float]]:
    return [_spell(1_000_000 + i, i + 1) for i in range(count)]


# This parametrized fixture covers every supported mapped boss and every mode
# that boss exposes.  The selected ID is stable because the production map uses
# immutable sets and the assertion reports the exact boss/mode pair.
MAPPED_CASES = [
    (boss, mode, min(spell_ids))
    for boss, modes in DIFFICULTY_SPELLS.items()
    if boss not in {"Sartharion", "Freya", "Mimiron", "General Vezax"}
    for mode, spell_ids in modes.items()
]


@pytest.mark.parametrize("boss,mode,spell_id", MAPPED_CASES)
def test_every_supported_boss_mode_fixture(boss: str, mode: str, spell_id: int):
    result = detect_difficulty(boss, [_spell(spell_id)])
    assert result.mode == mode
    assert result.confidence == "high"
    assert result.detector_version == DETECTOR_VERSION


@pytest.mark.parametrize(
    "mode,spell_id",
    [("10N", 69146), ("10H", 70824), ("25N", 70823), ("25H", 70825)],
)
def test_icc_all_four_modes(mode: str, spell_id: int):
    assert detect_difficulty("Lord Marrowgar", [_spell(spell_id)]).mode == mode


@pytest.mark.parametrize(
    "boss,mode,spell_id",
    [
        ("Northrend Beasts", "25H", 67479),
        ("Halion", "10H", 74527),
    ],
)
def test_toc_and_ruby_sanctum_examples(boss: str, mode: str, spell_id: int):
    assert detect_difficulty(boss, [_spell(spell_id)]).mode == mode


@pytest.mark.parametrize(
    "boss,marker,size,expected",
    [
        ("XT-002 Deconstructor", 64227, 10, "10H"),
        ("XT-002 Deconstructor", 64236, 25, "25H"),
        ("Assembly of Iron", 64637, 10, "10H"),
        ("Assembly of Iron", 61888, 25, "25H"),
        ("Thorim", 62583, 10, "10H"),
        ("Thorim", 62604, 25, "25H"),
        ("Mimiron", 64582, 10, "10H"),
        ("Mimiron", 64582, 25, "25H"),
        ("General Vezax", 63420, 10, "10H"),
        ("General Vezax", 63420, 25, "25H"),
    ],
)
def test_every_supported_ulduar_hard_mode_rule(boss: str, marker: int, size: int, expected: str):
    result = detect_difficulty(boss, [*_players(size), _spell(marker)], encounter_group_size=size)
    assert result.mode == expected


@pytest.mark.parametrize("boss", ["XT-002 Deconstructor", "Assembly of Iron", "Thorim", "Mimiron", "General Vezax"])
@pytest.mark.parametrize("size", [10, 25])
def test_supported_ulduar_missing_hard_marker_is_size_matched_normal(boss: str, size: int):
    result = detect_difficulty(boss, _players(size), encounter_group_size=size)
    assert result.mode == f"{size}N"


@pytest.mark.parametrize("size", [10, 25])
def test_freya_requires_all_three_elder_markers(size: int):
    required = sorted(FREYA_ELDER_MARKERS[size])
    partial = detect_difficulty("Freya", [*_players(size), *map(_spell, required[:2])], encounter_group_size=size)
    complete = detect_difficulty("Freya", [*_players(size), *map(_spell, required)], encounter_group_size=size)
    assert partial.mode == f"{size}N"
    assert complete.mode == f"{size}H"


@pytest.mark.parametrize("size", [10, 25])
def test_yogg_keeper_count_rule(size: int):
    keepers = sorted(YOGG_KEEPER_BUFFS)
    zero = detect_difficulty("Yogg-Saron", _players(size), encounter_group_size=size)
    one = detect_difficulty("Yogg-Saron", [*_players(size), _spell(keepers[0])], encounter_group_size=size)
    two = detect_difficulty("Yogg-Saron", [*_players(size), _spell(keepers[0]), _spell(keepers[1])], encounter_group_size=size)
    assert zero.mode == f"{size}H"
    assert one.mode == f"{size}H"
    assert two.mode == f"{size}N"


def test_conflicting_spell_ids_are_unknown():
    result = detect_difficulty("Lord Marrowgar", [_spell(69146), _spell(70825)])
    assert result.mode == "UNKNOWN"
    assert "Conflicting" in result.reason


def test_missing_evidence_and_unmapped_boss_are_unknown():
    assert detect_difficulty("Lord Marrowgar", []).mode == "UNKNOWN"
    assert detect_difficulty("Patchwerk", _players(25), encounter_mode="25N").mode == "UNKNOWN"


@pytest.mark.parametrize("boss", ["Hodir", "Sartharion"])
def test_explicitly_unsupported_special_modes_are_unknown(boss: str):
    assert detect_difficulty(boss, _players(25), encounter_mode="25N", encounter_group_size=25).mode == "UNKNOWN"


def test_malformed_lines_do_not_crash():
    malformed = [
        ("bad", [], 0.0),
        ("bad", ["SPELL_DAMAGE"], 0.0),
        ("bad", ["SPELL_DAMAGE", "x", "x", "x", "x", "x", "x", "not-an-id"], 0.0),
    ]
    assert detect_difficulty("Lord Marrowgar", malformed).mode == "UNKNOWN"


def test_alternative_spell_families_and_faction_champions_are_preserved():
    assert detect_difficulty("Lady Deathwhisper", [_spell(72110)]).mode == "25H"
    champions = DIFFICULTY_SPELLS["Faction Champions"]
    assert 66100 in champions["10N"]  # Mana Burn family
    assert 65955 in champions["10N"]  # Fan of Knives family
    assert detect_difficulty("Faction Champions", [_spell(68760)]).mode == "10H"
    assert detect_difficulty("Faction Champions", [_spell(68099)]).mode == "25H"


def test_difficulty_is_per_attempt_not_per_archive():
    attempt_one = detect_difficulty("Lord Marrowgar", [_spell(69146)])
    attempt_two = detect_difficulty("Lord Marrowgar", [_spell(70825)])
    assert (attempt_one.mode, attempt_two.mode) == ("10N", "25H")


def test_supported_encounter_marker_is_only_a_fallback():
    marker_only = detect_difficulty("Halion", [], encounter_mode="25N", encounter_group_size=25)
    stronger_spell = detect_difficulty("Halion", [_spell(74527)], encounter_mode="25N", encounter_group_size=25)
    assert marker_only.mode == "25N"
    assert marker_only.confidence == "medium"
    assert stronger_spell.mode == "10H"


def test_unknown_difficulty_kill_is_withheld_from_rankings():
    log = "\n".join([
        '1/1 00:00:01.000  ENCOUNTER_START,9999,"Patchwerk",3,10',
        '1/1 00:00:02.000  SPELL_DAMAGE,0x0600000000000001,"Player",0x514,0xF130000000000001,"Patchwerk",0xa48,133,"Fireball",4,1000,0,4,0,0,0,nil,nil,nil,nil,0',
        '1/1 00:01:02.000  UNIT_DIED,0x0000000000000000,nil,0x80000000,0xF130000000000001,"Patchwerk",0xa48',
        '1/1 00:01:02.100  ENCOUNTER_END,9999,"Patchwerk",3,10,1',
    ])
    encounter = CombatLogParser().parse_file(io.StringIO(log))[0]
    assert encounter.difficulty == "UNKNOWN"
    assert encounter.outcome == "UNKNOWN"
