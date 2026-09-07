import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

type Selection = Record<string, true | { select: Selection }>;
const privateUpload = {
  filename: "private-real-name-and-location.txt",
  uploaderName: "private-uploader-label",
  fileHash: "private-upload-hash",
  errorMessage: "private-operational-diagnostics",
  guild: { name: "PizzaWarriors" },
  realm: { name: "Lordaeron", host: "warmane" },
};

// Apply the database projection to a row that contains private fields, so a
// regression which requests one of those fields is observable in the response.
function selectFields(row: Record<string, unknown>, selection: Selection): Record<string, unknown> {
  return Object.fromEntries(Object.entries(selection).map(([field, rule]) => [
    field,
    rule === true ? row[field] : selectFields(row[field] as Record<string, unknown>, rule.select),
  ]));
}

async function main() {
  let missing = false;
  const calls: Selection[] = [];
  function encounter({ include }: { include: { upload: true | { select: Selection } } }) {
    const selection = include.upload;
    const upload = selection === true ? privateUpload : selectFields(privateUpload, selection.select);
    if (selection !== true) calls.push(selection.select);
    return { id: "synthetic-encounter", totalDamage: 1234, upload };
  }
  const db = {
    encounter: {
      findMany: async (query: Parameters<typeof encounter>[0]) => [encounter(query)],
      findUnique: async (query: Parameters<typeof encounter>[0]) => missing ? null : encounter(query),
    },
  };
  const loader = Module as typeof Module & {
    _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = loader._resolveFilename;
  const dbPath = path.join(process.cwd(), "tests", "__mocks__", "public-encounter-upload-privacy-db.js");
  const previousDbModule = require.cache[dbPath];
  loader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbPath;
    return originalResolve.call(this, request.startsWith("@/")
      ? path.join(process.cwd(), `${request.slice(2)}.ts`) : request, parent, isMain, options);
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { db } } as NodeModule;
  try {
    const list = require("../app/api/encounters/route") as typeof import("../app/api/encounters/route");
    const detail = require("../app/api/encounters/[id]/route") as typeof import("../app/api/encounters/[id]/route");
    const listResponse = await list.GET(new Request("https://pizza-logs.test/api/encounters") as never);
    const detailResponse = await detail.GET(new Request("https://pizza-logs.test/api/encounters/synthetic") as never,
      { params: Promise.resolve({ id: "synthetic" }) });
    assert.equal(listResponse.status, 200);
    assert.equal(detailResponse.status, 200);
    const listPayload = await listResponse.json();
    const detailPayload = await detailResponse.json();
    assert.deepEqual(listPayload[0].upload, { realm: { name: "Lordaeron" } });
    assert.deepEqual(detailPayload.upload, {
      guild: { name: "PizzaWarriors" }, realm: { name: "Lordaeron", host: "warmane" },
    });
    assert.equal(listPayload[0].totalDamage, 1234);
    assert.equal(detailPayload.totalDamage, 1234);
    const responses = JSON.stringify([listPayload, detailPayload]);
    for (const sensitive of ["filename", "uploaderName", "fileHash", "errorMessage", "private-"]) {
      assert.equal(responses.includes(sensitive), false, `${sensitive} must not be public`);
    }
    assert.equal(calls.length, 2);
    missing = true;
    const missingResponse = await detail.GET(new Request("https://pizza-logs.test/api/encounters/missing") as never,
      { params: Promise.resolve({ id: "missing" }) });
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(await missingResponse.json(), { error: "Not found" });
  } finally {
    loader._resolveFilename = originalResolve;
    if (previousDbModule) require.cache[dbPath] = previousDbModule;
    else delete require.cache[dbPath];
  }
  console.log("public-encounter-upload-privacy tests passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
