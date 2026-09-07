import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { UPLOAD_POLICY_HEADER, UPLOAD_POLICY_VERSION } from "../lib/upload-policy";
import { MAX_UPLOAD_BYTES } from "../lib/upload-security";
import { parserPayload, testUploadId } from "./helpers/parser-payload";

test("public upload boundary rejects abuse before parser/database access and validates complete streaming", async context => {
  const loader = Module as typeof Module & {
    _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = loader._resolveFilename;
  const originalFetch = global.fetch;
  const originalOrigin = process.env.ADMIN_AUTH_URL;
  const effects: string[] = [];
  const stored: { fileSize: number }[] = [];
  const mocks = new Map<string, object>([
    ["@/lib/db", { db: {} }],
    ["@/lib/actions/milestones", { computeMilestones: async () => { effects.push("milestones"); return []; } }],
    ["@/lib/upload-persistence", {
      IncompleteStoredUploadError: class extends Error {},
      persistParsedUpload: async (_db: unknown, input: { fileSize: number }) => {
        effects.push("persist"); stored.push(input);
        return { result: { uploadId: "stored", status: "DONE" }, milestoneChecks: [] };
      },
    }],
  ]);
  const mockPaths = new Map(Array.from(mocks.keys(), (request, index) => [request, path.join(process.cwd(), "tests", "__mocks__", `upload-security-${index}.js`)]));
  const routePath = require.resolve("../app/api/upload/route");
  const preserved = new Map([routePath, ...mockPaths.values()].map(filename => [filename, require.cache[filename]]));
  loader._resolveFilename = function resolveMock(request, parent, isMain, options) {
    const mockPath = mockPaths.get(request);
    if (mockPath) return mockPath;
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (resolved) return originalResolve.call(this, resolved, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  for (const [request, exports] of mocks) {
    const filename = mockPaths.get(request)!;
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
  }
  delete require.cache[routePath];
  process.env.ADMIN_AUTH_URL = "https://logs.example.test";

  type RequestOverrides = { headers?: Record<string, string | null>; params?: Record<string, string>; bytes?: number; signal?: AbortSignal };
  function request(overrides: RequestOverrides = {}) {
    const headers = new Headers({ "content-type": "application/octet-stream", "x-upload-id": testUploadId, [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION });
    for (const [name, value] of Object.entries(overrides.headers ?? {})) {
      if (value === null) headers.delete(name); else headers.set(name, value);
    }
    const params = new URLSearchParams({ filename: "synthetic.txt", fileSize: "5", uploaderName: "Neil", ...overrides.params });
    let pulled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { pulled = true; controller.enqueue(new Uint8Array(overrides.bytes ?? 5)); controller.close(); },
    }, { highWaterMark: 0 });
    return {
      value: new NextRequest(`https://logs.example.test/api/upload?${params}`, { method: "POST", headers, body, duplex: "half", signal: overrides.signal } as ConstructorParameters<typeof NextRequest>[1]),
      pulled: () => pulled,
    };
  }
  try {
    const { POST } = require("../app/api/upload/route") as typeof import("../app/api/upload/route");
    global.fetch = async () => { effects.push("fetch"); throw new Error("An invalid request reached the parser."); };
    const invalid: { input: RequestOverrides; status: number }[] = [
      { input: { headers: { [UPLOAD_POLICY_HEADER]: null } }, status: 428 },
      { input: { headers: { [UPLOAD_POLICY_HEADER]: "old-policy" } }, status: 428 },
      { input: { headers: { origin: "https://evil.example.test" } }, status: 403 },
      { input: { headers: { "sec-fetch-site": "cross-site" } }, status: 403 },
      { input: { headers: { "content-encoding": "gzip" } }, status: 400 },
      { input: { headers: { "content-length": "4" } }, status: 400 },
      { input: { params: { fileSize: "0" } }, status: 400 },
      { input: { params: { fileSize: String(MAX_UPLOAD_BYTES + 1) } }, status: 413 },
      { input: { params: { uploaderName: "<script>" } }, status: 400 },
      { input: { params: { filename: "malware.exe" } }, status: 400 },
    ];
    for (const { input, status } of invalid) {
      await context.test(`rejects ${JSON.stringify(input)}`, async () => {
        effects.length = 0;
        const req = request(input);
        const response = await POST(req.value);
        assert.equal(response.status, status);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(req.pulled(), false, "rejection must happen before body consumption");
        assert.deepEqual(effects, [], "no parser/database/milestone work");
      });
    }

    await context.test("exact bytes flow once and parser-observed length must match before persistence", async () => {
      let reportedBytes = 4;
      global.fetch = async (_url, init) => {
        effects.push("fetch");
        assert.equal(init?.redirect, "error");
        const bytes = await new Response(init?.body).arrayBuffer();
        assert.equal(bytes.byteLength, 5);
        const payload = { ...parserPayload(), receivedBytes: reportedBytes };
        return new Response(`data: ${JSON.stringify({ type: "done", data: payload })}\n\n`);
      };
      effects.length = 0;
      const mismatch = await POST(request().value);
      assert.match(await mismatch.text(), /"type":"error"/);
      assert.deepEqual(effects, ["fetch"]);
      reportedBytes = 5;
      effects.length = 0;
      const valid = await POST(request().value);
      assert.match(await valid.text(), /"type":"complete"/);
      assert.deepEqual(effects, ["fetch", "persist"]);
      assert.equal(stored[0].fileSize, 5);
    });

    await context.test("lying chunked bodies never reach persistence", async () => {
      for (const bytes of [4, 6]) {
        effects.length = 0;
        const response = await POST(request({ bytes }).value);
        assert.match(await response.text(), /"type":"error"/);
        assert.deepEqual(effects, ["fetch"]);
      }
    });

    await context.test("active upload admission rejects a fifth request regardless of forwarded IP headers", async () => {
      effects.length = 0;
      const finish: ((response: Response) => void)[] = [];
      global.fetch = async () => {
        effects.push("fetch");
        return new Promise<Response>(resolve => finish.push(resolve));
      };
      const active = [];
      for (let index = 0; index < 4; index += 1) {
        active.push(await POST(request({ headers: { "x-forwarded-for": `192.0.2.${index}` } }).value));
      }
      const excess = request({ headers: { "x-forwarded-for": "198.51.100.99" } });
      const rejected = await POST(excess.value);
      assert.equal(rejected.status, 429);
      assert.equal(rejected.headers.get("retry-after"), "60");
      assert.equal(excess.pulled(), false);
      assert.deepEqual(effects, ["fetch", "fetch", "fetch", "fetch"]);
      finish.forEach(resolve => resolve(new Response(null, { status: 429 })));
      for (const response of active) assert.match(await response.text(), /"type":"error"/);
    });

    await context.test("disconnect after parsing cannot begin persistence", async () => {
      effects.length = 0;
      const cancellation = new AbortController();
      global.fetch = async (_url, init) => {
        effects.push("fetch");
        await new Response(init?.body).arrayBuffer();
        cancellation.abort();
        return new Response(`data: ${JSON.stringify({ type: "done", data: { ...parserPayload(), receivedBytes: 5 } })}\n\n`);
      };
      const response = await POST(request({ signal: cancellation.signal }).value);
      assert.match(await response.text(), /"type":"error"/);
      assert.deepEqual(effects, ["fetch"]);
    });
  } finally {
    loader._resolveFilename = originalResolve;
    global.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.ADMIN_AUTH_URL;
    else process.env.ADMIN_AUTH_URL = originalOrigin;
    for (const [filename, previous] of preserved) {
      if (previous) require.cache[filename] = previous;
      else delete require.cache[filename];
    }
  }
});
