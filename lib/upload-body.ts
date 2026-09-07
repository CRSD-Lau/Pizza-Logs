import { MAX_UPLOAD_BYTES, UploadRequestError } from "@/lib/upload-security";

/** Count actual bytes while preserving streaming and backpressure. */
export function boundedUploadBody(source: ReadableStream<Uint8Array>, declaredSize: number, signal: AbortSignal) {
  const reader = source.getReader();
  let receivedBytes = 0;
  let finished = false;
  let failure: UploadRequestError | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const cancelSource = () => { void reader.cancel().catch(() => undefined); };
  const abort = () => {
    if (finished) return;
    failure = new UploadRequestError("The upload was cancelled or timed out. Please try again.", 408);
    controller.error(failure);
    cancelSource();
  };
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(value) {
      try {
        const next = await reader.read();
        if (failure) return;
        if (next.done) {
          if (receivedBytes !== declaredSize) throw new UploadRequestError("The uploaded bytes do not match the declared file size.");
          finished = true;
          value.close();
          return;
        }
        receivedBytes += next.value.byteLength;
        if (receivedBytes > MAX_UPLOAD_BYTES) throw new UploadRequestError("File exceeds the 100 MiB compressed upload limit.", 413);
        if (receivedBytes > declaredSize) throw new UploadRequestError("The uploaded bytes do not match the declared file size.");
        value.enqueue(next.value);
      } catch (error) {
        failure = error instanceof UploadRequestError ? error : new UploadRequestError("The upload could not be received. Please try again.");
        value.error(failure);
        cancelSource();
      }
    },
    cancel() { cancelSource(); },
  }, { highWaterMark: 0 });
  return {
    body,
    get error() { return failure; },
    assertComplete(parserBytes?: number) {
      if (failure) throw failure;
      if (!finished || receivedBytes !== declaredSize || (parserBytes !== undefined && parserBytes !== receivedBytes)) {
        throw new UploadRequestError("The uploaded bytes do not match the declared file size.");
      }
      return receivedBytes;
    },
    dispose() {
      signal.removeEventListener("abort", abort);
      cancelSource();
    },
  };
}
