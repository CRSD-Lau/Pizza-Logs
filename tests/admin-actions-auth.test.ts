import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import type { AdminSession } from "../lib/admin-auth";

const ORIGIN = "https://logs.example.test";

test("admin mutation entrypoints require a trusted origin and a full MFA session", async context => {
  const moduleLoader = Module as typeof Module & {
    _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = moduleLoader._resolveFilename;
  const originalOrigin = process.env.ADMIN_AUTH_URL;
  const originalFetch = global.fetch;
  const effects: string[] = [];
  let currentHeaders = new Headers();
  let fullSession = false;
  let guardCalls = 0;
  const now = new Date();
  const authenticated: AdminSession = {
    user: { id: "synthetic-admin", email: "pizza-admin-e2e@example.test", name: "Synthetic Admin", twoFactorEnabled: true },
    session: { id: "synthetic-session", userId: "synthetic-admin", createdAt: now, expiresAt: new Date(now.getTime() + 60_000), mfaVerifiedAt: now },
  };
  const mutation = (name: string, result: unknown = { count: 1 }) => async () => {
    effects.push(name);
    return result;
  };
  const mocks = new Map<string, object>([
    ["next/headers", { headers: async () => currentHeaders }],
    ["next/cache", { revalidatePath: (route: string) => { effects.push(`revalidate:${route}`); } }],
    ["@/lib/admin-auth", {
      getAdminSession: async (requestHeaders: Headers) => {
        assert.ok(requestHeaders instanceof Headers);
        guardCalls += 1;
        return fullSession ? authenticated : null;
      },
    }],
    ["@/lib/db", { db: {
      weeklySummary: { deleteMany: mutation("weeklySummary.deleteMany") },
      upload: { deleteMany: mutation("upload.deleteMany"), delete: mutation("upload.delete") },
      encounter: { findMany: mutation("encounter.findMany", []), deleteMany: mutation("encounter.deleteMany") },
      milestone: { deleteMany: mutation("milestone.deleteMany") },
      participant: { deleteMany: mutation("participant.deleteMany") },
      armoryGearCache: { deleteMany: mutation("armoryGearCache.deleteMany", { count: 7 }) },
    } }],
    ["@/lib/warmane-guild-roster", {
      DEFAULT_GUILD_NAME: "Synthetic Guild",
      DEFAULT_GUILD_REALM: "Synthetic Realm",
      syncGuildRoster: mutation("syncGuildRoster", { ok: true, count: 5 }),
    }],
  ]);
  const mockPaths = new Map(Array.from(mocks.keys(), (request, index) => [
    request, path.join(process.cwd(), "tests", "__mocks__", `admin-actions-auth-${index}.js`),
  ]));
  const actionPath = require.resolve("../app/admin/actions");
  const rosterPath = require.resolve("../app/api/guild-roster/sync/route");
  const preservedModules = new Map([actionPath, rosterPath, ...mockPaths.values()].map(filename => [filename, require.cache[filename]]));

  moduleLoader._resolveFilename = function resolveMock(request, parent, isMain, options) {
    const mockPath = mockPaths.get(request);
    if (mockPath) return mockPath;
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(candidate => fs.existsSync(candidate));
      if (resolved) return originalResolve.call(this, resolved, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  for (const [request, exports] of mocks) {
    const filename = mockPaths.get(request)!;
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
  }
  delete require.cache[actionPath];
  delete require.cache[rosterPath];
  process.env.ADMIN_AUTH_URL = ORIGIN;
  global.fetch = async () => {
    effects.push("fetch");
    throw new Error("No upstream request is allowed in this test.");
  };

  try {
    const actions = require("../app/admin/actions") as typeof import("../app/admin/actions");
    const { POST } = require("../app/api/guild-roster/sync/route") as typeof import("../app/api/guild-roster/sync/route");
    const requests = [
      () => actions.clearDatabase(),
      () => actions.deleteUpload("synthetic-upload"),
      () => actions.clearArmoryGearCache(),
      () => actions.syncGuildRosterFromAdmin(),
    ];
    const legacyHeaders = { "x-admin-secret": "synthetic-legacy-secret", cookie: "pizza-logs-admin-session=synthetic-legacy-cookie" };
    const rosterRequest = (headers: Headers, body = JSON.stringify({ secret: "synthetic-legacy-secret", adminSecret: "synthetic-legacy-secret", force: true })) => new NextRequest(`${ORIGIN}/api/guild-roster/sync`, {
      method: "POST", headers: new Headers({ ...Object.fromEntries(headers), "content-type": "application/json" }), body,
    });

    for (const origin of [undefined, "null", "https://evil.example.test", "https://logs.example.test.evil.test", "http://logs.example.test"]) {
      await context.test(`rejects ${origin ?? "missing"} origin even with a full session`, async () => {
        effects.length = 0;
        guardCalls = 0;
        fullSession = true;
        currentHeaders = new Headers(legacyHeaders);
        if (origin !== undefined) currentHeaders.set("origin", origin);
        for (const request of requests) assert.deepEqual(await request(), { ok: false, error: "Unauthorized" });
        const response = await POST(rosterRequest(currentHeaders));
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized." });
        assert.equal(guardCalls, 0, "Untrusted origins must be rejected before session/database lookup");
        assert.deepEqual(effects, [], "Unauthorized calls must perform no reads, writes, sync or cache invalidation");
      });
    }

    await context.test("rejects a trusted origin without a full session, including legacy header/body credentials", async () => {
      effects.length = 0;
      guardCalls = 0;
      fullSession = false;
      currentHeaders = new Headers({ ...legacyHeaders, origin: ORIGIN });
      for (const request of requests) assert.deepEqual(await request(), { ok: false, error: "Unauthorized" });
      assert.equal((await POST(rosterRequest(currentHeaders))).status, 401);
      assert.equal((await POST(rosterRequest(currentHeaders, "not-json"))).status, 401, "Authorization must precede body parsing");
      assert.equal(guardCalls, 6);
      assert.deepEqual(effects, []);
    });

    await context.test("fails closed when the configured admin origin is absent", async () => {
      effects.length = 0;
      fullSession = true;
      currentHeaders = new Headers({ origin: ORIGIN });
      delete process.env.ADMIN_AUTH_URL;
      try {
        assert.deepEqual(await actions.clearDatabase(), { ok: false, error: "Unauthorized" });
        assert.equal((await POST(rosterRequest(currentHeaders))).status, 401);
        assert.deepEqual(effects, []);
      } finally {
        process.env.ADMIN_AUTH_URL = ORIGIN;
      }
    });

    await context.test("allows a trusted full-session request to reach only the chosen mocked cache action", async () => {
      effects.length = 0;
      fullSession = true;
      currentHeaders = new Headers({ origin: ORIGIN });
      assert.deepEqual(await actions.clearArmoryGearCache(), { ok: true, deleted: 7 });
      assert.deepEqual(effects, ["armoryGearCache.deleteMany", "revalidate:/admin"]);
    });
  } finally {
    global.fetch = originalFetch;
    moduleLoader._resolveFilename = originalResolve;
    if (originalOrigin === undefined) delete process.env.ADMIN_AUTH_URL;
    else process.env.ADMIN_AUTH_URL = originalOrigin;
    for (const [filename, saved] of preservedModules) {
      if (saved) require.cache[filename] = saved;
      else delete require.cache[filename];
    }
  }
});
