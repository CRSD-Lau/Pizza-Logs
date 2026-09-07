import assert from "node:assert/strict";
import { test } from "node:test";
import { ParserResponseError, readBoundedJson, readParserResult, sanitizeParserStatus } from "../lib/parser-transport";
import { parserPayload, testUploadId } from "./helpers/parser-payload";
import { MAX_UPLOAD_BYTES } from "../lib/upload-security";

const encode = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
function stream(value: string, chunkSize = 13) {
  const bytes = new TextEncoder().encode(value);
  let offset = 0;
  let cancelled = false;
  return {
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) { controller.close(); return; }
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
        offset += chunkSize;
      },
      cancel() { cancelled = true; },
    }),
    isCancelled: () => cancelled,
  };
}

test("parser transport validates chunked results and strips arbitrary progress fields", async () => {
  const seen: object[] = [];
  const source = stream(encode({ type: "state", state: "validating", pct: 28, msg: "internal secret", debug: "path" })
    + encode({ type: "done", data: parserPayload() }) + "trailing data");
  const result = await readParserResult(source.body, testUploadId, event => seen.push(event));
  assert.equal(result.encounters[0].durationMs, 30_125);
  assert.deepEqual(seen, [{ type: "state", state: "validating", pct: 28, uploadId: testUploadId, msg: "Validating archive…" }]);
  assert.equal(source.isCancelled(), true);
});

test("parser transport rejects forged completion, truncated streams, oversized events and identity mismatch", async () => {
  for (const input of [
    encode({ type: "complete", result: { uploadId: "forged" } }),
    encode({ type: "done", data: { ...parserPayload(), uploadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }),
    encode({ type: "progress", pct: 30 }),
    "data: {bad json}\n\n",
  ]) {
    await assert.rejects(readParserResult(stream(input).body, testUploadId, () => undefined), ParserResponseError);
  }
  const endless = stream("a".repeat(1_000));
  await assert.rejects(readParserResult(endless.body, testUploadId, () => undefined, { eventBytes: 32, responseBytes: 2_000 }), ParserResponseError);
  assert.equal(endless.isCancelled(), true);
  await assert.rejects(readParserResult(stream(encode({ type: "progress", pct: 30 }).repeat(5)).body,
    testUploadId, () => undefined, { eventBytes: 100, responseBytes: 120 }), ParserResponseError);
});

test("status payloads redact unknown errors and cannot expose arbitrary upstream fields", () => {
  const result = sanitizeParserStatus({
    uploadId: testUploadId, state: "error", createdAt: "2026-09-04T12:00:00Z", updatedAt: "2026-09-04T12:00:01Z",
    errorCode: "PRIVATE_FAILURE", error: "/internal/database/password", debug: "secret",
  }, testUploadId);
  assert.equal(result.error, "Upload processing failed. Please try again.");
  assert.equal(result.errorCode, "PROCESSING_ERROR");
  assert.equal("debug" in result, false);
  assert.throws(() => sanitizeParserStatus({ detail: "private path" }, testUploadId), ParserResponseError);
});

test("parser completion and status accept the upload ceiling and reject one byte over", async () => {
  const status = {
    uploadId: testUploadId, state: "uploading",
    createdAt: "2026-09-07T12:00:00Z", updatedAt: "2026-09-07T12:00:01Z",
  };
  for (const receivedBytes of [101 * 1024 * 1024, MAX_UPLOAD_BYTES]) {
    const payload = { ...parserPayload(), receivedBytes };
    const result = await readParserResult(stream(encode({ type: "done", data: payload })).body, testUploadId, () => undefined);
    assert.equal(result.receivedBytes, receivedBytes);
    assert.equal(sanitizeParserStatus({ ...status, receivedBytes }, testUploadId).receivedBytes, receivedBytes);
  }
  const receivedBytes = MAX_UPLOAD_BYTES + 1;
  await assert.rejects(readParserResult(stream(encode({ type: "done", data: { ...parserPayload(), receivedBytes } })).body,
    testUploadId, () => undefined), ParserResponseError);
  assert.throws(() => sanitizeParserStatus({ ...status, receivedBytes }, testUploadId), ParserResponseError);
});

test("JSON status reader enforces byte limits", async () => {
  assert.deepEqual(await readBoundedJson(stream('{"ok":true}').body, 100), { ok: true });
  await assert.rejects(readBoundedJson(stream('{"value":"too large"}').body, 10), ParserResponseError);
});
