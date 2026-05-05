import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import {
  LOCAL_USERSCRIPT_URL,
  PIZZA_LOGS_LOCAL_ORIGIN,
} from "../lib/armory-gear-client-scripts";
import { LOCAL_GUILD_ROSTER_USERSCRIPT_URL } from "../lib/guild-roster-client-scripts";
import { LOCAL_PORTRAIT_USERSCRIPT_URL } from "../lib/player-portrait-client-scripts";

async function readLocalUserscript(routePath: string): Promise<string> {
  const moduleLoader = Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown,
    ) => string;
  };
  const originalResolve = moduleLoader._resolveFilename;

  moduleLoader._resolveFilename = function resolveAlias(request, parent, isMain, options) {
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

  try {
    const { GET } = require(routePath) as { GET: () => Promise<Response> | Response };
    const response = await GET();
    assert.equal(response.status, 200);
    return response.text();
  } finally {
    moduleLoader._resolveFilename = originalResolve;
  }
}

async function main() {
  const gear = await readLocalUserscript("../app/api/admin/armory-gear/userscript.local.user.js/route");
  const roster = await readLocalUserscript("../app/api/admin/guild-roster/userscript.local.user.js/route");
  const portrait = await readLocalUserscript("../app/api/player-portraits/userscript.local.user.js/route");

  assert.match(gear, /Pizza Logs Warmane Gear Auto Sync \(Local\)/);
  assert.match(gear, new RegExp(LOCAL_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(gear, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(roster, /Pizza Logs Warmane Guild Roster Sync \(Local\)/);
  assert.match(roster, new RegExp(LOCAL_GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(roster, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(portrait, /Pizza Logs Warmane Portraits \(Local\)/);
  assert.match(portrait, new RegExp(LOCAL_PORTRAIT_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(portrait, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(portrait, /Deprecated no-op compatibility update/);
  assert.doesNotMatch(portrait, /GM_xmlhttpRequest|pizzaPortraitQueued|data-pizza-portrait-queued/);

  console.log("local-userscript-routes tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
