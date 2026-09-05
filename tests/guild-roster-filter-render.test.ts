import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRosterTable, type GuildRosterTableMember } from "../components/guild-roster/GuildRosterTable";

const stamp = new Date("2026-09-05T12:00:00Z");
const members: GuildRosterTableMember[] = Array.from({ length: 45 }, (_, index) => ({
  id: String(index), characterName: index < 20 ? `Other${index}` : `Match${String(index - 19).padStart(2, "0")}`,
  normalizedCharacterName: "synthetic", guildName: "Synthetic Guild", realm: "Lordaeron",
  className: index === 44 ? "Mage" : "Rogue", raceName: "Human", level: 80, rankName: "Member",
  armoryUrl: "https://example.test/character", gearSnapshotJson: null,
  lastSyncedAt: stamp, createdAt: stamp, updatedAt: stamp,
}));

test("guild name and class filters run before the twenty-member page window", () => {
  const markup = renderToStaticMarkup(React.createElement(GuildRosterTable, { members, currentPage: 2, query: "mAtCh", classFilter: "Rogue" }));
  assert.match(markup, /Match21/);
  assert.match(markup, /Match24/);
  assert.doesNotMatch(markup, /Match20|Match25|Other0/);
  assert.match(markup, /21-24 of 24 members matching these filters/);
  assert.match(markup, /href="\/guild-roster\?q=mAtCh&amp;class=Rogue"/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*aria-label="Next roster page"/);
  assert.doesNotMatch(markup, /<span[^>]*aria-disabled/);
});

test("a narrower filter clamps an old page and distinguishes no matches from no roster", () => {
  const one = renderToStaticMarkup(React.createElement(GuildRosterTable, { members, currentPage: 99, query: "Match25", classFilter: "Mage" }));
  assert.match(one, /Match25/);
  assert.match(one, /Page 1 \/ 1/);
  const none = renderToStaticMarkup(React.createElement(GuildRosterTable, { members, query: "absent" }));
  assert.match(none, /No guild members match these filters/);
  assert.doesNotMatch(none, /No guild roster data yet|Admin Guild Roster Sync/);
});
