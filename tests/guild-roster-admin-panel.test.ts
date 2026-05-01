import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRosterSyncPanel } from "../app/admin/GuildRosterSyncPanel";

const markup = renderToStaticMarkup(
  React.createElement(GuildRosterSyncPanel, {
    rosterCount: 42,
    latestSync: new Date("2026-05-01T12:00:00.000Z"),
  }),
);

assert.match(markup, /Roster Members/);
assert.match(markup, /42/);
assert.match(markup, /Warmane/);
assert.match(markup, /guild_roster_members/);
assert.match(markup, /View public roster/);

console.log("guild-roster-admin-panel tests passed");
