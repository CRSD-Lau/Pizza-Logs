import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const failingModel = {
  count: async () => {
    throw new Error("Can't reach database server at localhost:5432");
  },
  findMany: async () => {
    throw new Error("Can't reach database server at localhost:5432");
  },
  findFirst: async () => {
    throw new Error("Can't reach database server at localhost:5432");
  },
  groupBy: async () => {
    throw new Error("Can't reach database server at localhost:5432");
  },
};

const db = {
  upload: failingModel,
  encounter: failingModel,
  player: failingModel,
  milestone: failingModel,
  boss: failingModel,
  armoryGearCache: failingModel,
  guildRosterMember: failingModel,
  wowItem: failingModel,
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
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "admin-page-db.js");
  const navigationMockPath = path.join(process.cwd(), "tests", "__mocks__", "next-navigation.js");
  const adminGuardMockPath = path.join(process.cwd(), "tests", "__mocks__", "admin-guard.js");

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbMockPath;
    if (request === "@/lib/require-admin") return adminGuardMockPath;
    if (request === "next/navigation") return navigationMockPath;
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ].find((candidate) => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  require.cache[dbMockPath] = {
    id: dbMockPath,
    filename: dbMockPath,
    loaded: true,
    exports: { db },
  } as NodeModule;
  require.cache[adminGuardMockPath] = {
    id: adminGuardMockPath,
    filename: adminGuardMockPath,
    loaded: true,
    exports: { requireAdmin: async () => ({ user: { id: "synthetic-authorized-admin" } }) },
  } as NodeModule;
  require.cache[navigationMockPath] = {
    id: navigationMockPath,
    filename: navigationMockPath,
    loaded: true,
    exports: {
      useRouter: () => ({ refresh() {}, push() {} }),
    },
  } as NodeModule;

  const originalFetch = global.fetch;
  global.fetch = async (_input, options) => {
    assert.ok(options?.signal instanceof AbortSignal, "Parser diagnostics need a body-lifetime deadline");
    assert.equal(options.redirect, "error");
    return Response.json({ status: "unreachable" });
  };

  try {
    const { default: AdminPage } = require("../app/admin/page") as typeof import("../app/admin/page");
    const element = await AdminPage();
    const markup = renderToStaticMarkup(element);

    assert.match(markup, /Admin \/ Diagnostics/);
    assert.match(markup, /Database unavailable/);
    assert.match(markup, /localhost:5432/);
    assert.match(markup, /Upload analytics are unavailable/);

    let cancelled = false;
    global.fetch = async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(16 * 1024 + 1)); },
      cancel() { cancelled = true; },
    }));
    assert.match(renderToStaticMarkup(await AdminPage()), /Unreachable/);
    assert.equal(cancelled, true, "Oversized diagnostics must cancel the upstream body");

    global.fetch = async () => Response.json({ status: { invalid: true } });
    assert.match(renderToStaticMarkup(await AdminPage()), /Unreachable/);

    cancelled = false;
    global.fetch = async () => new Response(new ReadableStream({
      cancel() { cancelled = true; },
    }), { status: 503 });
    assert.match(renderToStaticMarkup(await AdminPage()), /Unreachable/);
    assert.equal(cancelled, true, "Failed diagnostics must cancel the upstream body");
  } finally {
    global.fetch = originalFetch;
    moduleLoader._resolveFilename = originalResolve;
    delete require.cache[dbMockPath];
    delete require.cache[adminGuardMockPath];
    delete require.cache[navigationMockPath];
  }

  console.log("admin-page-db-unavailable tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
