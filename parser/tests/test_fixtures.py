"""
Fixture-based regression tests.

Each fixture directory under tests/fixtures/ must contain:
  combatlog.txt   — raw WoWCombatLog.txt content
  expected.json   — expected parse output (see fixtures/README.md for schema)

Run:
    pytest tests/test_fixtures.py -v
"""
import io
import json
import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from parser_core import CombatLogParser
from tests.fixtures.conftest import load_fixture_dirs, load_fixture


def _fixture_ids() -> list[str]:
    return [d.name for d in load_fixture_dirs()]


@pytest.fixture(params=load_fixture_dirs(), ids=_fixture_ids())
def fixture_result(request):
    """Parse each fixture and return (encounters, expected, fixture_name) for assertions."""
    fixture_dir = request.param
    log_text, expected = load_fixture(fixture_dir)
    with io.StringIO(log_text) as fh:
        encounters = CombatLogParser().parse_file(fh)
    return encounters, expected, fixture_dir.name


def test_encounter_count(fixture_result):
    encounters, expected, name = fixture_result
    assert len(encounters) == expected["encounter_count"], (
        f"[{name}] expected {expected['encounter_count']} encounters, "
        f"got {len(encounters)}"
    )


@pytest.mark.parametrize("field", ["boss_name", "difficulty", "outcome", "group_size"])
def test_encounter_exact_fields(fixture_result, field):
    encounters, expected, name = fixture_result
    field_map = {
        "boss_name": "boss_name",
        "difficulty": "difficulty",
        "outcome": "outcome",
        "group_size": "group_size",
    }
    for i, (enc, exp) in enumerate(zip(encounters, expected["encounters"])):
        if field not in exp:
            continue
        actual = getattr(enc, field_map[field])
        assert actual == exp[field], (
            f"[{name}] enc[{i}].{field}: expected {exp[field]!r}, got {actual!r}"
        )


def test_duration_in_range(fixture_result):
    encounters, expected, name = fixture_result
    for i, (enc, exp) in enumerate(zip(encounters, expected["encounters"])):
        lo = exp.get("duration_seconds_min")
        hi = exp.get("duration_seconds_max")
        if lo is None or hi is None:
            continue
        assert lo <= enc.duration_seconds <= hi, (
            f"[{name}] enc[{i}] duration {enc.duration_seconds:.1f}s "
            f"not in [{lo}, {hi}]"
        )


def test_total_damage_in_range(fixture_result):
    encounters, expected, name = fixture_result
    for i, (enc, exp) in enumerate(zip(encounters, expected["encounters"])):
        lo = exp.get("total_damage_min")
        hi = exp.get("total_damage_max")
        if lo is None or hi is None:
            continue
        assert lo <= enc.total_damage <= hi, (
            f"[{name}] enc[{i}] total_damage {enc.total_damage:.0f} "
            f"not in [{lo}, {hi}]"
        )


def test_total_healing_in_range(fixture_result):
    encounters, expected, name = fixture_result
    for i, (enc, exp) in enumerate(zip(encounters, expected["encounters"])):
        lo = exp.get("total_healing_min")
        hi = exp.get("total_healing_max")
        if lo is None or hi is None:
            continue
        assert lo <= enc.total_healing <= hi, (
            f"[{name}] enc[{i}] total_healing {enc.total_healing:.0f} "
            f"not in [{lo}, {hi}]"
        )


def test_participant_count_in_range(fixture_result):
    encounters, expected, name = fixture_result
    for i, (enc, exp) in enumerate(zip(encounters, expected["encounters"])):
        lo = exp.get("participant_count_min")
        hi = exp.get("participant_count_max")
        if lo is None or hi is None:
            continue
        n = len(enc.participants)
        assert lo <= n <= hi, (
            f"[{name}] enc[{i}] participant count {n} not in [{lo}, {hi}]"
        )


# ── Property tests (no fixtures) ─────────────────────────────────────────────

def test_empty_file_returns_no_encounters():
    with io.StringIO("") as fh:
        encs = CombatLogParser().parse_file(fh)
    assert encs == []


def test_single_line_no_crash():
    with io.StringIO("not a valid log line\n") as fh:
        encs = CombatLogParser().parse_file(fh)
    assert encs == []


def test_only_trash_returns_no_encounters():
    log = (
        "1/1 00:00:01.000  SPELL_DAMAGE,0x0600000000000001,\"Phyre\",0x514,"
        "0xF130000000000001,\"Trash Mob\",0xa18,133,\"Fireball\",6,"
        "1000,0,6,0,0,0,nil,nil,nil,nil,0\n"
    )
    with io.StringIO(log) as fh:
        encs = CombatLogParser().parse_file(fh)
    assert encs == []


def test_malformed_lines_do_not_crash():
    malformed = "\n".join([
        "not,valid",
        "1/1 00:00:01.000",
        "1/1 00:00:02.000  ",
        "1/1 00:00:03.000  SPELL_DAMAGE,incomplete",
        "garbage garbage garbage",
        "1/1 99:99:99.999  SPELL_DAMAGE," + ",".join(["x"] * 30),
    ])
    with io.StringIO(malformed) as fh:
        encs = CombatLogParser().parse_file(fh)
    assert isinstance(encs, list)
