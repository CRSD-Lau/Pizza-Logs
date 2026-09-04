"""Explicit, conservative reference-drift check. Never called by report reads."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

URL = 'https://api.github.com/repos/CRSD-Lau/uwu-logs/commits/main'


def check_reference(pinned_sha: str, cache: Path, opener=urlopen) -> dict:
    previous = {}
    if cache.is_file():
        previous = json.loads(cache.read_text(encoding='utf-8'))
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Pizza-Logs-reference-check/1'}
    if previous.get('url') == URL and previous.get('etag') and previous.get('sha'):
        headers['If-None-Match'] = previous['etag']
    try:
        # The endpoint is fixed HTTPS; callers cannot supply an arbitrary URL.
        with opener(Request(URL, headers=headers), timeout=10) as response:
            body = response.read(1_048_577)
            if len(body) > 1_048_576:
                raise ValueError('GitHub response exceeded the size bound.')
            observed_sha = json.loads(body)['sha']
            etag = response.headers.get('ETag')
    except HTTPError as error:
        if error.code == 304 and 'If-None-Match' in headers:
            observed_sha, etag = previous['sha'], previous['etag']
        else:
            return {'status': 'unavailable', 'reason': f'GitHub HTTP {error.code}', 'pinnedSha': pinned_sha}
    except (URLError, TimeoutError, OSError, ValueError, KeyError):
        return {'status': 'unavailable', 'reason': 'Reference check failed; last observation is not proof of freshness.',
                'pinnedSha': pinned_sha}
    if (not isinstance(observed_sha, str) or len(observed_sha) != 40
            or any(c not in '0123456789abcdef' for c in observed_sha)):
        return {'status': 'unavailable', 'reason': 'GitHub returned an invalid commit.', 'pinnedSha': pinned_sha}
    result = {'author': 'Neil Mitchell', 'modifier': 'Neil Mitchell',
              'status': 'current' if observed_sha == pinned_sha else 'stale',
              'pinnedSha': pinned_sha, 'sha': observed_sha, 'etag': etag, 'url': URL,
              'checkedAt': datetime.now(timezone.utc).isoformat()}
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result
