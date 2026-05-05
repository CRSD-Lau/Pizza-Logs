import assert from "node:assert/strict";
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
assert.match(userscript, /\/\/ @version\s+1\.0\.4/);
assert.match(userscript, /\/\/ @match\s+https:\/\/armory\.warmane\.com\/guild\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/armory\.warmane\.com\/guild\/\*/);
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
assert.match(localUserscript, new RegExp(`const pizzaLogsOrigin = "${PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`));
assert.match(localUserscript, /\/api\/admin\/guild-roster\/import/);

const bookmarklet = buildGuildRosterBookmarklet();
assert.match(bookmarklet, /^javascript:/);
assert.match(bookmarklet, /api\/admin\/guild-roster\/import/);
assert.match(bookmarklet, /Pizza\+Warriors/);

console.log("guild-roster-client-scripts tests passed");
