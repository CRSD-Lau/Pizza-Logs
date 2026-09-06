import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import type { ArmoryCharacterAppearance, ArmoryCharacterGear, ArmoryGearItem } from "../lib/warmane-armory";

const appearance: ArmoryCharacterAppearance = {
  modelId: "draeneifemale", skin: 0, hairStyle: 5, hairColor: 3, face: 7,
  facialHair: 0, faceColor: 0, earPiercing: 0, hornStyle: 4, tattoo: 0,
  classId: 2, items: [[1, 63931]],
};
const cachedGear: ArmoryCharacterGear = {
  characterName: "Synthetic", realm: "Lordaeron",
  sourceUrl: "https://armory.warmane.com/character/Synthetic/Lordaeron/summary",
  fetchedAt: "2026-04-30T12:00:00.000Z",
  items: [{
    slot: "Head", name: "Cached Hat", itemId: "123", itemLevel: 251,
    equipLoc: "INVTYPE_HEAD", iconUrl: "https://cdn.warmane.com/wotlk/icons/large/test.jpg",
  }],
  appearance,
};
const freshProfile = `<title>Warmane Armory | Character Synthetic @ Lordaeron</title>var charactermodel = {
  sk: 0, ha: 2, hc: 3, fa: 7, fh: 0, fc: 0, ep: 0, ho: 4, ta: 0, cls: 2,
  items: [[1,63931]], models: { id: 'draeneifemale' }
};`;
type CacheKey = { characterKey_realm: { characterKey: string; realm: string } };

async function main() {
  const moduleLoader = Module as typeof Module & {
    _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = moduleLoader._resolveFilename;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "armory-cache-db.js");
  const enrichmentMockPath = path.join(process.cwd(), "tests", "__mocks__", "armory-cache-enrichment.js");
  let storedGear = structuredClone(cachedGear);
  let cachePresent = true;
  let writes = 0;
  let failureWrites = 0;
  const checkKey = (where: CacheKey) => {
    assert.deepEqual(where.characterKey_realm, { characterKey: "synthetic", realm: "Lordaeron" });
  };
  const db = {
    armoryGearCache: {
      findFirst: async ({ where }: { where: { characterKey: { equals: string; mode: string }; realm: { equals: string; mode: string } } }) => {
        assert.deepEqual(where, { characterKey: { equals: "synthetic", mode: "insensitive" }, realm: { equals: "Lordaeron", mode: "insensitive" } });
        return cachePresent ? { realm: "Lordaeron", gear: structuredClone(storedGear) } : null;
      },
      upsert: async ({ where, update }: { where: CacheKey; update: { gear: ArmoryCharacterGear; lastError?: string | null } }) => {
        checkKey(where);
        storedGear = JSON.parse(JSON.stringify(update.gear)) as ArmoryCharacterGear;
        cachePresent = true;
        if (update.lastError) failureWrites += 1;
        else writes += 1;
      },
      update: async ({ where, data }: { where: CacheKey; data: { gear?: ArmoryCharacterGear } }) => {
        checkKey(where);
        if (data.gear) storedGear = JSON.parse(JSON.stringify(data.gear)) as ArmoryCharacterGear;
        failureWrites += 1;
      },
    },
    wowItem: { upsert: async () => { throw new Error("Synthetic Warmane icons need no backfill"); } },
  };
  moduleLoader._resolveFilename = function resolveMocks(request, parent, isMain, options) {
    if (parent?.filename === path.join(process.cwd(), "lib", "warmane-armory.ts")) {
      if (request === "./db") return dbMockPath;
      if (request === "./item-template") return enrichmentMockPath;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbMockPath] = { id: dbMockPath, filename: dbMockPath, loaded: true, exports: { db } } as NodeModule;
  require.cache[enrichmentMockPath] = {
    id: enrichmentMockPath, filename: enrichmentMockPath, loaded: true,
    exports: { enrichGearWithLocalTemplate: async (items: ArmoryGearItem[]) => items },
  } as NodeModule;
  console.error = () => {};

  try {
    const { getWarmaneCharacterGear } = require("../lib/warmane-armory") as typeof import("../lib/warmane-armory");
    for (const profileFailure of ["http", "network", "unparseable"] as const) {
      storedGear = structuredClone(cachedGear);
      writes = 0;
      let fetches = 0;
      globalThis.fetch = async input => {
        fetches += 1;
        if (String(input).includes("/api/character/")) {
          return Response.json({ name: "Synthetic", realm: "Lordaeron", equipment: [{
            name: "Fresh Hat", item: "123", itemLevel: 251, equipLoc: "INVTYPE_HEAD",
            iconUrl: "https://cdn.warmane.com/wotlk/icons/large/test.jpg",
          }] });
        }
        if (profileFailure === "network") throw new Error("Synthetic profile network failure");
        return new Response("No model recipe", { status: profileFailure === "http" ? 503 : 200 });
      };

      const refreshed = await getWarmaneCharacterGear("Synthetic", "Lordaeron");
      assert.equal(refreshed.ok, true);
      if (!refreshed.ok) throw new Error("Expected fresh equipment with a cached model");
      assert.equal(refreshed.stale, undefined, "A failed profile does not mark fresh equipment stale");
      assert.equal(refreshed.gear.items[0]?.name, "Fresh Hat");
      assert.deepEqual(refreshed.gear.appearance, appearance);
      assert.equal(refreshed.gear.appearanceStale, true);
      assert.deepEqual(storedGear.appearance, appearance, `${profileFailure}: merge must precede the DB write`);
      assert.equal(storedGear.appearanceStale, true);
      assert.equal(storedGear.fetchedAt, refreshed.gear.fetchedAt);
      assert.equal(writes, 1);

      const cacheHit = await getWarmaneCharacterGear("Synthetic", "Lordaeron");
      assert.equal(cacheHit.ok, true);
      if (!cacheHit.ok) throw new Error("Expected a fresh cache hit");
      assert.deepEqual(cacheHit.gear.appearance, appearance);
      assert.equal(cacheHit.gear.appearanceStale, true, "The cached model label survives a later request");
      assert.equal(cacheHit.stale, undefined);
      assert.equal(fetches, 2, "A cached appearance must not shorten equipment refresh cadence");
      assert.equal(writes, 1);
    }

    globalThis.fetch = async input => String(input).includes("/api/character/")
      ? Response.json({ name: "Synthetic", realm: "Lordaeron", equipment: [] })
      : new Response(freshProfile);
    const replaced = await getWarmaneCharacterGear("Synthetic", "Lordaeron", { maxAgeMs: 0 });
    assert.equal(replaced.ok, true);
    if (!replaced.ok) throw new Error("Expected a fresh model");
    assert.equal(replaced.gear.appearance?.hairStyle, 2);
    assert.equal(replaced.gear.appearanceStale, false);
    assert.equal(storedGear.appearance?.hairStyle, 2);
    assert.equal(storedGear.appearanceStale, false, "A new profile clears the persisted stale marker");

    storedGear = { ...structuredClone(cachedGear), appearanceStale: true };
    globalThis.fetch = async input => String(input).includes("/api/character/")
      ? new Response("Synthetic equipment outage", { status: 503 })
      : new Response(freshProfile);
    const equipmentFailure = await getWarmaneCharacterGear("Synthetic", "Lordaeron", { maxAgeMs: 0 });
    assert.equal(equipmentFailure.ok, true);
    if (!equipmentFailure.ok) throw new Error("Expected cached equipment with a fresh model");
    assert.equal(equipmentFailure.stale, true);
    assert.equal(equipmentFailure.gear.appearanceStale, false);
    assert.equal(storedGear.appearanceStale, false, "Reverse fallback also persists the fresh model marker");
    assert.equal(storedGear.appearance?.hairStyle, 2);
    assert.equal(storedGear.fetchedAt, cachedGear.fetchedAt, "Equipment failure must not advance its freshness");
    assert.equal(failureWrites, 1);

    cachePresent = false;
    const coldFailure = await getWarmaneCharacterGear("Synthetic", "Lordaeron", { maxAgeMs: 0 });
    assert.equal(coldFailure.ok, false, "A cold cache with profile identity must not invent equipment");
    if (coldFailure.ok) throw new Error("Expected identity without equipment");
    assert.equal(coldFailure.identity?.className, "Paladin");
    assert.equal(storedGear.identityOnly, true);
    assert.equal(storedGear.className, "Paladin", "Profile identity persists for the next directory render");
    assert.equal(storedGear.items.length, 0);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    const stillUnavailable = await getWarmaneCharacterGear("Synthetic", "Lordaeron");
    assert.equal(stillUnavailable.ok, false, "An identity-only cache never becomes a successful equipment fallback");
    if (stillUnavailable.ok) throw new Error("Expected unavailable equipment");
    assert.equal(stillUnavailable.identity?.className, "Paladin");

    storedGear = { ...structuredClone(cachedGear), realm: "Icecrown" };
    const wrongRealmCache = await getWarmaneCharacterGear("Synthetic", "Lordaeron");
    assert.equal(wrongRealmCache.ok, false, "A cache payload for a different realm cannot supply fallback gear");
  } finally {
    moduleLoader._resolveFilename = originalResolve;
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    delete require.cache[dbMockPath];
    delete require.cache[enrichmentMockPath];
  }
  console.log("warmane armory cache persistence tests passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
