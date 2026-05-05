"""Unit tests for combat-log line tokenizing and skipped-line classification."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from combat_log_events import parse_combat_log_line


def test_parse_combat_log_line_returns_timestamp_parts_and_seconds():
    result = parse_combat_log_line(
        '4/19 13:00:01.250  SPELL_DAMAGE,0x0600000000000001,"Phyre",0x512,'
        '0xF130000000000001,"Lord Marrowgar",0xa48,133,"Fireball",4,1234,0,4,0,0,0,0,0'
    )

    assert result.line is not None
    assert result.skip_reason is None
    assert result.line.ts_str == "4/19 13:00:01.250"
    assert result.line.parts[0] == "SPELL_DAMAGE"
    assert result.line.parts[2] == "Phyre"
    assert result.line.ts == 46801.25


def test_parse_combat_log_line_classifies_missing_timestamp_separator():
    result = parse_combat_log_line("4/19 13:00:01.250 SPELL_DAMAGE,missing,double,space")

    assert result.line is None
    assert result.skip_reason == "missing_timestamp_separator"


def test_parse_combat_log_line_classifies_too_few_fields():
    result = parse_combat_log_line("4/19 13:00:01.250  SPELL_DAMAGE")

    assert result.line is None
    assert result.skip_reason == "too_few_fields"
