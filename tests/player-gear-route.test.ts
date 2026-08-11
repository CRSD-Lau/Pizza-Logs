import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

let knownPlayer = true;
let gearRequest: { characterName: string; realm: string; options?: { maxAgeMs?: number } } | null = null;

const db = {
  player: {
    findFirst: async () => knownPlayer
      ? { name: "Lausudo", class: "Paladin", realm: { name: "Lordaeron" } }
      : null,
  },
  guildRosterMember: {
    findFirst: async () => null,
  },
};

const getWarmaneCharacterGear = async (
  characterName: string,
  realm: string,
  options?: { maxAgeMs?: number },
) => {
  gearRequest = { characterName, realm, options };
  return {
    ok: true as const,
    gear: {
      characterName,
      realm,
      className: "Paladin",
      raceName: "Human",
      guildName: "Pizza Warriors",
      sourceUrl: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary",
      fetchedAt: "2026-08-11T19:20:09.000Z",
      items: [{
        slot: "Head",
        name: "Broken Ram Skull Helm",
        itemId: "49986",
        itemLevel: 264,
        equipLoc: "INVTYPE_HEAD" as const,
      }],
    },
  };
};

async function main() {
  const moduleLoader = Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown,
    ) => string;
  };
  const originalResolve = moduleLoader._resolveFilename;
  const dbMockPath = path.join(process.cwd(), "tests", "player-gear-route-db.mock.js");
  const armoryMockPath = path.join(process.cwd(), "tests", "player-gear-route-armory.mock.js");

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbMockPath;
    if (request === "@/lib/warmane-armory") return armoryMockPath;
    if (request.startsWith("@/")) {
      return originalResolve.call(
        this,
        path.join(process.cwd(), `${request.slice(2)}.ts`),
        parent,
        isMain,
        options,
      );
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  require.cache[dbMockPath] = {
    id: dbMockPath,
    filename: dbMockPath,
    loaded: true,
    exports: { db },
  } as NodeModule;
  require.cache[armoryMockPath] = {
    id: armoryMockPath,
    filename: armoryMockPath,
    loaded: true,
    exports: { getWarmaneCharacterGear },
  } as NodeModule;

  try {
    const { GET } = require("../app/api/players/[name]/gear/route") as typeof import("../app/api/players/[name]/gear/route");
    const response = await GET(
      new Request("https://pizza-logs.test/api/players/Lausudo/gear?realm=Lordaeron"),
      { params: Promise.resolve({ name: "Lausudo" }) },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.className, "Paladin");
    assert.equal(payload.raceName, "Human");
    assert.equal(payload.guildName, "Pizza Warriors");
    assert.equal(payload.gear.items[0].name, "Broken Ram Skull Helm");
    assert.equal(gearRequest?.characterName, "Lausudo");
    assert.equal(gearRequest?.realm, "Lordaeron");
    assert.equal(gearRequest?.options?.maxAgeMs, 5 * 60 * 1000);
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);

    knownPlayer = false;
    const missingResponse = await GET(
      new Request("https://pizza-logs.test/api/players/Unknown/gear"),
      { params: Promise.resolve({ name: "Unknown" }) },
    );
    assert.equal(missingResponse.status, 404);
  } finally {
    moduleLoader._resolveFilename = originalResolve;
    delete require.cache[dbMockPath];
    delete require.cache[armoryMockPath];
  }

  console.log("player-gear-route tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
