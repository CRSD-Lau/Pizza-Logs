import assert from "node:assert/strict";
import vm from "node:vm";
import {
  buildUserscript,
  LOCAL_USERSCRIPT_URL,
  PIZZA_LOGS_LOCAL_ORIGIN,
  PIZZA_LOGS_ORIGIN,
  USERSCRIPT_URL,
} from "../lib/armory-gear-client-scripts";

const userscript = buildUserscript();
const localUserscript = buildUserscript({
  pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
  userscriptUrl: LOCAL_USERSCRIPT_URL,
  nameSuffix: " (Local)",
});

assert.match(userscript, /Pizza Logs Warmane Gear Auto Sync/);
assert.match(userscript, /\/\/ @version\s+2\.0\.0/);
assert.match(userscript, /Retired compatibility update/);
assert.match(userscript, new RegExp(USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, /Pizza Logs Warmane Gear Auto Sync \(Local\)/);
assert.match(localUserscript, new RegExp(LOCAL_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(userscript, /GM_xmlhttpRequest|fetch\(|\/api\/admin\/armory-gear\/(?:import|missing)|scheduleNextAutoSync|setTimeout/);

const removedKeys: string[] = [];
vm.runInNewContext(userscript, {
  console: { info() {} },
  localStorage: { removeItem(key: string) { removedKeys.push(key); } },
});

assert.deepEqual(removedKeys, [
  `pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN}`,
  `pizzaLogsLastGearSyncAt:${PIZZA_LOGS_ORIGIN}`,
  "pizzaLogsAdminSecret",
  "pizzaLogsLastGearSyncAt",
]);

console.log("armory-gear-client-scripts retirement tests passed");
