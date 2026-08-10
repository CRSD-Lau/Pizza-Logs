"""Exact regression gate for parser analytical output.

The fixture tests intentionally use ranges for readability. This companion gate
hashes the complete normalized analytical payload so dependency/runtime upgrades
cannot silently alter player totals, rates, deaths, crits, or breakdowns.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from parser_core import CombatLogParser


FIXTURES = Path(__file__).parent / "fixtures"
BASELINE_PATH = Path(__file__).parent / "baselines" / "analytics-v1.json"
BASELINE = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
LEGACY_PARTICIPANT_FIELDS = (
    "name",
    "class",
    "totalDamage",
    "totalHealing",
    "damageTaken",
    "dps",
    "hps",
    "deaths",
    "critPct",
    "spellBreakdown",
    "targetBreakdown",
)


def _normalize_fixture(fixture_name: str) -> list[dict[str, object]]:
    combat_log = FIXTURES / fixture_name / "combatlog.txt"
    with combat_log.open(encoding="utf-8") as handle:
        encounters = CombatLogParser().parse_file(handle)

    return [
        {
            "bossName": encounter.boss_name,
            "difficulty": encounter.difficulty,
            "groupSize": encounter.group_size,
            "outcome": encounter.outcome,
            "durationSeconds": encounter.duration_seconds,
            "startedAt": encounter.started_at,
            "endedAt": encounter.ended_at,
            "totalDamage": encounter.total_damage,
            "totalHealing": encounter.total_healing,
            "totalDamageTaken": encounter.total_damage_taken,
            "sessionIndex": encounter.session_index,
            "participants": sorted(
                (
                    {field: participant[field] for field in LEGACY_PARTICIPANT_FIELDS}
                    for participant in encounter.participants
                ),
                key=lambda row: row["name"],
            ),
        }
        for encounter in encounters
    ]


@pytest.mark.parametrize("fixture_name", sorted(BASELINE["fixtures"]))
def test_complete_analytical_output_matches_baseline(fixture_name: str) -> None:
    payload = _normalize_fixture(fixture_name)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    actual_hash = hashlib.sha256(encoded).hexdigest()

    expected = BASELINE["fixtures"][fixture_name]
    assert actual_hash == expected["sha256"], (
        f"{fixture_name} analytical output changed; review the normalized parser "
        "payload before intentionally replacing analytics-v1.json"
    )
    assert len(payload) == expected["encounters"]
    assert sum(row["totalDamage"] for row in payload) == expected["totalDamage"]
    assert sum(row["totalHealing"] for row in payload) == expected["totalHealing"]
