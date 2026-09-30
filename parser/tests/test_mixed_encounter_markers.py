"""Mixed Warmane marker coverage must neither hide nor duplicate attempts."""

import io
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from parser_core import CombatLogParser
from quick_classifier import quick_classify
import quick_classifier


def record(second, *parts):
    timestamp = datetime(2026, 9, 17, 23) + timedelta(seconds=second)
    return timestamp.strftime("9/17 %H:%M:%S.000  ") + ",".join(parts) + "\n"


def start(second):
    return record(second, "ENCOUNTER_START", "39863", "Halion", "6", "25")


def end(second, success=0, boss_id="39863", name="Halion"):
    return record(second, "ENCOUNTER_END", boss_id, name, "6", "25", str(success))


def hit(second):
    return record(second, "SPELL_DAMAGE", "0x0600000000000001", "TestPlayer", "0x512",
                  "0xF130009BB7000001", "Halion", "0xa48", "74528", "TestSpell", "4",
                  "1000", "0", "4", "0", "0", "0", "0", "0")


def death(second):
    return record(second, "UNIT_DIED", "0x0", "nil", "0",
                  "0xF130009BB7000001", "Halion", "0xa48")


def pull(second, marked=False, kill=False):
    log = start(second) if marked else ""
    log += "".join(hit(second + 1 + index * 6) for index in range(12))
    if kill:
        log += death(second + 73)
    if marked:
        log += end(second + 74, int(kill))
    return log


def parse(log):
    parser = CombatLogParser(2026)
    encounters = parser.parse_file(io.StringIO(log))
    preview = quick_classify(io.StringIO(log), file_year=2026)
    assert len(preview) == len(encounters)
    assert [e["bossName"] for e in preview] == [e.boss_name for e in encounters]
    assert [e["mode"] for e in preview] == [e.difficulty for e in encounters]
    return parser, encounters


@pytest.mark.parametrize("markers", [
    (False, False, False), (False, False, True), (False, True, False),
    (False, True, True), (True, False, False), (True, False, True),
    (True, True, False), (True, True, True),
])
def test_two_wipes_then_kill_with_any_marker_coverage(markers):
    parser, encounters = parse("".join(
        pull(index * 300, marked, index == 2) for index, marked in enumerate(markers)
    ))
    assert [(e.boss_name, e.difficulty, e.outcome) for e in encounters] == [
        ("Halion", "25H", "WIPE"), ("Halion", "25H", "WIPE"), ("Halion", "25H", "KILL"),
    ]
    assert len({e.fingerprint for e in encounters}) == 3
    assert [e.total_damage for e in encounters] == [12000, 12000, 12000]
    assert [e.started_at for e in encounters] == [
        f"2026-09-17T23:{minute:02d}:00+00:00" if marked
        else f"2026-09-17T23:{minute:02d}:01+00:00"
        for minute, marked in zip((0, 5, 10), markers)
    ]
    assert parser.warnings == []


@pytest.mark.parametrize("marker", [
    end(100, 1),
    record(100, "ENCOUNTER_START", "39863"),
    record(100, "ENCOUNTER_START", "invalid", "Halion", "6", "25"),
    record(100, "ENCOUNTER_START", "39863", "", "6", "25"),
    record(100, "ENCOUNTER_END", "39863"),
])
def test_orphan_or_malformed_marker_does_not_hide_heuristic_pulls(marker):
    parser, encounters = parse(pull(0) + marker + pull(300) + pull(600, kill=True))
    assert [e.outcome for e in encounters] == ["WIPE", "WIPE", "KILL"]
    assert parser.warnings == ["Ignored 1 malformed or unmatched encounter marker(s)."]


@pytest.mark.parametrize("bad_end", [
    end(20, 1, boss_id="36612"), end(20, 1, name="Lord Marrowgar"),
    end(20, "invalid"),
])
def test_mismatched_end_cannot_close_or_relabel_marked_wipe(bad_end):
    parser, encounters = parse(start(0) + hit(1) + bad_end + hit(40) + end(41)
                               + pull(300, kill=True))
    assert [e.outcome for e in encounters] == ["WIPE", "KILL"]
    assert encounters[0].total_damage == 2000
    assert encounters[0].duration_seconds == 40
    assert parser.warnings == ["Ignored 1 malformed or unmatched encounter marker(s)."]


def test_duplicate_markers_do_not_duplicate_attempts():
    parser, encounters = parse(start(0) + start(0) + hit(1) + death(2)
                               + end(3, 1) + end(3, 1) + pull(300))
    assert [e.outcome for e in encounters] == ["KILL", "WIPE"]
    assert [e.total_damage for e in encounters] == [1000, 12000]
    assert parser.warnings == ["Ignored 1 malformed or unmatched encounter marker(s)."]


def test_late_start_adopts_same_pull_without_losing_early_damage():
    log = "".join(hit(index * 2) for index in range(12))
    parser, encounters = parse(log + start(23) + hit(24) + death(25) + end(26, 1)
                               + pull(300))
    assert [e.outcome for e in encounters] == ["KILL", "WIPE"]
    assert encounters[0].total_damage == 13000
    assert encounters[0].started_at == "2026-09-17T23:00:00+00:00"
    assert parser.warnings == []


def test_completed_heuristic_pull_is_not_adopted_by_nearby_start():
    parser, encounters = parse(pull(0, kill=True) + pull(80, marked=True))
    assert [e.outcome for e in encounters] == ["KILL", "WIPE"]
    assert [e.total_damage for e in encounters] == [12000, 12000]
    assert parser.warnings == []


def test_new_start_flushes_unfinished_marker_and_eof_preserves_partial_pull():
    parser, encounters = parse(start(0) + hit(1) + start(300) + hit(301))
    assert [e.outcome for e in encounters] == ["UNKNOWN", "UNKNOWN"]
    assert [e.total_damage for e in encounters] == [1000, 1000]
    assert parser.warnings == []


def test_marker_window_preserves_long_phase_gap():
    parser, encounters = parse(start(0) + hit(1) + hit(180) + death(181) + end(182, 1))
    assert len(encounters) == 1
    assert encounters[0].outcome == "KILL"
    assert encounters[0].total_damage == 2000
    assert encounters[0].duration_seconds == 181
    assert parser.warnings == []


def test_fully_marked_preview_keeps_optimized_scan(monkeypatch):
    original = quick_classifier.parse_combat_log_line
    calls = 0

    def counted_parse(raw_line):
        nonlocal calls
        calls += 1
        return original(raw_line)

    monkeypatch.setattr(quick_classifier, "parse_combat_log_line", counted_parse)
    log = start(0) + "".join(hit(1).replace(",74528,", ",133,") for _ in range(1000)) + end(2)
    preview = quick_classify(io.StringIO(log), file_year=2026)
    assert len(preview) == 1
    assert preview[0]["mode"] == "25H"
    assert calls < 20
