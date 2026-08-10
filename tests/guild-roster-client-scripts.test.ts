import assert from "node:assert/strict";
import vm from "node:vm";
import {
  LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
  GUILD_ROSTER_USERSCRIPT_URL,
  buildGuildRosterBookmarklet,
  buildGuildRosterUserscript,
} from "../lib/guild-roster-client-scripts";
import { PIZZA_LOGS_LOCAL_ORIGIN } from "../lib/armory-gear-client-scripts";

const userscript = buildGuildRosterUserscript();
const localUserscript = buildGuildRosterUserscript({
  pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
  userscriptUrl: LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
  nameSuffix: " (Local)",
});
assert.match(userscript, /Pizza Logs Warmane Guild Roster Sync/);
assert.match(userscript, /api\/admin\/guild-roster\/import/);
assert.match(userscript, /\/\/ @version\s+1\.1\.1/);
assert.match(userscript, /\/\/ @match\s+https:\/\/armory\.warmane\.com\/guild\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/armory\.warmane\.com\/guild\/\*/);
assert.match(userscript, /pizzaLogsAdminSecret:https:\/\/pizza-logs-production\.up\.railway\.app/);
assert.match(userscript, /pizzaLogsLastRosterSyncAt:https:\/\/pizza-logs-production\.up\.railway\.app/);
assert.match(userscript, /autoIntervalMs\d?=60\*60\*1e3/);
assert.match(userscript, /scheduleNextAutoSync/);
assert.match(userscript, /autoTimer/);
assert.match(userscript, /clearTimeout/);
assert.match(userscript, /isGuildPage/);
assert.match(userscript, /api\/guild\/Pizza\+Warriors\/Lordaeron\/summary/);
assert.match(userscript, /guild\/Pizza\+Warriors\/Lordaeron\/summary/);
assert.ok(
  userscript.indexOf("GUILD_HTML_PATH") === -1
  && userscript.indexOf("guild/Pizza+Warriors/Lordaeron/summary") < userscript.indexOf("api/guild/Pizza+Warriors/Lordaeron/summary"),
);
assert.match(userscript, new RegExp(GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, /Pizza Logs Warmane Guild Roster Sync \(Local\)/);
assert.match(localUserscript, new RegExp(LOCAL_GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, new RegExp(`pizzaLogsAdminSecret:${PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.doesNotMatch(localUserscript, /pizzaLogsAdminSecret:https:\/\/pizza-logs-production\.up\.railway\.app/);
assert.match(localUserscript, /127\.0\.0\.1:3001/);
assert.match(localUserscript, /Target:/);
assert.match(localUserscript, /Admin secret rejected by/);
assert.match(localUserscript, /\/api\/admin\/guild-roster\/import/);

const bookmarklet = buildGuildRosterBookmarklet();
assert.match(bookmarklet, /^javascript:/);
assert.match(bookmarklet, /api\/admin\/guild-roster\/import/);
assert.match(bookmarklet, /Pizza\+Warriors/);

async function verifyUserscriptAutoRunsWithSavedSecret() {
  const pending: Promise<unknown>[] = [];
  const importBodies: Array<{ secret?: string; guild?: string; realm?: string; html?: string }> = [];
  const storage = new Map<string, string>([
    ["pizzaLogsAdminSecret:https://pizza-logs-production.up.railway.app", "secret"],
    ["pizzaLogsLastRosterSyncAt:https://pizza-logs-production.up.railway.app", "0"],
  ]);

  const context = {
    console: { warn() {} },
    Date,
    location: {
      hostname: "armory.warmane.com",
      pathname: "/guild/Pizza+Warriors/Lordaeron/summary",
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    prompt: () => {
      throw new Error("Auto-sync should use the saved secret");
    },
    setTimeout: (callback: () => unknown, delay?: number) => {
      if (typeof delay === "number" && delay > 5000) return 1;
      const result = callback();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        pending.push(result as Promise<unknown>);
      }
      return 1;
    },
    clearTimeout() {},
    document: {
      body: { appendChild() {} },
      addEventListener() {},
      createElement: () => ({
        style: { cssText: "" },
        append() {},
        addEventListener() {},
        textContent: "",
        type: "",
        disabled: false,
      }),
    },
    fetch: async (url: string, init?: { body?: string }) => {
      if (url === "/guild/Pizza+Warriors/Lordaeron/summary") {
        return { ok: true, text: async () => "<html>roster</html>" };
      }
      if (url.endsWith("/api/admin/guild-roster/import")) {
        importBodies.push(JSON.parse(init?.body ?? "{}"));
        return { ok: true, json: async () => ({ ok: true, count: 25 }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  };

  vm.runInNewContext(userscript, context);
  while (pending.length > 0) {
    await Promise.all(pending.splice(0));
  }

  assert.equal(importBodies.length, 1);
  assert.equal(importBodies[0].secret, "secret");
  assert.equal(importBodies[0].guild, "PizzaWarriors");
  assert.equal(importBodies[0].realm, "Lordaeron");
  assert.equal(importBodies[0].html, "<html>roster</html>");
  assert.notEqual(storage.get("pizzaLogsLastRosterSyncAt:https://pizza-logs-production.up.railway.app"), "0");
}

verifyUserscriptAutoRunsWithSavedSecret()
  .then(() => console.log("guild-roster-client-scripts tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
