import assert from "node:assert/strict";
import { test } from "node:test";
import { createUploadAdmission } from "../lib/upload-admission";
import { boundedUploadBody } from "../lib/upload-body";
import { hasTrustedUploadOrigin, MAX_UPLOAD_BYTES, UploadRequestError } from "../lib/upload-security";
import { UploadRequestSchema } from "../lib/schema";

function source(chunks: Uint8Array[]) {
  let cancelled = false;
  return {
    stream: new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }),
    cancelled: () => cancelled,
  };
}

test("web upload admission bounds active work and rolling starts with idempotent release", () => {
  let now = 0;
  const admission = createUploadAdmission({ concurrent: 2, starts: 3, windowMs: 60_000 }, () => now);
  const first = admission.acquire()!;
  const second = admission.acquire()!;
  assert.ok(first && second);
  assert.equal(admission.acquire(), null);
  first.release();
  first.release();
  const third = admission.acquire()!;
  assert.ok(third);
  assert.equal(admission.acquire(), null, "double release must never reduce another upload's active count");
  second.release();
  third.release();
  assert.equal(admission.acquire(), null, "completion does not reset the request budget");
  now = 59_999;
  assert.equal(admission.acquire(), null);
  now = 60_000;
  assert.ok(admission.acquire());
});

test("web counts bytes across chunks, matches parser size, and rejects incomplete consumption", async () => {
  const input = source([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);
  const upload = boundedUploadBody(input.stream, 5, new AbortController().signal);
  assert.throws(() => upload.assertComplete(), UploadRequestError);
  assert.deepEqual(new Uint8Array(await new Response(upload.body).arrayBuffer()), new Uint8Array([1, 2, 3, 4, 5]));
  assert.equal(upload.assertComplete(5), 5);
  assert.throws(() => upload.assertComplete(4), UploadRequestError);
  upload.dispose();
});

test("web streams the full 1 GiB ceiling without buffering the file", async () => {
  const chunk = new Uint8Array(1024 * 1024);
  const input = source(Array<Uint8Array>(MAX_UPLOAD_BYTES / chunk.byteLength).fill(chunk));
  const upload = boundedUploadBody(input.stream, MAX_UPLOAD_BYTES, new AbortController().signal);
  const reader = upload.body.getReader();
  let received = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    received += next.value.byteLength;
  }
  assert.equal(received, 1024 ** 3);
  assert.equal(upload.assertComplete(received), received);
  upload.dispose();
});

test("web rejects chunked overflow, truncation and physical bytes over the ceiling", async () => {
  for (const item of [
    { chunks: [new Uint8Array(3), new Uint8Array(3)], declared: 5, status: 400 },
    { chunks: [new Uint8Array(3)], declared: 5, status: 400 },
    // Reuse a small allocation; the counter must enforce cumulative physical bytes.
    { chunks: [...Array<Uint8Array>(MAX_UPLOAD_BYTES / (1024 * 1024)).fill(new Uint8Array(1024 * 1024)), new Uint8Array(1)], declared: MAX_UPLOAD_BYTES + 1, status: 413 },
  ]) {
    const input = source(item.chunks);
    const upload = boundedUploadBody(input.stream, item.declared, new AbortController().signal);
    const reader = upload.body.getReader();
    await assert.rejects(async () => { while (!(await reader.read()).done) { /* consume without buffering */ } },
      (error: unknown) => error instanceof UploadRequestError && error.status === item.status);
    assert.throws(() => upload.assertComplete(), UploadRequestError);
    upload.dispose();
  }
});

test("abort interrupts a stalled body read and cancels the source", async () => {
  const cancellation = new AbortController();
  let cancelled = false;
  const input = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const upload = boundedUploadBody(input, 5, cancellation.signal);
  const read = upload.body.getReader().read();
  cancellation.abort();
  await assert.rejects(read, UploadRequestError);
  assert.equal(cancelled, true);
  assert.throws(() => upload.assertComplete(), UploadRequestError);
  upload.dispose();
});

test("upload metadata permits ordinary names and rejects controls, invisible formatting and markup", () => {
  assert.equal(UploadRequestSchema.parse({ uploaderName: "  Neil  ", guildName: "L'Armée & Friends" }).uploaderName, "Neil");
  for (const field of ["uploaderName", "guildName", "realmName", "realmHost"]) {
    for (const value of [" ", "foo\0bar", "foo\r\nbar", "\nNeil\n", "foo\u202ebar", "<script>alert(1)</script>"]) {
      assert.equal(UploadRequestSchema.safeParse({ uploaderName: "Neil", [field]: value }).success, false, `${field}: ${JSON.stringify(value)}`);
    }
  }
});

test("upload origins use configured origin instead of spoofable host and forwarded headers", () => {
  const before = process.env.ADMIN_AUTH_URL;
  process.env.ADMIN_AUTH_URL = "https://logs.example.test";
  try {
    assert.equal(hasTrustedUploadOrigin(new Headers()), true, "explicit-policy non-browser clients are supported");
    assert.equal(hasTrustedUploadOrigin(new Headers({ origin: "https://logs.example.test", "sec-fetch-site": "same-origin" })), true);
    for (const origin of ["null", "https://evil.example.test", "https://logs.example.test.evil.test", "http://logs.example.test"]) {
      assert.equal(hasTrustedUploadOrigin(new Headers({ origin, host: "evil.example.test", "x-forwarded-host": "evil.example.test" })), false);
    }
    for (const fetchSite of ["cross-site", "same-site"]) {
      assert.equal(hasTrustedUploadOrigin(new Headers({ "sec-fetch-site": fetchSite })), false);
    }
  } finally {
    if (before === undefined) delete process.env.ADMIN_AUTH_URL;
    else process.env.ADMIN_AUTH_URL = before;
  }
});
