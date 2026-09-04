"""Maintainer-only adapter invoking an unmodified, separately installed reference.

This module contains no upstream implementation. It calls the reference's own
normalizer and the report methods called by its public Flask route. Never used
by normal CI. Input is restricted to this project's original synthetic corpus.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path


def deny_egress(event: str, _args: tuple) -> None:
    if event in {'socket.connect', 'socket.getaddrinfo', 'subprocess.Popen', 'os.system'}:
        raise RuntimeError('Network and child processes are disabled during reference capture.')


def numeric(value: str) -> int:
    return int(value.replace(' ', '').replace('\u00a0', ''))


def verify_snapshot(root: Path, commit: str) -> None:
    lock = json.loads(Path(__file__).with_name('reference-source.json').read_text(encoding='utf-8'))
    if lock['commitSha'] != commit:
        raise ValueError('Reference SHA differs from the independently inspected source inventory.')
    for name, expected in lock['files'].items():
        data = (root / name).read_bytes()
        blob = b'blob ' + str(len(data)).encode() + b'\0' + data
        if hashlib.sha1(blob, usedforsecurity=False).hexdigest() != expected:
            raise ValueError(f'Reference source is modified: {name}')


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--reference', required=True, type=Path)
    cli.add_argument('--data-dir', required=True, type=Path)
    cli.add_argument('--input', required=True, type=Path)
    cli.add_argument('--case-id', required=True)
    cli.add_argument('--reference-sha', required=True)
    cli.add_argument('--output', required=True, type=Path)
    args = cli.parse_args()
    root = args.reference.resolve()
    source = args.input.read_bytes()
    # Importing the local fixture generator does not import the Pizza parser.
    from fixtures import fixture_bytes
    if source != fixture_bytes(args.case_id):
        raise ValueError('Only unchanged, original synthetic fixtures may be captured.')
    if len(args.reference_sha) != 40 or any(c not in '0123456789abcdef' for c in args.reference_sha):
        raise ValueError('A complete reference commit SHA is required.')
    verify_snapshot(root, args.reference_sha)
    sys.addaudithook(deny_egress)
    sys.path.insert(0, str(root))
    from c_path import Directories, FileNames, PathExt
    from logs_fix import normalize
    from logs_main import THE_LOGS
    from logs_upload import LogsSeparator

    data_dir = args.data_dir.resolve()
    if data_dir == root or root in data_dir.parents:
        raise ValueError('Reference runtime data must be outside the source snapshot.')
    data_dir.mkdir(parents=True, exist_ok=True)
    Directories.logs = PathExt(data_dir)
    digest = hashlib.sha256(source).hexdigest()
    def metrics(report, segments: list) -> tuple[dict, dict]:
        displayed = report.get_report_page_all_wrap(segments, '')['DATA']
        names = set()
        for column in ('damage', 'heal', 'taken'):
            names.update(displayed[column])
        names.discard('Total')

        def value(column: str, name: str) -> int:
            cell = displayed[column].get(name)
            return numeric(cell['value']) if cell else 0

        return {
            'durationMs': round(report.get_fight_duration_total(segments) * 1000),
            'totalDamage': value('damage', 'Total'),
            'heal': value('heal', 'Total'),
            'damageTaken': value('taken', 'Total'),
            'players': {name: {'totalDamage': value('damage', name),
                              'heal': value('heal', name), 'damageTaken': value('taken', name)}
                        for name in sorted(names)},
        }, displayed

    sessions = []
    displays = []
    encounters = []
    breakdown_displays = []
    include_breakdown = args.case_id == 'marrowgar-spell-target-breakdown'
    separator = LogsSeparator(server='Lordaeron', timestamp=datetime(2026, 9, 4, tzinfo=timezone.utc).timestamp())
    for index, raw_slice in enumerate(separator.generate_segments(source.splitlines(keepends=True))):
        report_id = f'{raw_slice.id[:2]}-09-04--12-00--Synthetic{digest[:12]}x{index}--Lordaeron'
        report_dir = Directories.logs / report_id
        # Each capture starts without derived caches from a previous input/run.
        report_dir.mkdir(exist_ok=False)
        (report_dir / FileNames.logs_cut).zstd_write(b'\n'.join(normalize(raw_slice)))
        report = THE_LOGS(report_id, copy_from_backup=False)
        session, display = metrics(report, [[None, None]])
        sessions.append(session)
        displays.append({'duration': report.duration_to_string(report.get_slice_duration(None, None)),
                         'columns': display})
        segments = sorted((s for group in report.SEGMENTS.values() for s in group),
                          key=lambda s: s.start)
        for segment in segments:
            selected = [[segment.start, segment.end]]
            data, _ = metrics(report, selected)
            players = data.pop('players')
            if include_breakdown:
                data['damageBreakdown'] = {}
                raw_breakdown = {}
                for name, player in players.items():
                    if player['totalDamage'] <= 0:
                        continue
                    detail = report.get_numbers_breakdown_wrap(selected, name)
                    targets = {}
                    filtered = {}
                    for category in detail['TARGETS'].values():
                        for guid, target_name in category.items():
                            target = report.get_numbers_breakdown_wrap(selected, name, filter_guid=guid)
                            filtered[guid] = target
                            amount = numeric(target['ACTUAL']['Total'])
                            if amount:
                                if target_name in targets:
                                    raise ValueError('Synthetic target names must be unique for name-keyed comparison.')
                                targets[target_name] = amount
                    spell_amounts = {detail['SPELLS_DATA'][spell]['name']: numeric(amount)
                                     for spell, amount in detail['ACTUAL'].items() if spell != 'Total'}
                    if len(spell_amounts) != len(detail['ACTUAL']) - 1:
                        raise ValueError('Synthetic spell names must be unique for name-keyed comparison.')
                    data['damageBreakdown'][name] = {
                        'spells': spell_amounts,
                        'targets': targets,
                    }
                    raw_breakdown[name] = {'allTargets': detail, 'filteredTargets': filtered}
                breakdown_displays.append(raw_breakdown)
            encounters.append({'name': segment.encounter_name, 'difficulty': segment.difficulty,
                               'outcome': {'kill': 'KILL', 'wipe': 'WIPE'}.get(segment.attempt_type, 'UNKNOWN'), **data})
    result = {
        'author': 'Neil Mitchell', 'modifier': 'Neil Mitchell',
        'evidence': {'kind': 'local-reference', 'sourceSha256': digest,
                     'referenceSha': args.reference_sha,
                     'observedAt': datetime.now(timezone.utc).isoformat(),
                     'pythonVersion': platform.python_version(),
                     'configuration': {'fileYear': 2026, 'archiveTimestamp': '2026-09-04T00:00:00Z', 'realm': 'Lordaeron'},
                     'method': 'Unmodified LogsSeparator, logs_fix.normalize, and THE_LOGS report methods. Archive extraction and publication eligibility are not covered.'},
        'normalized': {'sessions': sessions, 'encounters': encounters},
        'referenceDisplay': {'sessions': displays},
    }
    if include_breakdown:
        result['referenceDisplay']['encounterBreakdowns'] = breakdown_displays
        result['evidence']['method'] += ' Damage detail uses get_numbers_breakdown_wrap, including target filters; values are not recomputed from reference logs.'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
