"""Strict structural comparator; missing observations never become passes."""

from __future__ import annotations

import math
import hashlib
import json
from typing import Any


def compare(expected: Any, actual: Any, path: str = '$') -> list[dict]:
    differences: list[dict] = []
    if isinstance(expected, dict) and isinstance(actual, dict):
        for key in sorted(expected.keys() | actual.keys()):
            child = f'{path}.{key}'
            if key not in expected:
                differences.append({'path': child, 'kind': 'unexpected-field', 'actual': actual[key]})
            elif key not in actual:
                differences.append({'path': child, 'kind': 'missing-field', 'expected': expected[key]})
            else:
                differences.extend(compare(expected[key], actual[key], child))
    elif isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            differences.append({'path': path, 'kind': 'length', 'expected': len(expected), 'actual': len(actual)})
        for i, (left, right) in enumerate(zip(expected, actual)):
            differences.extend(compare(left, right, f'{path}[{i}]'))
    elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if (not isinstance(actual, (int, float)) or isinstance(actual, bool)
                or not math.isfinite(expected) or not math.isfinite(actual)
                or expected != actual):
            differences.append({'path': path, 'kind': 'numeric', 'expected': expected, 'actual': actual})
    elif type(expected) is not type(actual) or expected != actual:
        differences.append({'path': path, 'kind': 'value', 'expected': expected, 'actual': actual})
    return differences


def assess_case(case_id: str, actual: dict, oracle: dict | None,
                input_sha256: str, reference_sha: str) -> dict:
    row = {'id': case_id, 'inputSha256': input_sha256, 'actual': actual}
    if oracle is None:
        return row | {'status': 'blocked', 'reason': 'No independently captured reference output.'}
    evidence = oracle.get('evidence', {})
    if (evidence.get('sourceSha256') != input_sha256
            or evidence.get('referenceSha') != reference_sha
            or evidence.get('kind') not in {'local-reference', 'live-reference'}
            or not evidence.get('observedAt')):
        return row | {'status': 'blocked', 'reason': 'Reference provenance does not match this input and revision.'}
    differences = compare(oracle['normalized'], actual)
    return row | {'status': 'mismatch' if differences else 'exact',
                  'differences': differences, 'evidence': evidence}


def difference_fingerprint(differences: list[dict]) -> str:
    """Freeze a reviewed failure, without making that failure a parity pass."""
    data = json.dumps(differences, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(data.encode()).hexdigest()
