import assert from "node:assert/strict";
import vm from "node:vm";
import {
  buildGuildRosterUserscript,
  GUILD_ROSTER_USERSCRIPT_URL,
  LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
} from "../lib/guild-roster-client-scripts";
import { PIZZA_LOGS_LOCAL_ORIGIN, PIZZA_LOGS_ORIGIN } from "../lib/armory-gear-client-scripts";

const userscript = buildGuildRosterUserscript();
const localUserscript = buildGuildRosterUserscript({
  pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
  userscriptUrl: LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
  nameSuffix: " (Local)",
});

assert.match(userscript, /Pizza Logs Warmane Guild Roster Sync/);
assert.match(userscript, /\/\/ @version\s+2\.0\.0/);
assert.match(userscript, /Retired compatibility update/);
assert.match(userscript, new RegExp(GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, /Pizza Logs Warmane Guild Roster Sync \(Local\)/);
assert.match(localUserscript, new RegExp(LOCAL_GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(userscript, /GM_xmlhttpRequest|fetch\(|\/api\/admin\/guild-roster\/import|scheduleNextAutoSync|setTimeout/);

const removedKeys: string[] = [];
vm.runInNewContext(userscript, {
  console: { info() {} },
  localStorage: { removeItem(key: string) { removedKeys.push(key); } },
});

assert.deepEqual(removedKeys, [
  `pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN}`,
  `pizzaLogsLastRosterSyncAt:${PIZZA_LOGS_ORIGIN}`,
  "pizzaLogsAdminSecret",
  "pizzaLogsLastRosterSyncAt",
]);

console.log("guild-roster-client-scripts retirement tests passed");
