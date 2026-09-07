import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { ArmorySectionData } from "../lib/armory-profile";

type Stored = { payload?: ArmorySectionData; fetchedAt?: Date; lastAttemptAt: Date };
type Key = { characterKey: string; realm: string; sectionKey: string };
const rows = new Map<string, Stored>();
let knownPlayer = true;
const keyOf = (key: Key) => JSON.stringify(key);
const db = {
  armoryProfileCache: {
    findUnique: async ({ where }: { where: { characterKey_realm_sectionKey: Key } }) => rows.get(keyOf(where.characterKey_realm_sectionKey)) ?? null,
    upsert: async ({ where, create, update }: { where: { characterKey_realm_sectionKey: Key }; create: Partial<Stored>; update: Partial<Stored> }) => {
      const key = keyOf(where.characterKey_realm_sectionKey);
      rows.set(key, { lastAttemptAt: new Date(), ...(rows.has(key) ? { ...rows.get(key), ...update } : create) });
    },
  },
  player: { findFirst: async ({ where }: { where: { OR: unknown[] } }) => {
    assert.ok(JSON.stringify(where.OR).includes("Lordaeron"), "Known-player check remains realm scoped");
    return knownPlayer ? { name: "Mothrmonster" } : null;
  } },
  guildRosterMember: { findFirst: async () => null },
};

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename, originalFetch = globalThis.fetch;
  const mockPath = path.resolve("tests/armory-profile-db.mock.js");
  loader._resolveFilename = function (request, parent, isMain, options) {
    if (request === "@/lib/db" || (request === "./db" && parent?.filename.endsWith("armory-profile.server.ts"))) return mockPath;
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[mockPath] = { id: mockPath, filename: mockPath, loaded: true, exports: { db } } as NodeModule;
  let requests = 0;
  const fixture = readFileSync("tests/fixtures/armory/talents.html", "utf8");
  try {
    const { getArmoryProfileSection, fetchArmorySection } = require("../lib/armory-profile.server") as typeof import("../lib/armory-profile.server");
    globalThis.fetch = async (_, init) => { requests++; assert.equal(init?.redirect, "error"); assert.ok(init?.signal); return new Response(fixture); };
    const [first, coalesced] = await Promise.all([
      getArmoryProfileSection("Mothrmonster", "Lordaeron", "talents"), getArmoryProfileSection("mothrmonster", "lordaeron", "talents"),
    ]);
    assert.equal(requests, 1, "Concurrent lookups share one bounded request");
    assert.deepEqual(first, coalesced);
    assert.equal(first.data?.specs.length, 2);
    await getArmoryProfileSection("Mothrmonster", "Lordaeron", "talents");
    assert.equal(requests, 1, "Fresh cache performs no network request");
    const key = keyOf({ characterKey: "mothrmonster", realm: "lordaeron", sectionKey: "v1:talents:summary" });
    const saved = rows.get(key)!;
    saved.fetchedAt = new Date("2026-01-01T00:00:00Z"); saved.lastAttemptAt = saved.fetchedAt;
    for (const failure of ["http", "network", "wrong-character", "oversized"]) {
      saved.lastAttemptAt = new Date(0);
      rows.set(key, saved);
      globalThis.fetch = async () => {
        requests++;
        if (failure === "network") throw new Error("offline");
        if (failure === "http") return new Response("Unavailable", { status: 503 });
        return new Response(failure === "oversized" ? "x".repeat(2 * 1024 * 1024 + 1) : fixture.replaceAll("Mothrmonster", "Another"));
      };
      const fallback = await getArmoryProfileSection("Mothrmonster", "Lordaeron", "talents");
      assert.equal(fallback.stale, true, failure);
      assert.equal(fallback.fetchedAt, "2026-01-01T00:00:00.000Z");
      assert.deepEqual(rows.get(key)?.payload, first.data, "Failure retains healthy payload");
      const previousRequests: number = requests;
      await getArmoryProfileSection("Mothrmonster", "Lordaeron", "talents");
      assert.equal(requests, previousRequests, "Failures are negatively cached");
    }
    const otherRealm = await getArmoryProfileSection("Mothrmonster", "Icecrown", "talents");
    assert.equal(otherRealm.data, null, "Another realm cannot borrow a cached build");
    const otherSection = await getArmoryProfileSection("Mothrmonster", "Lordaeron", "reputation");
    assert.equal(otherSection.data, null, "One unavailable section cannot borrow another payload");
    await assert.rejects(() => getArmoryProfileSection("Mothrmonster", "Lordaeron", "achievements", "999999"));

    let posted = false;
    globalThis.fetch = async (_, init) => {
      if (init?.method === "POST") { posted = true; assert.equal(init.body, "category=92"); return new Response(readFileSync("tests/fixtures/armory/achievements-category.json", "utf8")); }
      return new Response(readFileSync("tests/fixtures/armory/achievements.html", "utf8"));
    };
    const achievements = await fetchArmorySection("Mothrmonster", "Lordaeron", "achievements", "92");
    assert.ok(posted && achievements?.groups[0].rows.length);
    posted = false;
    globalThis.fetch = async () => new Response(fixture.replaceAll("Mothrmonster", "Another"));
    await assert.rejects(() => fetchArmorySection("Mothrmonster", "Lordaeron", "achievements", "92"));
    assert.equal(posted, false, "Identity must be verified before requesting an identity-less fragment");

    const { GET } = require("../app/api/players/[name]/armory/route") as typeof import("../app/api/players/[name]/armory/route");
    const call = (query: string) => GET(new Request(`http://localhost/api/players/Mothrmonster/armory?realm=Lordaeron&${query}`), { params: Promise.resolve({ name: "Mothrmonster" }) });
    assert.equal((await call("section=other")).status, 400);
    assert.equal((await call("section=achievements&category=999999")).status, 400);
    assert.equal((await call("section=talents&spell=999999")).status, 404);
    knownPlayer = false;
    assert.equal((await call("section=summary")).status, 404);
    let rateLimitRequests = 0;
    globalThis.fetch = async () => { rateLimitRequests++; return new Response("Rate limited", { status: 429, headers: { "Retry-After": "60" } }); };
    const limited = await getArmoryProfileSection("Mothrmonster", "Lordaeron", "collections");
    assert.match(limited.message ?? "", /limiting requests/);
    await getArmoryProfileSection("Mothrmonster", "Lordaeron", "pvp");
    assert.equal(rateLimitRequests, 1, "Host cooldown prevents requests to other sections after 429");
    console.log("Armory cache, identity, fallback, coalescing, category and route checks passed");
  } finally { loader._resolveFilename = originalResolve; globalThis.fetch = originalFetch; delete require.cache[mockPath]; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
