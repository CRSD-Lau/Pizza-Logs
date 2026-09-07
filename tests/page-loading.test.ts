import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import React from "react";
import { renderToReadableStream } from "react-dom/server";

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const count = Promise.withResolvers<number>();
  let countCalls = 0;
  const mockExports: Record<string, unknown> = {
    "@/lib/db": { db: { encounter: { count: () => { countCalls++; return count.promise; } } } },
    "@/components/upload/UploadZoneWithRefresh": { UploadZoneWithRefresh: () => React.createElement("p", null, "Upload controls ready") },
    "@/components/intro/FrozenLogbookIntro": { FrozenLogbookIntro: () => null },
  };
  const mockPaths = Object.fromEntries(Object.entries(mockExports).map(([name, exports], index) => {
    const filename = path.join(process.cwd(), "tests", "__mocks__", `page-loading-${index}.js`);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
    return [name, filename];
  }));
  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (mockPaths[request]) return mockPaths[request];
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  try {
    const { default: HomePage } = require("../app/page") as typeof import("../app/page");
    const errors: unknown[] = [];
    const stream = await renderToReadableStream(HomePage({ searchParams: Promise.resolve({}) }), {
      signal: AbortSignal.timeout(5_000),
      onError: error => { errors.push(error); },
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    const shell = decoder.decode(first.value);
    assert.match(shell, /role="status"/);
    assert.match(shell, /Loading upload page\.\.\./, "The loading screen must stream before the database finishes");
    assert.match(shell, /guild-crest-v1/);
    assert.match(shell, /motion-reduce:animate-none/);
    assert.doesNotMatch(shell, /Upload controls ready|Upload a raid log/);
    assert.equal(countCalls, 3, "Existing homepage queries should be pending without added work");

    count.resolve(7);
    let completed = "";
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      completed += decoder.decode(chunk.value, { stream: true });
    }
    completed += decoder.decode();
    assert.deepEqual(errors, []);
    assert.match(completed, /Upload a raid log/);
    assert.match(completed, /Upload controls ready/, "The real page must replace its fallback when data is ready");
    assert.match(completed, /Boss Kills/);
    assert.equal(countCalls, 3, "Completing the stream must not refetch or add queries");
  } finally {
    count.resolve(7);
    loader._resolveFilename = originalResolve;
    for (const filename of Object.values(mockPaths)) delete require.cache[filename];
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
