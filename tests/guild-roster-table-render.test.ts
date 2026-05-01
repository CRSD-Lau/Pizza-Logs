import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRosterTable } from "../components/guild-roster/GuildRosterTable";

const emptyMarkup = renderToStaticMarkup(React.createElement(GuildRosterTable, { members: [] }));
assert.match(emptyMarkup, /No guild roster data yet/);

const markup = renderToStaticMarkup(
  React.createElement(GuildRosterTable, {
    members: [
      {
        id: "1",
        characterName: "Azyva",
        normalizedCharacterName: "azyva",
        guildName: "PizzaWarriors",
        realm: "Lordaeron",
        className: "Druid",
        raceName: "Night Elf",
        level: 80,
        rankName: "Small Council",
        armoryUrl: "https://armory.warmane.com/character/Azyva/Lordaeron/summary",
        gearSnapshotJson: null,
        lastSyncedAt: new Date("2026-04-30T12:00:00.000Z"),
        createdAt: new Date("2026-04-30T12:00:00.000Z"),
        updatedAt: new Date("2026-04-30T12:00:00.000Z"),
      },
    ],
  }),
);

assert.match(markup, /Azyva/);
assert.match(markup, /Druid/);
assert.match(markup, /Night Elf/);
assert.match(markup, /Small Council/);
assert.match(markup, /\/players\/Azyva/);

console.log("guild-roster-table-render tests passed");
