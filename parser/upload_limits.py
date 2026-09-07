"""Bound adversarial encounter shapes before they accumulate in worker memory."""

import json

from archive_upload import ArchiveValidationError


MAX_ENCOUNTER_EVENTS = 500_000
MAX_ENCOUNTER_TEXT_CHARS = 128 * 1024 * 1024
MAX_ENCOUNTERS = 2_000
MAX_SESSIONS = 256
MAX_SESSION_UNIT_ENTRIES = 50_000
MAX_RECENT_DAMAGE_EVENTS = 2_000
MAX_PARSED_DETAIL_BYTES = 64 * 1024 * 1024


class BoundedEventList(list):
    """One unfinished marker/heuristic pull cannot consume the entire upload."""

    def __init__(self, items=()):
        super().__init__()
        self.text_chars = 0
        for item in items:
            self.append(item)

    def append(self, item):
        text_chars = len(item[0]) + sum(map(len, item[1]))
        if len(self) >= MAX_ENCOUNTER_EVENTS or self.text_chars + text_chars > MAX_ENCOUNTER_TEXT_CHARS:
            raise ArchiveValidationError(
                "LOG_COMPLEXITY_LIMIT",
                "One encounter exceeds the supported event or text limits. Split the log into separate raid logs.",
            )
        self.text_chars += text_chars
        super().append(item)


def check_result_count(count: int) -> None:
    if count > MAX_ENCOUNTERS:
        raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "The log contains too many encounters. Split it into separate raid logs.")


def account_parsed_details(value: object, used_bytes: int) -> int:
    # Do not allocate a complete JSON copy merely to enforce the memory budget.
    for chunk in json.JSONEncoder(ensure_ascii=True, allow_nan=False).iterencode(value):
        used_bytes += len(chunk)
        if used_bytes > MAX_PARSED_DETAIL_BYTES:
            raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "The log produces too much report detail. Split it into separate raid logs.")
    return used_bytes
