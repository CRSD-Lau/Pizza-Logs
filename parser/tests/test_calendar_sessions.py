"""Calendar dates must not be discarded when segmenting concatenated logs."""

from datetime import datetime, timedelta, timezone
from io import StringIO

from parity.fixtures import fixture_bytes, spell
from parser_core import CombatLogParser


def test_same_clock_on_successive_dates_is_two_sessions_and_encounters():
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO(fixture_bytes('multiple-sessions').decode()))
    assert len(encounters) == 2
    assert [row.session_index for row in encounters] == [0, 1]
    assert [row.total_damage for row in encounters] == [121_000, 121_000]
    assert len(parser.session_analytics) == 2
    assert [row['durationMs'] for row in parser.session_analytics.values()] == [120_000, 120_000]
    assert encounters[1].started_at == '2026-09-05T12:00:00+00:00'


def test_december_january_rollover_preserves_calendar_year_and_duration():
    start = datetime(2026, 12, 31, 23, 59, 50, tzinfo=timezone.utc)
    lines = []
    for second in range(31):
        stamp = start + timedelta(seconds=second)
        ts = f'{stamp.month}/{stamp.day} {stamp:%H:%M:%S}.000'
        lines.append(ts + '  ' + spell(second, 1000).split('  ', 1)[1])
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines)))
    assert len(encounters) == 1
    assert encounters[0].started_at == '2026-12-31T23:59:50+00:00'
    assert encounters[0].ended_at == '2027-01-01T00:00:20+00:00'
    session = parser.session_analytics[0]
    assert session['startedAt'] == encounters[0].started_at
    assert session['endedAt'] == encounters[0].ended_at
    assert session['durationMs'] == 30_000
    assert encounters[0].duration_seconds == 30


def test_invalid_or_backwards_timestamps_are_counted_instead_of_guessed():
    invalid = ['2/30 12:00:00.000', '13/1 12:00:00.000', '9/4 24:00:00.000',
               '9/3 12:00:01.000', '9/4 11:59:00.000']
    payload = spell(0, 1000).split('  ', 1)[1]
    lines = [spell(0, 1000), *(stamp + '  ' + payload for stamp in invalid), spell(30, 1000)]
    parser = CombatLogParser(file_year=2026)
    parser.parse_file(StringIO('\n'.join(lines)))
    assert parser.skipped_line_count == 5
    assert parser.session_analytics[0]['totalDamage'] == 2000
    assert parser.session_analytics[0]['durationMs'] == 30_000


def test_same_date_backwards_clock_does_not_invent_a_new_calendar_day():
    lines = [spell(0, 1000).replace('9/4 12:00:00', '9/4 23:59:59'),
             spell(10, 1000).replace('9/4 12:00:10', '9/4 00:00:10'),
             spell(20, 1000).replace('9/4 12:00:20', '9/5 00:00:20')]
    parser = CombatLogParser(file_year=2026)
    parser.parse_file(StringIO('\n'.join(lines)))
    assert parser.skipped_line_count == 1
    assert parser.session_analytics[0]['durationMs'] == 21_000
    assert parser.session_analytics[0]['totalDamage'] == 2000
