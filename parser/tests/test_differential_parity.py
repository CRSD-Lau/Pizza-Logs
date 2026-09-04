"""Offline evidence gate: exact claims pass; reviewed mismatches stay visible."""

import hashlib
import json
from io import BytesIO
from urllib.error import HTTPError
from xml.etree.ElementTree import parse

import pytest

from parity.__main__ import PACKAGE, run_suite, verify_regressions, write_reports
from parity.compare import assess_case, compare, difference_fingerprint
from parity.fixtures import case_ids, fixture_bytes
from parity.pizza_adapter import parse_pizza
from parity.reference import URL, check_reference

MANIFEST = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', MANIFEST['cases'], ids=lambda case: case['id'])
def test_exact_claim_or_reviewed_difference_is_reproducible(case):
    source = fixture_bytes(case['id'])
    oracle = json.loads((PACKAGE / 'goldens' / f"{case['id']}.json").read_text(encoding='utf-8'))
    row = assess_case(case['id'], parse_pizza(source), oracle, hashlib.sha256(source).hexdigest(),
                      MANIFEST['reference']['inspectedSha'])
    if case['claim'] == 'exact':
        assert row['status'] == 'exact', row
    else:
        # This is a regression contract, NOT a compatibility pass. A fix also
        # changes this fingerprint and requires review of the evidence.
        assert row['status'] == 'mismatch'
        assert difference_fingerprint(row['differences']) == case['reviewedDifferenceSha256']


def test_every_case_has_matching_input_and_pinned_reference_provenance():
    assert set(case_ids()) == {row['id'] for row in MANIFEST['cases']}
    assert len(MANIFEST['cases']) == len(case_ids())
    for case in MANIFEST['cases']:
        oracle = json.loads((PACKAGE / 'goldens' / f"{case['id']}.json").read_text(encoding='utf-8'))
        assert oracle['evidence']['sourceSha256'] == hashlib.sha256(fixture_bytes(case['id'])).hexdigest()
        assert oracle['evidence']['referenceSha'] == MANIFEST['reference']['inspectedSha']
        assert oracle['evidence']['kind'] == 'local-reference'
        assert oracle['evidence']['observedAt']


@pytest.mark.parametrize(('expected', 'actual'), [
    (1, 1.0000000001), (1, True), (1, '1'),
    ([1, 2], [2, 1]), ({'required': 1}, {}), ({}, {'extra': 1}),
    (float('nan'), float('nan')), (float('inf'), float('inf')),
])
def test_comparator_rejects_numeric_coercion_rounding_missing_fields_and_sort_changes(expected, actual):
    assert compare(expected, actual)


def test_no_floating_tolerance_is_applied_to_integer_primitives():
    assert compare({'amount': 1000}, {'amount': 1000.0}) == []
    assert compare({'amount': 2**53}, {'amount': 2**53 + 1})


def test_missing_or_stale_reference_is_blocked_instead_of_counted_as_exact():
    assert assess_case('test', {}, None, 'input', 'ref')['status'] == 'blocked'
    stale = {'evidence': {'sourceSha256': 'input', 'referenceSha': 'old',
                          'kind': 'local-reference', 'observedAt': '2026-09-04'}, 'normalized': {}}
    assert assess_case('test', {}, stale, 'input', 'new')['status'] == 'blocked'


def test_reports_keep_mismatches_and_unproven_scope_visible(tmp_path):
    report = run_suite()
    assert report['summary'] == {'exactCases': 9, 'toleratedCases': 0, 'mismatchingCases': 11,
                                 'blockedCases': 0, 'blockedSurfaces': 7}
    assert verify_regressions(report) == []
    write_reports(report, tmp_path)
    junit = parse(tmp_path / 'parity.junit.xml').getroot()
    assert junit.attrib['failures'] == '11'
    assert junit.attrib['skipped'] == '7'
    assert 'Complete or live UwU parity is not claimed' in (tmp_path / 'parity.md').read_text()
    assert json.loads((tmp_path / 'parity.json').read_text())['mode'] == 'full-assessment'


def test_regression_gate_rejects_new_or_changed_mismatches():
    result = run_suite()
    result['cases'][0]['status'] = 'mismatch'
    assert verify_regressions(result)
    result = run_suite()
    row = next(row for row in result['cases'] if row['status'] == 'mismatch')
    row['differences'].append({'path': '$.new', 'kind': 'missing-field'})
    assert verify_regressions(result)


def test_offline_suite_does_not_open_network(monkeypatch):
    import socket

    def deny(*_args, **_kwargs):
        raise AssertionError('Offline CI attempted network access')

    monkeypatch.setattr(socket, 'create_connection', deny)
    assert len(run_suite()['cases']) == 20


class Response(BytesIO):
    headers = {'ETag': '"fixture-etag"'}


def test_reference_check_uses_etag_and_detects_new_revision(tmp_path):
    cache = tmp_path / 'reference.json'
    pinned, observed = 'a' * 40, 'b' * 40

    def changed(request, timeout):
        assert request.full_url == URL
        assert timeout == 10
        return Response(json.dumps({'sha': observed}).encode())

    result = check_reference(pinned, cache, opener=changed)
    assert result['status'] == 'stale'

    def unchanged(request, timeout):
        assert request.get_header('If-none-match') == '"fixture-etag"'
        raise HTTPError(URL, 304, 'Not Modified', {}, None)

    assert check_reference(pinned, cache, opener=unchanged)['status'] == 'stale'
    assert check_reference(observed, cache, opener=unchanged)['status'] == 'current'


def test_reference_outage_never_claims_current(tmp_path):
    def unavailable(request, timeout):
        raise HTTPError(URL, 503, 'Unavailable', {}, None)

    assert check_reference('a' * 40, tmp_path / 'cache.json', opener=unavailable)['status'] == 'unavailable'


def test_unknown_synthetic_fixture_cannot_read_arbitrary_files():
    with pytest.raises(ValueError, match='Unknown synthetic case'):
        fixture_bytes('../README.md')
