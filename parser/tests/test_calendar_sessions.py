"""Calendar dates must not be discarded when segmenting concatenated logs."""

from datetime import datetime, timedelta, timezone
from io import StringIO

from parity.fixtures import PLAYER, event, fixture_bytes, spell, synthetic_cases
from parser_core import CombatLogParser


def test_same_clock_on_successive_dates_is_two_sessions_and_encounters():
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO(fixture_bytes('multiple-sessions').decode()))
    assert len(encounters) == 2
    assert [row.session_index for row in encounters] == [0, 1]
    assert [row.total_damage for row in encounters] == [121_000, 121_000]
    assert len(parser.session_analytics) == 2
    assert list(parser.session_analytics) == [0, 1]
    assert [row['durationMs'] for row in parser.session_analytics.values()] == [120_000, 120_000]
    assert encounters[1].started_at == '2026-09-05T12:00:00+00:00'
    assert parser.session_analytics[0]['startedAt'] == encounters[0].started_at
    assert parser.session_analytics[1]['startedAt'] == encounters[1].started_at


def _dated_raid(date: str, *, hour: str = '12') -> list[str]:
    return [
        line.replace('9/4 12:', f'{date} {hour}:')
        for line in synthetic_cases()['marrowgar-dense-kill']
    ]


def _nonraid_aura(date_and_time: str) -> str:
    payload = event(
        0,
        'SPELL_AURA_APPLIED',
        source=PLAYER,
        target=PLAYER,
        extra='48066,"Power Word: Shield",0x2,BUFF',
    ).split('  ', 1)[1]
    return f'{date_and_time}.000  {payload}'


def test_encounter_uses_actual_session_after_stale_nonraid_prefix():
    lines = [
        _nonraid_aura('9/26 16:42:00'),
        _nonraid_aura('9/26 16:43:06'),
        *_dated_raid('10/3'),
    ]
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))

    assert len(encounters) == 1
    assert encounters[0].session_index == 1
    assert list(parser.session_analytics) == [0, 1]
    assert parser.session_analytics[0]['startedAt'] == '2026-09-26T16:42:00+00:00'
    assert parser.session_analytics[0]['players'] == {}
    assert parser.session_analytics[1]['startedAt'] == encounters[0].started_at
    assert parser.session_analytics[1]['endedAt'] == encounters[0].ended_at


def test_orphan_middle_and_trailing_slices_do_not_shift_raid_association():
    lines = [
        *_dated_raid('9/26'),
        _nonraid_aura('9/27 12:00:00'),
        *_dated_raid('10/3'),
        _nonraid_aura('10/4 12:00:00'),
    ]
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))

    assert [encounter.session_index for encounter in encounters] == [0, 2]
    assert list(parser.session_analytics) == [0, 1, 2, 3]
    assert parser.session_analytics[0]['startedAt'] == encounters[0].started_at
    assert parser.session_analytics[2]['startedAt'] == encounters[1].started_at
    assert parser.session_analytics[1]['players'] == {}
    assert parser.session_analytics[3]['players'] == {}


def test_event_contiguous_trash_keeps_distant_bosses_in_one_full_session():
    lines = [
        *_dated_raid('10/3', hour='10'),
        _nonraid_aura('10/3 10:50:00'),
        _nonraid_aura('10/3 11:40:00'),
        *_dated_raid('10/3', hour='12'),
    ]
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))

    assert len(encounters) == 2
    assert [encounter.session_index for encounter in encounters] == [0, 0]
    assert list(parser.session_analytics) == [0]
    assert parser.session_analytics[0]['startedAt'] == encounters[0].started_at
    assert parser.session_analytics[0]['endedAt'] == encounters[1].ended_at


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
