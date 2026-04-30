import assert from "node:assert/strict";
import { buildUserscript, PIZZA_LOGS_ORIGIN, USERSCRIPT_PATH, USERSCRIPT_URL } from "../lib/armory-gear-client-scripts";

const userscript = buildUserscript();

assert.equal(PIZZA_LOGS_ORIGIN, "https://pizza-logs-production.up.railway.app");
assert.equal(USERSCRIPT_PATH, "/api/admin/armory-gear/userscript.user.js");
assert.equal(USERSCRIPT_URL, `${PIZZA_LOGS_ORIGIN}/api/admin/armory-gear/userscript.user.js`);
assert.match(userscript, /\/\/ ==UserScript==/);
assert.match(userscript, /\/\/ @name\s+Pizza Logs Warmane Gear Auto Sync/);
assert.match(userscript, new RegExp(`// @downloadURL\\s+${USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(userscript, new RegExp(`// @updateURL\\s+${USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(userscript, /\/\/ @match\s+https:\/\/armory\.warmane\.com\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/armory\.warmane\.com\/\*/);
assert.match(userscript, /\/\/ @run-at\s+document-idle/);
assert.match(userscript, /DOMContentLoaded/);
assert.match(userscript, /Pizza Logs userscript starting/);
assert.match(userscript, /Pizza Logs panel injection failed/);
assert.match(userscript, /Pizza Logs Gear Sync/);

console.log("armory-gear-client-scripts tests passed");
