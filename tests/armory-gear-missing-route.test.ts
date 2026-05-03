import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

type FindManyArgs = Record<string, unknown>;

const freshPlayers = Array.from({ length: 120 }, (_, index) => ({
  name: `Fresh${String(index).padStart(3, "0")}`,
  realm: { name: "Lordaeron" },
}));

const freshCachedRows = freshPlayers.map((player) => ({
  characterKey: player.name.toLowerCase(),
  realm: "Lordaeron",
  gear: {
    characterName: player.name,
    realm: "Lordaeron",
    sourceUrl: `https://armory.warmane.com/character/${player.name}/Lordaeron/summary`,
    fetchedAt: "2026-05-01T12:00:00.000Z",
    items: [{
      slot: "Head",
      name: "Fresh Hat",
      itemId: "1",
      itemLevel: 1,
      equipLoc: "INVTYPE_HEAD",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg",
    }],
  },
}));

const dbCalls: {
  players?: FindManyArgs;
  rosterMembers?: FindManyArgs;
  cachedRows?: FindManyArgs;
} = {};

function applyTake<T>(rows: T[], args: FindManyArgs): T[] {
  return typeof args.take === "number" ? rows.slice(0, args.take) : rows;
}

const db = {
  player: {
    findMany: async (args: FindManyArgs) => {
      dbCalls.players = args;
      return applyTake([
        ...freshPlayers,
        { name: "Maxximusboom", realm: { name: "Lordaeron" } },
      ], args);
    },
  },
  guildRosterMember: {
    findMany: async (args: FindManyArgs) => {
      dbCalls.rosterMembers = args;
      return applyTake([], args);
    },
  },
  armoryGearCache: {
    findMany: async (args: FindManyArgs) => {
      dbCalls.cachedRows = args;
      return freshCachedRows;
    },
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
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "armory-gear-missing-db.js");

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") {
      return dbMockPath;
    }
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

  const previousAdminSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "test-secret";

  try {
    const { POST } = require("../app/api/admin/armory-gear/missing/route") as typeof import("../app/api/admin/armory-gear/missing/route");
    const response = await POST(new Request("https://pizza-logs.test/api/admin/armory-gear/missing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://armory.warmane.com",
      },
      body: JSON.stringify({ secret: "test-secret" }),
    }) as never);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.players, [
      { characterName: "Maxximusboom", realm: "Lordaeron" },
    ]);
    assert.equal(dbCalls.players?.take, undefined);
    assert.equal(dbCalls.rosterMembers?.take, undefined);
  } finally {
    moduleLoader._resolveFilename = originalResolve;
    delete require.cache[dbMockPath];
    if (previousAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = previousAdminSecret;
    }
  }

  console.log("armory-gear-missing-route tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
