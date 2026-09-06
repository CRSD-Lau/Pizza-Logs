import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

let knownPlayer = true;
let gearRequest: { characterName: string; realm: string; options?: { maxAgeMs?: number } } | null = null;
let resultMode: "healthy" | "failure" | "wrong-realm" | "identity-only" = "healthy";
let roster: Array<{ characterName: string; realm: string; className: string; raceName: string; guildName: string; lastSyncedAt: Date; armoryUrl: string }> = [];

const db = {
  player: {
    findFirst: async ({ where }: { where: { name: { equals: string; mode: string }; OR: Array<{ realm?: { is: { name: { equals: string; mode: string } } } }> } }) => {
      assert.equal(where.name.mode, "insensitive");
      assert.equal(where.OR[0].realm?.is.name.mode, "insensitive");
      return knownPlayer && where.name.equals.toLowerCase() === "lausudo" && where.OR[0].realm?.is.name.equals.toLowerCase() === "lordaeron"
      ? { name: "Lausudo", class: "Paladin", realm: { name: "Lordaeron" } }
      : null;
    },
  },
  guildRosterMember: {
    findMany: async ({ where }: { where: { realm: { equals: string; mode: string }; normalizedCharacterName: { equals: string } } }) => {
      assert.equal(where.realm.mode, "insensitive");
      return roster.filter(member => member.realm.toLowerCase() === where.realm.equals.toLowerCase()
        && member.characterName.toLowerCase() === where.normalizedCharacterName.equals);
    },
  },
};

const getWarmaneCharacterGear = async (
  characterName: string,
  realm: string,
  options?: { maxAgeMs?: number },
) => {
  gearRequest = { characterName, realm, options };
  if (resultMode === "failure" || resultMode === "identity-only") return {
    ok: false as const, message: "Warmane unavailable", sourceUrl: `https://armory.warmane.com/character/${characterName}/${realm}/summary`,
    ...(resultMode === "identity-only" ? { identity: { characterName, realm, className: "Shaman", classFetchedAt: "2026-09-06T12:00:00.000Z" } } : {}),
  };
  return {
    ok: true as const,
    gear: {
      characterName,
      realm: resultMode === "wrong-realm" ? "Icecrown" : realm,
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

    roster = [{ characterName: "Lausudo", realm: "Lordaeron", className: "Warrior", raceName: "Human", guildName: "Current Guild",
      lastSyncedAt: new Date("2026-09-01T12:00:00Z"), armoryUrl: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary" },
    { characterName: "Lausudo", realm: "Icecrown", className: "Druid", raceName: "Night Elf", guildName: "Other Realm",
      lastSyncedAt: new Date("2026-09-05T12:00:00Z"), armoryUrl: "https://armory.warmane.com/character/Lausudo/Icecrown/summary" }];
    const invoke = async (realm?: string) => GET(new Request(`https://pizza-logs.test/api/players/lausudo/gear${realm ? `?realm=${realm}` : ""}`), { params: Promise.resolve({ name: "lausudo" }) });
    const newerRoster = await (await invoke("lORDAERON")).json();
    assert.equal(newerRoster.className, "Warrior", "Newer matching roster identity overrides older equipment identity");
    assert.equal(newerRoster.classSource, "roster");
    assert.equal(newerRoster.guildName, "Current Guild");
    resultMode = "failure";
    const failedResponse = await invoke();
    const failed = await failedResponse.json();
    assert.equal(failed.className, "Warrior"); assert.equal(failed.realm, "Lordaeron");
    assert.equal(failed.classSource, "roster");
    assert.match(failedResponse.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(gearRequest?.realm, "Lordaeron", "Omitted realm keeps the default character boundary");
    resultMode = "identity-only";
    const identityOnly = await (await invoke()).json();
    assert.equal(identityOnly.ok, false); assert.equal(identityOnly.className, "Shaman"); assert.equal(identityOnly.classSource, "armory");
    resultMode = "wrong-realm";
    const mismatched = await (await invoke()).json();
    assert.equal(mismatched.ok, false); assert.equal(mismatched.className, "Warrior");
    assert.equal(mismatched.gear, undefined, "Wrong-realm upstream equipment cannot be exposed");

    knownPlayer = false;
    roster = [];
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
