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
        rankOrder: 0,
        professionsJson: [
          { name: "Engineering", skill: 450 },
          { name: "Jewelcrafting", skill: 450 },
        ],
        gearScore: 5875,
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
assert.match(markup, /5,875/);
assert.match(markup, /Engineering 450/);
assert.match(markup, /Jewelcrafting 450/);
assert.match(markup, /\/players\/Azyva/);
assert.match(markup, /data-pizza-avatar="character"/);
assert.match(markup, /data-character-name="Azyva"/);
assert.match(markup, /data-character-realm="Lordaeron"/);
assert.match(markup, /data-character-race="Night Elf"/);
assert.match(markup, /classicon_druid/);
assert.match(markup, /reveal-item/);
assert.match(markup, /--reveal-index:0/);

console.log("guild-roster-table-render tests passed");
