"""Repeatable end-to-end benchmark for the streamed archive upload protocol.

The generated ZIP contains many bounded Marrowgar attempts and deterministic
high-entropy trailing fields.  This keeps the compressed fixture near the
requested size without creating one unrealistic, memory-heavy encounter.

Run from ``parser/``:
    .venv/Scripts/python benchmarks/benchmark_archive_upload.py --target-mib 30
"""

from __future__ import annotations

import argparse
import asyncio
import ctypes
import json
import os
import random
import shutil
import sys
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402


def _timestamp(total_seconds: int, millis: int = 0) -> str:
    total_seconds %= 24 * 3600
    hour, remainder = divmod(total_seconds, 3600)
    minute, second = divmod(remainder, 60)
    return f"1/1 {hour:02d}:{minute:02d}:{second:02d}.{millis:03d}"


def generate_fixture(path: Path, target_bytes: int) -> int:
    rng = random.Random(20260810)
    attempts = 0
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        with archive.open("WoWCombatLog.TXT", "w", force_zip64=True) as member:
            while path.stat().st_size < target_bytes:
                base = (attempts * 90) % (24 * 3600)
                member.write(f'{_timestamp(base)}  ENCOUNTER_START,1084,"Lord Marrowgar",6,25\n'.encode())
                member.write(
                    f'{_timestamp(base + 1)}  SPELL_DAMAGE,0x0600000000000001,"Benchmark",0x514,'
                    f'0xF130000000000001,"Lord Marrowgar",0xa48,70825,"Coldflame",4,'
                    f'1000,0,4,0,0,0,nil,nil,nil,nil,0,{rng.randbytes(96).hex()}\n'.encode()
                )
                for line_number in range(2500):
                    entropy = rng.randbytes(96).hex()
                    member.write(
                        f'{_timestamp(base + 2 + line_number // 1000, line_number % 1000)}  '
                        f'SPELL_DAMAGE,0x0600000000000001,"Benchmark",0x514,'
                        f'0xF130000000000001,"Lord Marrowgar",0xa48,61491,"Benchmark Strike",1,'
                        f'{1000 + line_number % 500},0,1,0,0,0,nil,nil,nil,nil,0,{entropy}\n'.encode()
                    )
                member.write(
                    f'{_timestamp(base + 60)}  UNIT_DIED,0x0000000000000000,nil,0x80000000,'
                    f'0xF130000000000001,"Lord Marrowgar",0xa48\n'.encode()
                )
                member.write(f'{_timestamp(base + 60, 100)}  ENCOUNTER_END,1084,"Lord Marrowgar",6,25,1\n'.encode())
                attempts += 1
                if attempts > 10_000:
                    raise RuntimeError("Fixture generation failed to converge")
    return attempts


def _working_set_bytes() -> int:
    if os.name == "nt":
        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]
        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        psapi.GetProcessMemoryInfo.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ProcessMemoryCounters),
            ctypes.c_ulong,
        ]
        psapi.GetProcessMemoryInfo.restype = ctypes.c_int
        handle = kernel32.GetCurrentProcess()
        if not psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
            return 0
        return int(counters.WorkingSetSize)
    try:
        pages = int(Path("/proc/self/statm").read_text().split()[1])
        return pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        return 0


class RssSampler:
    def __init__(self) -> None:
        self.start_bytes = _working_set_bytes()
        self.peak_bytes = self.start_bytes
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self._stop.wait(0.01):
            self.peak_bytes = max(self.peak_bytes, _working_set_bytes())

    def __enter__(self) -> "RssSampler":
        self._thread.start()
        return self

    def __exit__(self, *_args: object) -> None:
        self._stop.set()
        self._thread.join()


class FileStreamingRequest:
    def __init__(self, path: Path):
        self.path = path
        self.headers = {"content-length": str(path.stat().st_size)}

    async def stream(self):
        with self.path.open("rb") as fh:
            while chunk := fh.read(8 * 1024 * 1024):
                yield chunk
                await asyncio.sleep(0)


def _events(body: str) -> list[dict]:
    return [
        json.loads(line[6:])
        for line in body.splitlines()
        if line.startswith("data: ")
    ]


async def run_benchmark(target_mib: int, keep_fixture: Path | None) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="pizza-archive-benchmark-") as temp_name:
        temp_dir = Path(temp_name)
        fixture_path = temp_dir / "representative-combat-log.zip"
        attempts = generate_fixture(fixture_path, target_mib * 1024 * 1024)
        compressed_bytes = fixture_path.stat().st_size
        with zipfile.ZipFile(fixture_path) as archive:
            uncompressed_bytes = archive.getinfo("WoWCombatLog.TXT").file_size

        upload_dir = temp_dir / "uploads"
        upload_dir.mkdir()
        original_upload_dir = main.UPLOAD_TEMP_DIR
        main.UPLOAD_TEMP_DIR = upload_dir
        upload_id = str(uuid.uuid4())
        started = time.perf_counter()
        try:
            with RssSampler() as memory:
                response = await main.upload_archive_stream(
                    upload_id,
                    FileStreamingRequest(fixture_path),  # type: ignore[arg-type]
                    "representative-combat-log.zip",
                    2026,
                )
                response_started = time.perf_counter()
                chunks: list[str] = []
                async for chunk in response.body_iterator:
                    chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
                completed = time.perf_counter()
        finally:
            main.UPLOAD_TEMP_DIR = original_upload_dir

        parsed_events = _events("".join(chunks))
        quick = next(event for event in parsed_events if event["type"] == "quick-result")
        done = next(event for event in parsed_events if event["type"] == "done")
        timings = done["data"]["uploadTimings"]
        report: dict[str, object] = {
            "fixture": {
                "compressedBytes": compressed_bytes,
                "uncompressedBytes": uncompressed_bytes,
                "compressionRatio": round(uncompressed_bytes / compressed_bytes, 2),
                "attempts": attempts,
            },
            "networkUploadDurationMs": timings["networkUploadMs"],
            "archiveValidationDurationMs": timings["archiveValidationMs"],
            "quickClassificationDurationMs": timings["quickClassificationMs"],
            "finalByteToQuickClassificationMs": timings["finalByteToQuickResultMs"],
            "fullProcessingDurationMs": timings["fullProcessingMs"],
            "clientUploadCallDurationMs": round((response_started - started) * 1000, 2),
            "clientEndToEndDurationMs": round((completed - started) * 1000, 2),
            "peakWorkingSetMiB": round(memory.peak_bytes / 1024 / 1024, 2),
            "workingSetIncreaseMiB": round((memory.peak_bytes - memory.start_bytes) / 1024 / 1024, 2),
            "quickEncounterCount": len(quick["result"]["encounters"]),
            "fullEncounterCount": len(done["data"]["encounters"]),
            "targetMet": timings["finalByteToQuickResultMs"] <= 2000,
        }
        if keep_fixture:
            keep_fixture.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(fixture_path, keep_fixture)
            report["keptFixture"] = str(keep_fixture)
        return report


def main_cli() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-mib", type=int, default=30)
    parser.add_argument("--keep-fixture", type=Path)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run_benchmark(args.target_mib, args.keep_fixture)), indent=2))


if __name__ == "__main__":
    main_cli()
