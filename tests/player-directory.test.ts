import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

async function main() {
  const moduleLoader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = moduleLoader._resolveFilename;
  const originalFetch = globalThis.fetch;
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "player-directory-db.js");
  const players = Array.from({ length: 35 }, (_, index) => ({ id: `p${index}`, name: `Player${String(index + 1).padStart(2, "0")}`, class: "Mage", realm: { name: "Lordaeron" } }));
  let pageIds: string[] = [];
  let countIds: string[] = [];
  let countInclude: unknown;
  const evidence = (index: number, className: string, date: string) => ({
    characterName: players[index].name, payloadName: players[index].name, realm: "Lordaeron", payloadRealm: "Lordaeron", className,
    classObservedAt: null, observedAt: new Date(date), source: "armory", sourceUrl: `https://armory.warmane.com/character/${players[index].name}/Lordaeron/summary`, raceName: null, guildName: null,
  });
  const observations = [evidence(0, "Paladin", "2026-09-01"), { ...evidence(0, "Druid", "2026-09-02"), source: "roster" },
    { ...evidence(1, "Warrior", "2026-09-03"), payloadRealm: "Icecrown" }];
  const db = {
    $queryRaw: async (sql: TemplateStringsArray) => {
      const query = sql.join("?");
      assert.match(query, /gear->>'className'/);
      assert.doesNotMatch(query, /SELECT\s+(?:\w+\.)?gear\s*[,\n]/i, "Full equipment JSON must remain in PostgreSQL");
      return observations;
    },
    player: { findMany: async (query: { where?: { id: { in: string[] } }; select: { _count?: unknown } }) => {
      if (!query.where) return players;
      pageIds = query.where.id.in;
      countInclude = query.select._count;
      return pageIds.map(id => ({ id, _count: { participants: 7 } }));
    } },
    encounter: { count: async (query: { where: { AND: [unknown, { participants: { some: { playerId: { in: string[] } } } }] } }) => {
      countIds = query.where.AND[1].participants.some.playerId.in;
      return 2;
    } },
  };
  moduleLoader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (request === "./db" && parent?.filename === path.join(process.cwd(), "lib", "player-directory.ts")) return dbMockPath;
    if (request.startsWith("@/")) return originalResolve.call(this, path.join(process.cwd(), `${request.slice(2)}.ts`), parent, isMain, options);
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbMockPath] = { id: dbMockPath, filename: dbMockPath, loaded: true, exports: { db } } as NodeModule;
  globalThis.fetch = async () => { throw new Error("Directory render must never request Warmane"); };
  try {
    const { getPlayersPageData, getStoredPlayerIdentity } = require("../lib/player-directory") as typeof import("../lib/player-directory");
    const mages = await getPlayersPageData("player", "Mage", 2, false);
    assert.equal(mages.totalCount, 34);
    assert.equal(mages.pagination.firstVisible, 31);
    assert.equal(mages.players.length, 4);
    assert.equal(mages.allPlayersForStats.filter(player => player.class === "Mage").length, 34);
    assert.equal(mages.allPlayersForStats.filter(player => player.class === "Druid").length, 1);
    assert.deepEqual(pageIds, ["p31", "p32", "p33", "p34"]);
    assert.equal(countIds.includes("p0"), false, "Short-pull count uses the resolved class filter too");
    assert.equal(countIds.includes("p1"), true, "Mismatched cached realm cannot change class");
    assert.match(JSON.stringify(countInclude), /NOT/);
    const druids = await getPlayersPageData("", "Druid", 99, true);
    assert.equal(druids.totalCount, 1);
    assert.equal(druids.players[0].name, "Player01");
    assert.equal(druids.players[0].classSource, "roster");
    assert.equal(druids.players[0]._count.participants, 7);
    assert.equal(druids.pagination.currentPage, 1);
    assert.doesNotMatch(JSON.stringify(countInclude), /NOT/);
    const missing = await getPlayersPageData("missing", undefined, 1, false);
    assert.equal(missing.totalCount, 0); assert.equal(missing.shortPulls, 0);
    assert.equal((await getStoredPlayerIdentity("Player01", "Lordaeron", "Mage")).className, "Druid");
  } finally {
    moduleLoader._resolveFilename = originalResolve; globalThis.fetch = originalFetch; delete require.cache[dbMockPath];
  }
  console.log("player directory tests passed");
}
main().catch(error => { console.error(error); process.exit(1); });
