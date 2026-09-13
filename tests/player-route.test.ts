import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

const playerQueries: Array<{ name: string; realmId?: string }> = [];
const db = {
  player: {
    findFirst: async ({ where }: { where: { name: string; realmId?: string } }) => {
      playerQueries.push(where);
      return where.realmId === "stale" ? null : {
        id: "player-a",
        name: where.name,
        realmId: where.realmId ?? "realm-a",
        milestones: [],
      };
    },
  },
  participant: {
    findMany: async () => [],
    aggregate: async () => ({
      _count: 0,
      _sum: { totalDamage: 0, totalHealing: 0, totalAbsorbs: 0, deaths: 0 },
      _avg: { dps: 0, aps: 0 },
    }),
    count: async () => 0,
  },
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
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "player-route-db.js");

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbMockPath;
    if (request.startsWith("@/")) {
      return originalResolve.call(this, path.join(process.cwd(), `${request.slice(2)}.ts`), parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbMockPath] = {
    id: dbMockPath,
    filename: dbMockPath,
    loaded: true,
    exports: { db },
  } as NodeModule;

  try {
    const { GET } = require("../app/api/players/[name]/route") as typeof import("../app/api/players/[name]/route");
    const params = Promise.resolve({ name: "Twin" });

    const selected = await GET(new Request("https://pizza-logs.test/api/players/Twin?realmId=realm-a"), { params });
    assert.equal(selected.status, 200);
    assert.deepEqual(playerQueries.at(-1), { name: "Twin", realmId: "realm-a" });

    const unselected = await GET(new Request("https://pizza-logs.test/api/players/Twin"), { params });
    assert.equal(unselected.status, 200);
    assert.deepEqual(playerQueries.at(-1), { name: "Twin" }, "No selector preserves the legacy unscoped lookup");

    const stale = await GET(new Request("https://pizza-logs.test/api/players/Twin?realmId=stale"), { params });
    assert.equal(stale.status, 404, "A stale realm remains scoped instead of selecting another namesake");

    const invalid = await GET(new Request(`https://pizza-logs.test/api/players/Twin?realmId=${"x".repeat(129)}`), { params });
    assert.equal(invalid.status, 400);
  } finally {
    moduleLoader._resolveFilename = originalResolve;
    delete require.cache[dbMockPath];
  }

  console.log("player-route tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
