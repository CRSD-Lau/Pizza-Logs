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
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterator, TextIO

from combat_log_events import parse_combat_log_line


MIB = 1024 * 1024
MAX_COMPRESSED_BYTES = int(os.getenv("UPLOAD_MAX_COMPRESSED_BYTES", str(100 * MIB)))
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
    def __init__(self, raw, cancel_event: threading.Event | None = None):
        super().__init__(raw, encoding="utf-8-sig", errors="replace", newline="")
        self._cancel_event = cancel_event

    def readline(self, size: int = -1) -> str:
        if self._cancel_event is not None and self._cancel_event.is_set():
            raise TimeoutError("Combat-log reading was cancelled")
        limit = MAX_COMBAT_LOG_LINE_CHARS + 1
        line = super().readline(min(size, limit) if size >= 0 else limit)
        if len(line) > MAX_COMBAT_LOG_LINE_CHARS:
            raise ArchiveValidationError("LINE_LENGTH_LIMIT", "A combat-log line exceeds the supported length.")
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
        and "\x00" not in normalized
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
    try:
        with open_combat_log(path, selection, cancel_event) as fh:
            for _ in range(2048):
                line = fh.readline()
                if not line:
                    break
                if parse_combat_log_line(line).line is not None:
                    return
    except TimeoutError:
        raise
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError) as exc:
        raise ArchiveValidationError("INVALID_ARCHIVE", "The ZIP archive is damaged or unreadable.") from exc
    raise ArchiveValidationError(
        "NO_USABLE_COMBAT_LOG",
        "The selected text file does not contain recognizable WoW combat-log lines.",
    )


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
            if not _safe_member_name(info.filename):
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
            total_uncompressed += info.file_size
            total_compressed += info.compress_size
            member_ratio = _ratio(info.file_size, info.compress_size)
            if member_ratio > MAX_COMPRESSION_RATIO:
                raise ArchiveValidationError("COMPRESSION_RATIO_LIMIT", "An archive member exceeds the compression-ratio limit.")
            if member_suffix == ".txt" and not info.is_dir():
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
                "The archive does not contain a .txt combat log (case-insensitive).",
            )
        for chosen in sorted(candidates, key=lambda item: item.file_size, reverse=True):
            selection = ArchiveSelection(
                format="zip",
                member_name=chosen.filename,
                compressed_bytes=compressed_bytes,
                uncompressed_bytes=chosen.file_size,
                member_count=len(infos),
                compression_ratio=total_ratio,
            )
            try:
                _assert_usable_combat_log(path, selection, cancel_event)
                return selection
            except ArchiveValidationError as exc:
                if exc.code != "NO_USABLE_COMBAT_LOG":
                    raise
        raise ArchiveValidationError(
            "NO_USABLE_COMBAT_LOG",
            "No .txt member contains recognizable WoW combat-log lines.",
        )
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

    _assert_usable_combat_log(path, selection, cancel_event)
    return selection


@contextmanager
def open_combat_log(path: Path, selection: ArchiveSelection,
                    cancel_event: threading.Event | None = None) -> Iterator[TextIO]:
    """Open the selected member as a streaming text reader without extraction."""
    if selection.format == "text":
        with path.open("rb") as raw, _CombatLogReader(raw, cancel_event) as fh:
            yield fh
        return

    with zipfile.ZipFile(path, "r") as archive:
        with archive.open(selection.member_name, "r") as raw:
            with _CombatLogReader(raw, cancel_event) as text:
                yield text
