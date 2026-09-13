import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

const db = {
  player: {
    findMany: async (args: { where?: { realmId?: string } }) =>
      !args.where?.realmId || args.where.realmId === "realm-lordaeron"
        ? [{ id: "p1", name: "Lich", class: "Mage", realmId: "realm-lordaeron", realm: { name: "Lordaeron", host: "warmane" } }]
        : [],
  },
  realm: {
    findUnique: async (args: { where: { id: string } }) => args.where.id === "realm-lordaeron"
      ? { name: "Lordaeron", host: "warmane" }
      : null,
  },
  guildRosterMember: {
    findMany: async () => [
      {
        id: "r1",
        characterName: "Lich",
        normalizedCharacterName: "lich",
        realm: "Lordaeron",
        guildName: "PizzaWarriors",
        className: "Mage",
        raceName: "Human",
        level: 80,
      },
    ],
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
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "player-search-db.js");

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbMockPath;
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

  try {
    const { GET } = require("../app/api/players/search/route") as typeof import("../app/api/players/search/route");

    const response = await GET(new Request("https://pizza-logs.test/api/players/search?q=lich") as never);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.query, "lich");
    assert.deepEqual(payload.results, [{
      name: "Lich",
      profilePath: "/players/Lich?realm=Lordaeron&realmId=realm-lordaeron",
      realmName: "Lordaeron",
      realmId: "realm-lordaeron",
      realmHost: "warmane",
      className: "Mage",
      raceName: "Human",
      level: 80,
      guildName: "PizzaWarriors",
      source: "logs+roster",
    }]);

    const scopedResponse = await GET(new Request("https://pizza-logs.test/api/players/search?q=lich&realmId=realm-lordaeron") as never);
    const scopedPayload = await scopedResponse.json();
    assert.equal(scopedResponse.status, 200);
    assert.equal(scopedPayload.results[0].profilePath, "/players/Lich?realm=Lordaeron&realmId=realm-lordaeron");
    assert.equal(scopedPayload.results[0].realmId, "realm-lordaeron");
    assert.equal(scopedPayload.results[0].source, "logs+roster", "The selected default realm retains its matching roster fallback");

    const staleResponse = await GET(new Request("https://pizza-logs.test/api/players/search?q=lich&realmId=stale") as never);
    assert.equal(staleResponse.status, 200);
    assert.deepEqual((await staleResponse.json()).results, [], "An unknown realm ID remains scoped and cannot broaden search");

    const invalidResponse = await GET(new Request(`https://pizza-logs.test/api/players/search?q=lich&realmId=${"x".repeat(129)}`) as never);
    assert.equal(invalidResponse.status, 400);

    const emptyResponse = await GET(new Request("https://pizza-logs.test/api/players/search") as never);
    const emptyPayload = await emptyResponse.json();
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(emptyPayload, { ok: true, query: "", results: [] });
  } finally {
    moduleLoader._resolveFilename = originalResolve;
    delete require.cache[dbMockPath];
  }

  console.log("player-search-route tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
