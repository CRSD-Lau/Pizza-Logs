import assert from "node:assert/strict";
import {
  GUILD_ROSTER_USERSCRIPT_URL,
  buildGuildRosterBookmarklet,
  buildGuildRosterUserscript,
} from "../lib/guild-roster-client-scripts";

const userscript = buildGuildRosterUserscript();
assert.match(userscript, /Pizza Logs Warmane Guild Roster Sync/);
assert.match(userscript, /api\/admin\/guild-roster\/import/);
assert.match(userscript, /\/\/ @version\s+1\.0\.2/);
assert.match(userscript, /api\/guild\/Pizza\+Warriors\/Lordaeron\/summary/);
assert.match(userscript, /guild\/Pizza\+Warriors\/Lordaeron\/summary/);
assert.ok(
  userscript.indexOf("GUILD_HTML_PATH") === -1
  && userscript.indexOf("guild/Pizza+Warriors/Lordaeron/summary") < userscript.indexOf("api/guild/Pizza+Warriors/Lordaeron/summary"),
);
assert.match(userscript, new RegExp(GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const bookmarklet = buildGuildRosterBookmarklet();
assert.match(bookmarklet, /^javascript:/);
assert.match(bookmarklet, /api\/admin\/guild-roster\/import/);
assert.match(bookmarklet, /Pizza\+Warriors/);

console.log("guild-roster-client-scripts tests passed");
