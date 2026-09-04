"""Provisional heuristic attempts use the same calendar gaps as full parsing."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from io import StringIO

import pytest

import main
from parity.fixtures import fixture_bytes, spell
from quick_classifier import iter_encounter_segments, quick_classify


def at(stamp: str) -> str:
    return stamp + '  ' + spell(0, 1000).split('  ', 1)[1]


def test_equal_clock_times_on_successive_dates_are_separate_preview_attempts():
    results = quick_classify(StringIO(fixture_bytes('multiple-sessions').decode()), file_year=2026)
    assert len(results) == 2
    assert [(row['startedAt'], row['endedAt']) for row in results] == [
        ('9/4 12:00:00.000', '9/4 12:02:00.000'),
        ('9/5 12:00:00.000', '9/5 12:02:00.000'),
    ]


@pytest.mark.parametrize(('new_year_stamp', 'count'), [
    ('1/1 00:00:10.000', 1),
    ('1/1 00:01:00.000', 2),
])
def test_year_rollover_uses_actual_gap_without_splitting_continuous_fights(new_year_stamp, count):
    lines = [at('12/31 23:59:50.000'), at(new_year_stamp)]
    results = quick_classify(StringIO('\n'.join(lines)), file_year=2026)
    assert len(results) == count
    assert results[0]['startedAt'] == '12/31 23:59:50.000'
    assert results[-1]['endedAt'] == new_year_stamp


def test_invalid_and_backwards_dates_do_not_create_or_extend_preview_attempts():
    lines = [at('9/4 12:00:00.000'), at('9/3 12:00:10.000'),
             at('9/4 11:59:59.000'), at('2/30 12:00:20.000'), at('9/4 12:00:30.000')]
    segments = list(iter_encounter_segments(StringIO('\n'.join(lines)), file_year=2026))
    assert len(segments) == 1
    assert [row[0] for row in segments[0]] == ['9/4 12:00:00.000', '9/4 12:00:30.000']


@pytest.mark.parametrize(('file_year', 'count'), [(2024, 2), (2026, 1)])
def test_preview_calendar_validation_uses_configured_file_year(file_year, count):
    lines = [at('2/28 12:00:00.000'), at('2/29 12:00:00.000')]
    assert len(quick_classify(StringIO('\n'.join(lines)), file_year=file_year)) == count


def test_calendar_segmentation_yields_before_reading_remaining_input():
    def lines():
        yield at('9/4 12:00:00.000')
        yield at('9/5 12:00:00.000')
        raise AssertionError('must yield the closed attempt before reading more input')

    segments = iter_encounter_segments(lines(), file_year=2026)
    assert next(segments)[0][0] == '9/4 12:00:00.000'


@pytest.mark.anyio
@pytest.mark.parametrize(('year_hint', 'count', 'expected_year'), [(0, 1, 2026), (2024, 2, 2024)])
async def test_upload_shares_default_or_historical_year_between_quick_and_full(
    tmp_path, monkeypatch, year_hint, count, expected_year,
):
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 9, 4, tzinfo=timezone.utc)

    payload = fixture_bytes('multiple-sessions').replace(b'9/4 ', b'2/28 ').replace(b'9/5 ', b'2/29 ')

    class Request:
        def __init__(self):
            self.headers = {'content-length': str(len(payload))}

        async def stream(self):
            yield payload

    monkeypatch.setattr(main, 'datetime', FixedDateTime)
    monkeypatch.setattr(main, 'UPLOAD_TEMP_DIR', tmp_path)
    monkeypatch.setattr(main, '_upload_slots', asyncio.Semaphore(1))
    response = await main.upload_archive_stream(
        str(uuid.uuid4()), Request(), 'calendar.txt', year_hint,
    )
    events = []
    async for chunk in response.body_iterator:
        text = chunk.decode() if isinstance(chunk, bytes) else chunk
        events.extend(json.loads(line[6:]) for line in text.splitlines() if line.startswith('data: '))
    quick = next(row for row in events if row['type'] == 'quick-result')
    done = next(row for row in events if row['type'] == 'done')
    assert len(quick['result']['encounters']) == count
    assert len(done['data']['encounters']) == count
    assert done['data']['encounters'][0]['startedAt'].startswith(f'{expected_year}-02-28T')
