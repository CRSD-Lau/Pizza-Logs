import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const uploads = Array.from({ length: 105 }, (_, index) => ({
  id: `synthetic-${String(105 - index).padStart(3, "0")}`,
  filename: `synthetic-${String(105 - index).padStart(3, "0")}.txt`,
  status: "PENDING", realm: null, guild: null, encounters: [], sessionAnalytics: null,
  publicSlug: `synthetic-${index}`, fileSize: 0, rawLineCount: 0,
  errorMessage: null, createdAt: new Date("2026-01-02T01:02:03Z"),
}));
let authorized = false;
let deny = false;
let total = uploads.length;
let reads = 0;
let lastQuery: { skip: number; take: number; orderBy: unknown } | undefined;
const db = { upload: {
  count: async () => { assert.equal(authorized, true); reads++; return total; },
  findMany: async (query: { skip: number; take: number; orderBy: unknown }) => {
    assert.equal(authorized, true);
    reads++;
    lastQuery = query;
    return uploads.slice(0, total).slice(query.skip, query.skip + query.take);
  },
} };

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const dbPath = path.join(process.cwd(), "tests", "__mocks__", "admin-pagination-db.js");
  const guardPath = path.join(process.cwd(), "tests", "__mocks__", "admin-pagination-guard.js");
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
  require.cache[guardPath] = { id: guardPath, filename: guardPath, loaded: true, exports: { requireAdmin: async () => {
    if (deny) throw new Error("Synthetic access denied");
    authorized = true;
  } } } as NodeModule;
  try {
    const { default: Page } = require("../app/admin/uploads/page") as typeof import("../app/admin/uploads/page");
    const first = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.match(first, /105 uploads stored/);
    assert.match(first, /1–30 of 105 uploads · Page 1 of 4/);
    assert.match(first, /synthetic-105\.txt/);
    assert.doesNotMatch(first, /synthetic-075\.txt/);
    assert.match(first, /0 B - 0 lines/);
    assert.match(first, /2026.*01:02:03 UTC/);
    assert.match(first, /href="\/admin\/uploads\?page=2"/);
    assert.match(first, /<span aria-disabled="true"[^>]*>Previous<\/span>/);
    assert.deepEqual(lastQuery?.orderBy, [{ createdAt: "desc" }, { id: "desc" }], "Equal timestamps must have deterministic pagination order");

    const last = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "999" }) }));
    assert.match(last, /91–105 of 105 uploads · Page 4 of 4/);
    assert.match(last, /synthetic-001\.txt/);
    assert.doesNotMatch(last, /synthetic-016\.txt/);
    assert.match(last, /href="\/admin\/uploads\?page=3"/);
    assert.doesNotMatch(last, /href="\/admin\/uploads\?page=5"/);
    assert.match(last, /<span aria-disabled="true"[^>]*>Next<\/span>/);
    assert.equal(lastQuery?.skip, 90);
    assert.equal(lastQuery?.take, 30);
    const invalid = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "NaN" }) }));
    assert.match(invalid, /Page 1 of 4/);

    total = 0;
    const empty = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "99" }) }));
    assert.match(empty, /No uploads yet/);
    assert.match(empty, /0–0 of 0 uploads · Page 1 of 1/);
    deny = true;
    authorized = false;
    const before = reads;
    await assert.rejects(Page({ searchParams: Promise.resolve({ page: "2" }) }), /access denied/);
    assert.equal(reads, before, "Unauthorized rendering must not count or fetch private uploads");
  } finally {
    loader._resolveFilename = originalResolve;
    delete require.cache[dbPath];
    delete require.cache[guardPath];
  }
  console.log("admin upload pagination tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
