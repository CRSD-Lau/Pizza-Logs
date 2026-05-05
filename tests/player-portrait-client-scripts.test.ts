import assert from "node:assert/strict";
import {
  buildPlayerPortraitUserscript,
  LOCAL_PORTRAIT_USERSCRIPT_URL,
  PORTRAIT_USERSCRIPT_PATH,
  PORTRAIT_USERSCRIPT_URL,
} from "../lib/player-portrait-client-scripts";
import { PIZZA_LOGS_LOCAL_ORIGIN } from "../lib/armory-gear-client-scripts";

const userscript = buildPlayerPortraitUserscript();
const localUserscript = buildPlayerPortraitUserscript({
  pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
  userscriptUrl: LOCAL_PORTRAIT_USERSCRIPT_URL,
  nameSuffix: " (Local)",
});

assert.equal(PORTRAIT_USERSCRIPT_PATH, "/api/player-portraits/userscript.user.js");
assert.equal(PORTRAIT_USERSCRIPT_URL, "https://pizza-logs-production.up.railway.app/api/player-portraits/userscript.user.js");
assert.equal(LOCAL_PORTRAIT_USERSCRIPT_URL, "http://127.0.0.1:3001/api/player-portraits/userscript.local.user.js");
assert.match(userscript, /\/\/ ==UserScript==/);
assert.match(userscript, /\/\/ @name\s+Pizza Logs Warmane Portraits/);
assert.match(localUserscript, /\/\/ @name\s+Pizza Logs Warmane Portraits \(Local\)/);
assert.match(localUserscript, new RegExp(`// @namespace\\s+${PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, new RegExp(`// @downloadURL\\s+${LOCAL_PORTRAIT_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(userscript, /\/\/ @version\s+0\.6\.0/);
assert.match(userscript, /Deprecated no-op compatibility update/);
assert.match(userscript, /class icons are built into the app/);
assert.match(userscript, /\/\/ @grant\s+none/);
assert.doesNotMatch(userscript, /GM_xmlhttpRequest|GM_getValue|GM_setValue/);
assert.doesNotMatch(userscript, /data-pizza-avatar|pizzaPortraitQueued|data-pizza-portrait-queued|toDataURL|querySelectorAll/);

console.log("player-portrait-client-scripts tests passed");
