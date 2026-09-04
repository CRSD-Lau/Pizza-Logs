"""Keep upload admission and temporary files owned until workers really stop."""

from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import threading
from pathlib import Path
from typing import Callable, TypeVar

from fastapi.responses import StreamingResponse


logger = logging.getLogger("pizza_logs.parser")
_active_paths: set[Path] = set()
_active_paths_lock = threading.Lock()
T = TypeVar("T")


def active_upload_paths() -> set[Path]:
    with _active_paths_lock:
        return set(_active_paths)


class UploadLease:
    """A response timeout cancels work cooperatively, not the owning lease.

    Python cannot forcibly stop a running thread. Hold admission and its files
    until the underlying concurrent futures finish; cancel queued work outright.
    """

    def __init__(self, slots: asyncio.Semaphore, *paths: Path,
                 on_finish: Callable[[], None] | None = None):
        self._slots = slots
        self._paths = paths
        self._loop = asyncio.get_running_loop()
        self._loop_thread = threading.get_ident()
        self._futures: list[concurrent.futures.Future] = []
        self._lock = threading.Lock()
        self._finished = False
        self._released = False
        self.cancel_event = threading.Event()
        self._on_finish = on_finish
        with _active_paths_lock:
            _active_paths.update(paths)

    async def run(self, executor: concurrent.futures.Executor,
                  function: Callable[..., T], *args: object, timeout: float) -> T:
        future = executor.submit(function, *args)
        self._futures.append(future)
        future.add_done_callback(lambda _: self._release_if_finished())
        wrapped = asyncio.wrap_future(future)
        # A late worker failure is consumed even when its HTTP request timed out.
        wrapped.add_done_callback(lambda result: None if result.cancelled() else result.exception())
        done, _ = await asyncio.wait((wrapped,), timeout=timeout)
        if not done:
            raise TimeoutError("Upload worker timed out")
        return wrapped.result()

    def finish(self) -> None:
        self.cancel_event.set()
        if not self._finished and self._on_finish is not None:
            self._on_finish()
        self._finished = True
        for future in self._futures:
            future.cancel()
        self._release_if_finished()

    def _release_if_finished(self) -> None:
        with self._lock:
            if self._released or not self._finished or any(not item.done() for item in self._futures):
                return
            self._released = True
        for path in self._paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Upload temporary-file cleanup deferred")
        with _active_paths_lock:
            _active_paths.difference_update(self._paths)
        if threading.get_ident() == self._loop_thread:
            self._slots.release()
        elif not self._loop.is_closed():
            try:
                self._loop.call_soon_threadsafe(self._slots.release)
            except RuntimeError:
                # The process/event loop is shutting down, so no new admission
                # is possible. File cleanup above still completed.
                pass


class UploadStreamingResponse(StreamingResponse):
    """Finalize even if ASGI disconnects before it starts iterating the body."""

    def __init__(self, *args, lease: UploadLease, **kwargs):
        super().__init__(*args, **kwargs)
        self._lease = lease

    async def __call__(self, scope, receive, send) -> None:
        try:
            await super().__call__(scope, receive, send)
        finally:
            self._lease.finish()
