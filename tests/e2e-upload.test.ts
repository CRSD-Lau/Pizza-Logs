import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import { localTestBase, syntheticCombatLog, uploadSyntheticLog } from "../scripts/e2e-upload.mjs";

test("generated E2E upload preserves the canonical synthetic combat fixture", async () => {
  const fixture = await readFile("parser/tests/fixtures/icc-25n-synthetic/combatlog.txt", "utf8");
  assert.equal(syntheticCombatLog().toString(), fixture.replaceAll("\r\n", "\n"));
});

test("E2E upload targets accept only credential-free HTTP loopback URLs", () => {
  for (const value of ["http://127.0.0.1:3000", "https://localhost:3000", "http://[::1]:3000"]) {
    assert.equal(localTestBase(value).origin, value);
  }
  for (const value of ["https://example.com", "http://localhost.example.com", "file:///tmp/test", "ftp://localhost", "http://user:pass@localhost"]) {
    assert.throws(() => localTestBase(value), /isolated loopback/);
  }
});

test("E2E uploads send synthetic bytes once and reject redirect forwarding", async () => {
  const requests: { path: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ path: request.url ?? "", body: Buffer.concat(chunks).toString() });
    const filename = new URL(request.url ?? "/", "http://localhost").searchParams.get("filename");
    if (filename?.startsWith("redirect-")) {
      response.writeHead(Number(filename.slice(9)), { location: "/redirected" });
      response.end();
    } else {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end('data: {"type":"complete","result":{"uploadId":"synthetic"}}\n\n');
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = new URL(`http://127.0.0.1:${address.port}`);
    const bytes = syntheticCombatLog();
    assert.deepEqual(await uploadSyntheticLog(base, bytes), { uploadId: "synthetic" });
    for (const status of [301, 302, 303, 307, 308]) {
      await assert.rejects(uploadSyntheticLog(base, bytes, `redirect-${status}`), /fetch failed/);
    }
    assert.equal(requests.length, 6);
    assert.ok(requests.every(request => request.path.startsWith("/api/upload?") && request.body === bytes.toString()));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
