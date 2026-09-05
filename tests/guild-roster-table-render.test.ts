import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRosterTable } from "../components/guild-roster/GuildRosterTable";

const emptyMarkup = renderToStaticMarkup(React.createElement(GuildRosterTable, { members: [] }));
assert.match(emptyMarkup, /No guild roster data yet/);

const members = Array.from({ length: 25 }, (_, index) => {
  const number = index + 1;
  const characterName = number === 1 ? "Azyva" : `Roster${number}`;

  return {
    id: String(number),
    characterName,
    normalizedCharacterName: characterName.toLowerCase(),
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
    armoryUrl: `https://armory.warmane.com/character/${characterName}/Lordaeron/summary`,
    gearSnapshotJson: null,
    lastSyncedAt: new Date("2026-04-30T12:00:00.000Z"),
    createdAt: new Date("2026-04-30T12:00:00.000Z"),
    updatedAt: new Date("2026-04-30T12:00:00.000Z"),
  };
});

const markup = renderToStaticMarkup(React.createElement(GuildRosterTable, { members }));

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
assert.match(markup, /1–20 of 25 members/);
assert.match(markup, /Page 1 of 2/);
assert.match(markup, /href="\/guild-roster\?page=2"/);
assert.match(markup, /Roster20/);
assert.doesNotMatch(markup, /Roster21/);

const secondPageMarkup = renderToStaticMarkup(
  React.createElement(GuildRosterTable, { members, currentPage: 2 }),
);

assert.match(secondPageMarkup, /21–25 of 25 members/);
assert.match(secondPageMarkup, /Page 2 of 2/);
assert.match(secondPageMarkup, /href="\/guild-roster"/);
assert.match(secondPageMarkup, /Roster21/);
assert.doesNotMatch(secondPageMarkup, /Azyva/);

const zeroScore = renderToStaticMarkup(React.createElement(GuildRosterTable, { members: [{ ...members[0], gearScore: 0 }] }));
assert.match(zeroScore, /<span class="tabular-nums">0<\/span>/);
assert.doesNotMatch(zeroScore, /Unavailable/);
assert.match(zeroScore, /Apr 30, 2026, 12:00:00 UTC/);
assert.match(zeroScore, /1–1 of 1 member</);
const missingScore = renderToStaticMarkup(React.createElement(GuildRosterTable, { members: [{ ...members[0], gearScore: null }] }));
assert.match(missingScore, /aria-hidden="true">—<\/span><span class="sr-only">Unavailable/);

console.log("guild-roster-table-render tests passed");
