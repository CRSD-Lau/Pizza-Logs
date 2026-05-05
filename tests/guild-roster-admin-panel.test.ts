import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRosterSyncPanel } from "../app/admin/GuildRosterSyncPanel";
import { LOCAL_GUILD_ROSTER_USERSCRIPT_URL } from "../lib/guild-roster-client-scripts";

const markup = renderToStaticMarkup(
  React.createElement(GuildRosterSyncPanel, {
    rosterCount: 42,
    latestSync: new Date("2026-05-01T12:00:00.000Z"),
  }),
);

assert.match(markup, /Roster Members/);
assert.match(markup, /42/);
assert.match(markup, /Warmane/);
assert.match(markup, /Browser Roster Import/);
assert.match(markup, /userscript\.user\.js/);
assert.match(markup, /Install Local Roster Userscript/);
assert.match(markup, new RegExp(LOCAL_GUILD_ROSTER_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(markup, /View public roster/);

console.log("guild-roster-admin-panel tests passed");
