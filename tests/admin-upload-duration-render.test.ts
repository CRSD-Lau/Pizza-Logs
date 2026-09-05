import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const encounter = (id: string, sessionIndex: number, durationMs: number | null, durationSeconds: number, totalDamage = 2_000) => ({
  id, sessionIndex, durationMs, durationSeconds, totalDamage,
  outcome: "KILL", difficulty: "25N",
  startedAt: new Date("2026-01-02T01:02:03Z"), endedAt: new Date("2026-01-02T01:04:03Z"),
  boss: { name: "Synthetic Boss", slug: "synthetic-boss", raid: "Synthetic Raid" },
});
let encounters = [encounter("first", 0, 61_500, 1), encounter("second", 0, 60_500, 60)];
let authorized = false;
const db = { upload: { findUnique: async (query: { include: { encounters: { select: Record<string, boolean> } } }) => {
  assert.equal(authorized, true, "The private detail query must follow the admin guard");
  assert.equal(query.include.encounters.select.durationMs, true, "Read precise duration evidence as well as legacy seconds");
  assert.equal(query.include.encounters.select.durationSeconds, true);
  return {
    id: "synthetic-upload", filename: "synthetic-duration.txt", publicSlug: "synthetic-duration",
    realm: null, guild: null, fileSize: 0, rawLineCount: 0, status: "DONE",
    createdAt: new Date("2026-01-02T01:02:03Z"), sessionAnalytics: null, encounters,
  };
} } };

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const dbPath = path.join(process.cwd(), "tests", "__mocks__", "admin-duration-db.js");
  const guardPath = path.join(process.cwd(), "tests", "__mocks__", "admin-duration-guard.js");
  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbPath;
    if (request === "@/lib/require-admin") return guardPath;
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { db } } as NodeModule;
  require.cache[guardPath] = { id: guardPath, filename: guardPath, loaded: true, exports: { requireAdmin: async () => { authorized = true; } } } as NodeModule;
  try {
    const { default: Page } = require("../app/admin/uploads/[id]/page") as typeof import("../app/admin/uploads/[id]/page");
    const render = async () => {
      authorized = false;
      return renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "synthetic-upload" }) }));
    };
    const precise = await render();
    assert.equal((precise.match(/>2:02</g) ?? []).length, 2, "Upload and session totals must sum milliseconds before formatting");
    assert.match(precise, /4,000/);
    assert.doesNotMatch(precise, /Unavailable/);

    encounters = [encounter("legacy", 0, 0, 45), encounter("legacy-null", 0, null, 30)];
    const legacy = await render();
    assert.equal((legacy.match(/>1:15</g) ?? []).length, 2, "Known legacy seconds remain available without milliseconds");

    encounters = [encounter("unknown", 0, 0, 0), encounter("known-same-session", 0, 30_000, 30), encounter("known-other-session", 1, 45_000, 45)];
    const mixed = await render();
    assert.equal((mixed.match(/>Unavailable</g) ?? []).length, 2, "An unknown pull invalidates its session and upload time, while another complete session remains available");
    assert.equal((mixed.match(/>0:45</g) ?? []).length, 1);
    assert.doesNotMatch(mixed, />0:30<|>1:15</, "Never display a partial aggregate as complete active time");
    assert.match(mixed, /6,000/);
    assert.match(mixed, /3 kills/);

    encounters = [encounter("unknown-only", 0, 0, 0)];
    const unknown = await render();
    assert.equal((unknown.match(/>Unavailable</g) ?? []).length, 2);
    assert.doesNotMatch(unknown, />0:00</);
    assert.match(unknown, /One or more pull durations unavailable/);

    encounters = [];
    const empty = await render();
    assert.match(empty, /No encounters found/);
    assert.match(empty, />0:00</, "An empty sum is a known zero, unlike an encounter whose duration is unknown");
    assert.doesNotMatch(empty, />Unavailable</);
  } finally {
    loader._resolveFilename = originalResolve;
    delete require.cache[dbPath];
    delete require.cache[guardPath];
  }
  console.log("admin upload duration render tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
