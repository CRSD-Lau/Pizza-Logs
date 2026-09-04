"""Run with `cd parser; python -m parity run --output-dir <outside-repo>`.

Full comparisons exit nonzero for any mismatch or blocked scope. `--claimed-only`
is the narrower offline regression gate for the explicitly named exact cases.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from version import ANALYTICS_PROFILE, METRIC_SCHEMA_VERSION, PARSER_VERSION

from parity.compare import assess_case, difference_fingerprint
from parity.fixtures import fixture_bytes
from parity.pizza_adapter import parse_pizza
from parity.reference import check_reference

PACKAGE = Path(__file__).resolve().parent


def run_suite(claimed_only: bool = False) -> dict:
    manifest = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))
    rows = []
    for case in manifest['cases']:
        if claimed_only and case['claim'] != 'exact':
            continue
        source = fixture_bytes(case['id'])
        oracle_path = PACKAGE / 'goldens' / f"{case['id']}.json"
        oracle = json.loads(oracle_path.read_text(encoding='utf-8')) if oracle_path.is_file() else None
        rows.append(assess_case(case['id'], parse_pizza(source, damage_breakdown=case.get('damageBreakdown', False)), oracle,
                                hashlib.sha256(source).hexdigest(), manifest['reference']['inspectedSha'])
                    | {'claim': case['claim'], 'scope': case.get('scope', case.get('reason')),
                       'disposition': case.get('disposition'), 'nextEvidence': case.get('nextEvidence')})
    blocked = [] if claimed_only else manifest['blockedSurfaces']
    return {
        'schemaVersion': manifest['schemaVersion'], 'author': 'Neil Mitchell', 'modifier': 'Neil Mitchell',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'parserVersion': PARSER_VERSION, 'metricSchemaVersion': METRIC_SCHEMA_VERSION,
        'analyticsProfile': ANALYTICS_PROFILE,
        'compatibilityVersion': manifest['compatibilityVersion'],
        'referenceSha': manifest['reference']['inspectedSha'],
        'liveReferenceVersion': manifest['reference']['liveVersion'],
        'mode': 'claimed-cases-only' if claimed_only else 'full-assessment',
        'summary': {'exactCases': sum(row['status'] == 'exact' for row in rows),
                    'toleratedCases': 0,
                    'mismatchingCases': sum(row['status'] == 'mismatch' for row in rows),
                    'blockedCases': sum(row['status'] == 'blocked' for row in rows),
                    'blockedSurfaces': len(blocked)},
        'cases': rows, 'blockedSurfaces': blocked,
        'confidence': 'Only the named synthetic numerical cases are demonstrated. Complete or live UwU parity is not claimed.',
    }


def verify_regressions(result: dict) -> list[str]:
    manifest = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))
    cases = {case['id']: case for case in manifest['cases']}
    errors = []
    for row in result['cases']:
        expected = cases[row['id']]
        if expected['claim'] == 'exact' and row['status'] != 'exact':
            errors.append(f"{row['id']}: claimed numerical compatibility regressed.")
        elif expected['claim'] == 'difference' and (
            row['status'] != 'mismatch'
            or difference_fingerprint(row['differences']) != expected.get('reviewedDifferenceSha256')
        ):
            errors.append(f"{row['id']}: reviewed mismatch changed; inspect and review the new differential evidence.")
    return errors


def xml_element(name: str, attributes: dict, body: str = '') -> str:
    """Serialize only; no XML parser or external entities are involved."""
    attrs = ' '.join(f'{key}="{escape(str(value), quote=True)}"' for key, value in attributes.items())
    return f'<{name} {attrs}>{body}</{name}>'


def write_reports(result: dict, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / 'parity.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    summary = result['summary']
    tests = []
    for row in result['cases']:
        body = ''
        if row['status'] == 'mismatch':
            body = xml_element('failure', {'message': 'Exact comparison differs'}, escape(json.dumps(row['differences'])))
        elif row['status'] == 'blocked':
            body = xml_element('skipped', {'message': row['reason']})
        tests.append(xml_element('testcase', {'classname': 'uwu.parity', 'name': row['id']}, body))
    for blocked in result['blockedSurfaces']:
        tests.append(xml_element('testcase', {'classname': 'uwu.unproven', 'name': blocked['surface']},
                                 xml_element('skipped', {'message': blocked['reason']})))
    metadata = xml_element('properties', {}, ''.join(
        xml_element('property', {'name': key, 'value': 'Neil Mitchell'}) for key in ('author', 'modifier')
    ))
    suite = xml_element('testsuite', {'name': 'UwU differential parity', 'tests': len(tests),
                                     'failures': summary['mismatchingCases'],
                                     'skipped': summary['blockedCases'] + summary['blockedSurfaces']}, metadata + ''.join(tests))
    (output / 'parity.junit.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n' + suite, encoding='utf-8')
    lines = ['# UwU differential parity', '', 'Author: Neil Mitchell', 'Modifier: Neil Mitchell', '',
             f"Reference: `{result['referenceSha']}`. Parser: `{result['parserVersion']}`.", '',
             result['confidence'], '',
             (f"Mode: **{result['mode']}**. Exact cases: **{summary['exactCases']}**; "
              f"mismatching cases: **{summary['mismatchingCases']}**; tolerated cases: **0**."), '',
             '| Case | Result | Disposition | Evidence scope |', '|---|---|---|---|']
    for row in result['cases']:
        lines.append(f"| {row['id']} | {row['status']} | {row['disposition'] or 'observed-exact'} | {row['scope']} |")
    for row in result['cases']:
        if row['status'] == 'mismatch':
            lines.extend(['', f"## Differences: {row['id']}", '', '```json',
                          json.dumps(row['differences'], indent=2), '```'])
            lines.extend(['', f"Disposition: **{row['disposition']}**. {row['nextEvidence']}"])
    lines.extend(['', '## Blocked scope', ''])
    lines.extend(f"- **{item['surface']}**: {item['reason']}" for item in result['blockedSurfaces'])
    (output / 'parity.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    if 'regressionErrors' in result:
        tests = []
        for row in result['cases']:
            errors = [error for error in result['regressionErrors'] if error.startswith(f"{row['id']}:")]
            body = xml_element('failure', {'message': errors[0]}) if errors else ''
            tests.append(xml_element('testcase', {'classname': 'uwu.regression', 'name': row['id']}, body))
        regression = xml_element('testsuite', {'name': 'Parity regression contracts', 'tests': len(tests),
                                              'failures': len(result['regressionErrors'])}, metadata + ''.join(tests))
        (output / 'regression.junit.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n' + regression, encoding='utf-8')


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest='command', required=True)
    run = commands.add_parser('run')
    run.add_argument('--output-dir', type=Path, required=True)
    run.add_argument('--claimed-only', action='store_true')
    verify = commands.add_parser('verify', help='Verify exact claims and freeze reviewed mismatches; does not assert full parity.')
    verify.add_argument('--output-dir', type=Path, required=True)
    drift = commands.add_parser('check-reference')
    drift.add_argument('--cache', type=Path, required=True)
    export = commands.add_parser('export-inputs')
    export.add_argument('--output-dir', type=Path, required=True)
    args = cli.parse_args()
    manifest = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))
    if args.command == 'check-reference':
        result = check_reference(manifest['reference']['inspectedSha'], args.cache)
        print(json.dumps(result, indent=2))
        return {'current': 0, 'stale': 2, 'unavailable': 3}[result['status']]
    if args.command == 'export-inputs':
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for case in manifest['cases']:
            (args.output_dir / f"{case['id']}.txt").write_bytes(fixture_bytes(case['id']))
        return 0
    result = run_suite(getattr(args, 'claimed_only', False))
    if args.command == 'verify':
        result['regressionErrors'] = verify_regressions(result)
        result['regressionStatus'] = 'failed' if result['regressionErrors'] else 'passed'
        result['parityStatus'] = 'incomplete'
    write_reports(result, args.output_dir)
    print(json.dumps(result['summary'], indent=2))
    if args.command == 'verify':
        print(json.dumps({'regressionStatus': result['regressionStatus'], 'parityStatus': result['parityStatus'],
                          'errors': result['regressionErrors']}, indent=2))
        return int(bool(result['regressionErrors']))
    return int(any(result['summary'][key] for key in ('mismatchingCases', 'blockedCases', 'blockedSurfaces')))


if __name__ == '__main__':
    raise SystemExit(main())
