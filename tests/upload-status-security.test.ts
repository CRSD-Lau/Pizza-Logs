import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../app/api/upload/status/[uploadId]/route";
import { testUploadId } from "./helpers/parser-payload";

test("status proxy bounds fan-out and releases every upstream request without following redirects", async () => {
  const originalFetch = global.fetch;
  const finish: ((response: Response) => void)[] = [];
  let requests = 0;
  const request = new NextRequest("https://logs.example.test/api/upload/status/synthetic");
  const context = { params: Promise.resolve({ uploadId: testUploadId }) };
  global.fetch = async (_url, init) => {
    requests += 1;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return new Promise<Response>(resolve => finish.push(resolve));
  };
  try {
    const malformed = await GET(request, { params: Promise.resolve({ uploadId: "../../private" }) });
    assert.equal(malformed.status, 400);
    assert.equal(requests, 0);
    const active = Array.from({ length: 8 }, () => GET(request, context));
    const excess = await GET(request, context);
    assert.equal(excess.status, 429);
    assert.equal(excess.headers.get("retry-after"), "60");
    assert.equal(requests, 8);
    finish.forEach(resolve => resolve(new Response(null, { status: 404 })));
    for (const response of await Promise.all(active)) assert.equal(response.status, 404);
    global.fetch = async () => {
      requests += 1;
      return Response.json({
        uploadId: testUploadId, state: "uploading", createdAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z",
        debug: "private", receivedBytes: 1,
      });
    };
    const response = await GET(request, context);
    assert.equal(response.status, 200, "completed requests release active admission");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal("debug" in await response.json(), false);
  } finally {
    global.fetch = originalFetch;
  }
});
