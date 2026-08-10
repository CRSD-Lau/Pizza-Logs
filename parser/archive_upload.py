"""Safe archive inspection and streaming combat-log access.

Archives are never extracted to the filesystem.  Only the selected text member
is streamed through ``ZipFile.open`` and wrapped as text.
"""

from __future__ import annotations

import os
import re
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
ALLOWED_SUFFIXES = frozenset({".txt", ".log", ".zip"})
NESTED_ARCHIVE_SUFFIXES = frozenset({
    ".zip", ".7z", ".rar", ".tar", ".gz", ".gzip", ".bz2", ".xz", ".lzma",
})
ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")


class ArchiveValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


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


def _assert_usable_combat_log(path: Path, selection: ArchiveSelection) -> None:
    try:
        with open_combat_log(path, selection) as fh:
            for _ in range(2048):
                line = fh.readline()
                if not line:
                    break
                if parse_combat_log_line(line).line is not None:
                    return
    except (zipfile.BadZipFile, RuntimeError, OSError) as exc:
        raise ArchiveValidationError("INVALID_ARCHIVE", "The ZIP archive is damaged or unreadable.") from exc
    raise ArchiveValidationError(
        "NO_USABLE_COMBAT_LOG",
        "The selected text file does not contain recognizable WoW combat-log lines.",
    )


def validate_upload(path: Path, original_filename: str) -> ArchiveSelection:
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
            with zipfile.ZipFile(path, "r") as archive:
                infos = [info for info in archive.infolist() if not info.is_dir()]
        except (zipfile.BadZipFile, OSError) as exc:
            raise ArchiveValidationError("INVALID_ARCHIVE", "The ZIP archive is damaged or unreadable.") from exc

        if len(infos) > MAX_ARCHIVE_MEMBERS:
            raise ArchiveValidationError(
                "MEMBER_COUNT_LIMIT",
                f"The archive contains more than {MAX_ARCHIVE_MEMBERS} files.",
            )
        if not infos:
            raise ArchiveValidationError("NO_USABLE_COMBAT_LOG", "The archive contains no files.")

        total_uncompressed = 0
        total_compressed = 0
        candidates: list[zipfile.ZipInfo] = []
        for info in infos:
            if not _safe_member_name(info.filename):
                raise ArchiveValidationError("UNSAFE_MEMBER_PATH", "The archive contains an unsafe member path.")
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
            if member_suffix == ".txt":
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
                _assert_usable_combat_log(path, selection)
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
        selection = ArchiveSelection(
            format="text",
            member_name=Path(original_filename).name,
            compressed_bytes=compressed_bytes,
            uncompressed_bytes=compressed_bytes,
            member_count=1,
            compression_ratio=1.0,
        )

    _assert_usable_combat_log(path, selection)
    return selection


@contextmanager
def open_combat_log(path: Path, selection: ArchiveSelection) -> Iterator[TextIO]:
    """Open the selected member as a streaming text reader without extraction."""
    if selection.format == "text":
        with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as fh:
            yield fh
        return

    with zipfile.ZipFile(path, "r") as archive:
        with archive.open(selection.member_name, "r") as raw:
            import io

            with io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="") as text:
                yield text
