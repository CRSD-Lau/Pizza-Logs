"""Safe archive inspection and streaming combat-log access.

Archives are never extracted to the filesystem.  Only the selected text member
is streamed through ``ZipFile.open`` and wrapped as text.
"""

from __future__ import annotations

import io
import os
import re
import threading
import zipfile
from contextlib import contextmanager
from dataclasses import dataclass, replace
from pathlib import Path, PurePosixPath
from typing import Iterator, TextIO

from combat_log_events import parse_combat_log_line


MIB = 1024 * 1024
MAX_COMPRESSED_BYTES = int(os.getenv("UPLOAD_MAX_COMPRESSED_BYTES", str(1024 * MIB)))
MAX_UNCOMPRESSED_BYTES = int(os.getenv("UPLOAD_MAX_UNCOMPRESSED_BYTES", str(1024 * MIB)))
MAX_ARCHIVE_MEMBERS = int(os.getenv("UPLOAD_MAX_ARCHIVE_MEMBERS", "32"))
MAX_COMPRESSION_RATIO = float(os.getenv("UPLOAD_MAX_COMPRESSION_RATIO", "200"))
MAX_ARCHIVE_METADATA_BYTES = int(os.getenv("UPLOAD_MAX_ARCHIVE_METADATA_BYTES", str(MIB)))
MAX_COMBAT_LOG_LINE_CHARS = int(os.getenv("UPLOAD_MAX_LINE_CHARS", str(64 * 1024)))
ALLOWED_SUFFIXES = frozenset({".txt", ".log", ".zip"})
NESTED_ARCHIVE_SUFFIXES = frozenset({
    ".zip", ".7z", ".rar", ".tar", ".gz", ".gzip", ".bz2", ".xz", ".lzma",
})
ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
SUPPORTED_ZIP_METHODS = frozenset({zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED})
MAX_LOG_RECORDS = 5_000_000
MAX_LOG_UNITS = 50_000
MAX_LOG_FIELDS = 64
MAX_LOG_FIELD_CHARS = 1024
MAX_LOG_NAMES = 50_000
MAX_LOG_SPELLS = 10_000
MAX_LOG_ACTOR_SPELL_PAIRS = 100_000
INVALID_TEXT_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
# A timestamp and arbitrary CSV alone are not evidence of a WoW combat log.
# Keep the full WotLK combat event vocabulary, including events not aggregated.
COMBAT_EVENTS = frozenset({
    "SWING_DAMAGE", "SWING_MISSED", "RANGE_DAMAGE", "RANGE_MISSED",
    "SPELL_DAMAGE", "SPELL_MISSED", "SPELL_HEAL", "SPELL_ENERGIZE",
    "SPELL_DRAIN", "SPELL_LEECH", "SPELL_INTERRUPT", "SPELL_EXTRA_ATTACKS",
    "SPELL_DISPEL", "SPELL_DISPEL_FAILED", "SPELL_STOLEN",
    "SPELL_AURA_APPLIED", "SPELL_AURA_REMOVED", "SPELL_AURA_APPLIED_DOSE",
    "SPELL_AURA_REMOVED_DOSE", "SPELL_AURA_REFRESH", "SPELL_AURA_BROKEN",
    "SPELL_AURA_BROKEN_SPELL", "SPELL_CAST_START", "SPELL_CAST_SUCCESS",
    "SPELL_CAST_FAILED", "SPELL_CREATE", "SPELL_SUMMON", "SPELL_RESURRECT",
    "SPELL_INSTAKILL", "SPELL_DURABILITY_DAMAGE", "SPELL_DURABILITY_DAMAGE_ALL",
    "SPELL_PERIODIC_DAMAGE", "SPELL_PERIODIC_MISSED", "SPELL_PERIODIC_HEAL",
    "SPELL_PERIODIC_ENERGIZE", "SPELL_PERIODIC_DRAIN", "SPELL_PERIODIC_LEECH",
    "SPELL_BUILDING_DAMAGE", "SPELL_BUILDING_HEAL", "SPELL_HEAL_ABSORBED",
    "DAMAGE_SHIELD", "DAMAGE_SHIELD_MISSED", "DAMAGE_SPLIT",
    "ENVIRONMENTAL_DAMAGE", "UNIT_DIED", "UNIT_DESTROYED", "PARTY_KILL",
    "UNIT_DISSIPATES", "ENCHANT_APPLIED", "ENCHANT_REMOVED",
})
METADATA_EVENTS = {
    "ENCOUNTER_START": 5, "ENCOUNTER_END": 6,
    "ZONE_CHANGE": 3, "MAP_CHANGE": 3, "COMBAT_LOG_VERSION": 3,
}
UNIT_GUID_RE = re.compile(r"(?:0x[0-9a-fA-F]{1,16}|(?:Player|Creature|Pet|Vehicle|GameObject)-[A-Za-z0-9-]{1,80}|nil)")
UNIT_FLAGS_RE = re.compile(r"(?:0x[0-9a-fA-F]{1,16}|[0-9]{1,10}|nil)")
INTEGER_RE = re.compile(r"-?[0-9]{1,16}")


def _has_combat_payload(parts: list[str]) -> bool:
    """Require the fields consumed by the supported metric primitives."""
    event = parts[0]
    if event in {"UNIT_DIED", "UNIT_DESTROYED", "UNIT_DISSIPATES", "PARTY_KILL"}:
        return True
    if event in {"ENCHANT_APPLIED", "ENCHANT_REMOVED"}:
        return True
    if event.startswith(("SPELL_", "RANGE_")) or event in {"DAMAGE_SHIELD", "DAMAGE_SHIELD_MISSED", "DAMAGE_SPLIT"}:
        if len(parts) < 10 or not INTEGER_RE.fullmatch(parts[7]):
            return False
    if event in {"SPELL_DAMAGE", "SPELL_PERIODIC_DAMAGE", "SPELL_BUILDING_DAMAGE", "RANGE_DAMAGE", "DAMAGE_SHIELD", "DAMAGE_SPLIT"}:
        return len(parts) >= 17 and all(INTEGER_RE.fullmatch(parts[index]) for index in (10, 11, 14, 15))
    if event == "SWING_DAMAGE":
        return len(parts) >= 14 and all(INTEGER_RE.fullmatch(parts[index]) for index in (7, 8, 11, 12))
    if event in {"SPELL_HEAL", "SPELL_PERIODIC_HEAL", "SPELL_BUILDING_HEAL"}:
        return len(parts) >= 14 and all(INTEGER_RE.fullmatch(parts[index]) for index in (10, 11, 12))
    if event == "ENVIRONMENTAL_DAMAGE":
        return len(parts) >= 15 and all(INTEGER_RE.fullmatch(parts[index]) for index in (8, 9, 12, 13))
    if event in {"SPELL_ENERGIZE", "SPELL_PERIODIC_ENERGIZE", "SPELL_DRAIN", "SPELL_LEECH", "SPELL_PERIODIC_DRAIN", "SPELL_PERIODIC_LEECH"}:
        return len(parts) >= 12 and INTEGER_RE.fullmatch(parts[10]) is not None
    return len(parts) >= 8


class ArchiveValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class _ZipMetadataReader(io.BufferedReader):
    """Reject oversized directory reads before ZipFile materializes entries."""

    def read(self, size: int = -1) -> bytes:
        if size < 0 or size > MAX_ARCHIVE_METADATA_BYTES:
            raise ArchiveValidationError("ARCHIVE_METADATA_LIMIT", "The ZIP directory metadata exceeds the limit.")
        return super().read(size)


class _CombatLogReader(io.TextIOWrapper):
    def __init__(self, raw, cancel_event: threading.Event | None = None,
                 encoding: str = "utf-8-sig"):
        super().__init__(raw, encoding=encoding, errors="strict", newline="")
        self._cancel_event = cancel_event

    def readline(self, size: int = -1) -> str:
        if self._cancel_event is not None and self._cancel_event.is_set():
            raise TimeoutError("Combat-log reading was cancelled")
        limit = MAX_COMBAT_LOG_LINE_CHARS + 1
        line = super().readline(min(size, limit) if size >= 0 else limit)
        if len(line) > MAX_COMBAT_LOG_LINE_CHARS:
            raise ArchiveValidationError("LINE_LENGTH_LIMIT", "A combat-log line exceeds the supported length.")
        if INVALID_TEXT_CONTROL_RE.search(line):
            raise ArchiveValidationError("INVALID_TEXT_CONTENT", "Combat logs must contain plain text without binary control characters.")
        return line

    def __next__(self) -> str:
        line = self.readline()
        if not line:
            raise StopIteration
        return line


@dataclass(frozen=True)
class ArchiveSelection:
    format: str
    member_name: str
    compressed_bytes: int
    uncompressed_bytes: int
    member_count: int
    compression_ratio: float
    encoding: str = "utf-8-sig"

    def as_dict(self) -> dict[str, object]:
        return {
            "format": self.format,
            "memberName": self.member_name,
            "compressedBytes": self.compressed_bytes,
            "uncompressedBytes": self.uncompressed_bytes,
            "memberCount": self.member_count,
            "compressionRatio": round(self.compression_ratio, 2),
        }


def _safe_member_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    return (
        bool(normalized)
        and not INVALID_TEXT_CONTROL_RE.search(normalized)
        and not re.match(r"^[A-Za-z]:", normalized)
        and not path.is_absolute()
        and ".." not in path.parts
    )


def _ratio(uncompressed: int, compressed: int) -> float:
    if uncompressed <= 0:
        return 0.0
    if compressed <= 0:
        return float("inf")
    return uncompressed / compressed


def _assert_usable_combat_log(path: Path, selection: ArchiveSelection,
                            cancel_event: threading.Event | None = None) -> None:
    record_count = 0
    combat_lines = 0
    units: set[str] = set()
    names: set[str] = set()
    spells: set[str] = set()
    actor_spells: set[tuple[str, str]] = set()
    try:
        with open_combat_log(path, selection, cancel_event) as fh:
            for line in fh:
                record_count += 1
                if record_count > MAX_LOG_RECORDS:
                    raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "The combat log contains too many records. Split it into separate raid logs.")
                if not line.strip():
                    continue
                parsed = parse_combat_log_line(line, strict=True).line
                recognized = False
                if parsed is not None:
                    parts = parsed.parts
                    if len(parts) > MAX_LOG_FIELDS or any(len(part) > MAX_LOG_FIELD_CHARS for part in parts):
                        raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "Combat-log fields exceed the supported complexity limits.")
                    event = parts[0]
                    if event in COMBAT_EVENTS and len(parts) >= 7:
                        # Enchant records use a different layout; they remain
                        # recognized without treating item names as actor GUIDs.
                        recognized = _has_combat_payload(parts) and (
                            event in {"ENCHANT_APPLIED", "ENCHANT_REMOVED"} or (
                                all(UNIT_GUID_RE.fullmatch(parts[index]) for index in (1, 4))
                                and all(UNIT_FLAGS_RE.fullmatch(parts[index]) for index in (3, 6))
                            )
                        )
                        if recognized:
                            combat_lines += 1
                            if event not in {"ENCHANT_APPLIED", "ENCHANT_REMOVED"}:
                                if any(len(parts[index]) > 256 for index in (2, 5)):
                                    raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "Combat-log names exceed the supported length.")
                                units.update((parts[1], parts[4]))
                                names.update((parts[2], parts[5]))
                                if len(parts) >= 10 and (event.startswith(("SPELL_", "RANGE_")) or event in {"DAMAGE_SHIELD", "DAMAGE_SHIELD_MISSED", "DAMAGE_SPLIT"}):
                                    if len(parts[8]) > 256:
                                        raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "Combat-log names exceed the supported length.")
                                    spells.add(parts[8])
                                    actor_spells.update(((parts[2], parts[8]), (parts[5], parts[8])))
                                if (len(units) > MAX_LOG_UNITS or len(names) > MAX_LOG_NAMES
                                        or len(spells) > MAX_LOG_SPELLS or len(actor_spells) > MAX_LOG_ACTOR_SPELL_PAIRS):
                                    raise ArchiveValidationError("LOG_COMPLEXITY_LIMIT", "The combat log contains too many distinct units. Split it into separate raid logs.")
                    elif event in METADATA_EVENTS:
                        recognized = len(parts) >= METADATA_EVENTS[event]
                if not recognized:
                    raise ArchiveValidationError("INVALID_LOG_CONTENT", "Every nonblank line must be a supported WoW combat-log record. Upload an unmodified log after recording has stopped.")
    except TimeoutError:
        raise
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError) as exc:
        raise ArchiveValidationError("INVALID_ARCHIVE", "The ZIP archive is damaged or unreadable.") from exc
    if combat_lines == 0:
        raise ArchiveValidationError(
            "NO_USABLE_COMBAT_LOG",
            "The selected text file does not contain recognizable WoW combat-log events.",
        )


def _validate_text_encoding(path: Path, selection: ArchiveSelection,
                            cancel_event: threading.Event | None) -> ArchiveSelection:
    # Older Windows clients may write CP1252 character names. Decode the whole
    # file consistently, never silently replace invalid bytes in public names.
    for encoding in ("utf-8-sig", "cp1252"):
        candidate = replace(selection, encoding=encoding)
        try:
            _assert_usable_combat_log(path, candidate, cancel_event)
            return candidate
        except UnicodeDecodeError:
            continue
    raise ArchiveValidationError("INVALID_TEXT_ENCODING", "Combat logs must use UTF-8 or Windows-1252 text encoding.")


def validate_upload(path: Path, original_filename: str,
                    cancel_event: threading.Event | None = None) -> ArchiveSelection:
    """Validate allowlisted format, magic bytes and archive resource limits."""
    suffix = Path(original_filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise ArchiveValidationError(
            "UNSUPPORTED_FORMAT",
            "Supported uploads are .txt, .log, and .zip files.",
        )
    compressed_bytes = path.stat().st_size
    if compressed_bytes <= 0:
        raise ArchiveValidationError("EMPTY_UPLOAD", "The uploaded file is empty.")
    if compressed_bytes > MAX_COMPRESSED_BYTES:
        raise ArchiveValidationError(
            "COMPRESSED_SIZE_LIMIT",
            f"The upload exceeds the {MAX_COMPRESSED_BYTES // MIB} MiB compressed-size limit.",
        )

    with path.open("rb") as fh:
        magic = fh.read(8)

    if suffix == ".zip":
        if not any(magic.startswith(prefix) for prefix in ZIP_MAGIC):
            raise ArchiveValidationError("MAGIC_MISMATCH", "The file extension is .zip but the ZIP magic bytes are missing.")
        try:
            with _ZipMetadataReader(path.open("rb", buffering=0)) as bounded:
                with zipfile.ZipFile(bounded, "r") as archive:
                    infos = archive.infolist()
        except (zipfile.BadZipFile, OSError) as exc:
            raise ArchiveValidationError("INVALID_ARCHIVE", "The ZIP archive is damaged or unreadable.") from exc

        if len(infos) > MAX_ARCHIVE_MEMBERS:
            raise ArchiveValidationError(
                "MEMBER_COUNT_LIMIT",
                f"The archive contains more than {MAX_ARCHIVE_MEMBERS} entries.",
            )
        if not infos:
            raise ArchiveValidationError("NO_USABLE_COMBAT_LOG", "The archive contains no files.")

        total_uncompressed = 0
        total_compressed = 0
        candidates: list[zipfile.ZipInfo] = []
        member_names: set[str] = set()
        for info in infos:
            if cancel_event is not None and cancel_event.is_set():
                raise TimeoutError("Archive validation was cancelled")
            # These methods support bounded reads in Python's ZipExtFile. Other
            # codecs may materialize output before the reader applies its limit.
            if info.compress_type not in SUPPORTED_ZIP_METHODS:
                raise ArchiveValidationError(
                    "UNSUPPORTED_COMPRESSION",
                    "ZIP members must use stored or deflate compression.",
                )
            if not _safe_member_name(info.orig_filename):
                raise ArchiveValidationError("UNSAFE_MEMBER_PATH", "The archive contains an unsafe member path.")
            normalized_name = info.filename.replace("\\", "/")
            if normalized_name in member_names:
                raise ArchiveValidationError("DUPLICATE_MEMBER", "Duplicate archive member names are not accepted.")
            member_names.add(normalized_name)
            member_suffix = Path(info.filename).suffix.lower()
            if member_suffix in NESTED_ARCHIVE_SUFFIXES:
                raise ArchiveValidationError("NESTED_ARCHIVE", "Nested archives are not accepted.")
            if info.flag_bits & 0x1:
                raise ArchiveValidationError("ENCRYPTED_ARCHIVE", "Encrypted archive members are not accepted.")
            unix_type = (info.external_attr >> 16) & 0o170000
            if unix_type == 0o120000:
                raise ArchiveValidationError("SYMLINK_MEMBER", "Archive symlinks are not accepted.")
            if unix_type not in (0, 0o100000, 0o040000):
                raise ArchiveValidationError("UNSUPPORTED_ARCHIVE_MEMBER", "ZIP archives may contain only one regular .txt or .log file and folders.")
            if ((info.is_dir() and (info.file_size != 0 or unix_type == 0o100000))
                    or (not info.is_dir() and unix_type == 0o040000)):
                raise ArchiveValidationError("UNSUPPORTED_ARCHIVE_MEMBER", "Archive folders must be empty directory entries; only the combat log may contain data.")
            if not info.is_dir() and member_suffix not in {".txt", ".log"}:
                raise ArchiveValidationError("UNSUPPORTED_ARCHIVE_MEMBER", "ZIP archives may contain only one .txt or .log file and folders.")
            total_uncompressed += info.file_size
            total_compressed += info.compress_size
            member_ratio = _ratio(info.file_size, info.compress_size)
            if member_ratio > MAX_COMPRESSION_RATIO:
                raise ArchiveValidationError("COMPRESSION_RATIO_LIMIT", "An archive member exceeds the compression-ratio limit.")
            if member_suffix in {".txt", ".log"} and not info.is_dir():
                candidates.append(info)

        if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
            raise ArchiveValidationError(
                "UNCOMPRESSED_SIZE_LIMIT",
                f"The archive exceeds the {MAX_UNCOMPRESSED_BYTES // MIB} MiB uncompressed-size limit.",
            )
        total_ratio = _ratio(total_uncompressed, total_compressed)
        if total_ratio > MAX_COMPRESSION_RATIO:
            raise ArchiveValidationError("COMPRESSION_RATIO_LIMIT", "The archive exceeds the compression-ratio limit.")
        if not candidates:
            raise ArchiveValidationError(
                "NO_USABLE_COMBAT_LOG",
                "The archive does not contain a .txt or .log combat log (case-insensitive).",
            )
        if len(candidates) != 1:
            raise ArchiveValidationError("MULTIPLE_COMBAT_LOGS", "ZIP archives must contain exactly one combat log. Upload each log separately.")
        chosen = candidates[0]
        selection = ArchiveSelection(
            format="zip",
            member_name=chosen.filename,
            compressed_bytes=compressed_bytes,
            uncompressed_bytes=chosen.file_size,
            member_count=len(infos),
            compression_ratio=total_ratio,
        )
        return _validate_text_encoding(path, selection, cancel_event)
    else:
        if any(magic.startswith(prefix) for prefix in ZIP_MAGIC):
            raise ArchiveValidationError("MAGIC_MISMATCH", "ZIP data must use a .zip filename.")
        if compressed_bytes > MAX_UNCOMPRESSED_BYTES:
            raise ArchiveValidationError("UNCOMPRESSED_SIZE_LIMIT", "The text file exceeds the uncompressed-size limit.")
        selection = ArchiveSelection(
            format="text",
            member_name=Path(original_filename).name,
            compressed_bytes=compressed_bytes,
            uncompressed_bytes=compressed_bytes,
            member_count=1,
            compression_ratio=1.0,
        )

    return _validate_text_encoding(path, selection, cancel_event)


@contextmanager
def open_combat_log(path: Path, selection: ArchiveSelection,
                    cancel_event: threading.Event | None = None) -> Iterator[TextIO]:
    """Open the selected member as a streaming text reader without extraction."""
    if selection.format == "text":
        with path.open("rb") as raw, _CombatLogReader(raw, cancel_event, selection.encoding) as fh:
            yield fh
        return

    with zipfile.ZipFile(path, "r") as archive:
        with archive.open(selection.member_name, "r") as raw:
            with _CombatLogReader(raw, cancel_event, selection.encoding) as text:
                yield text
