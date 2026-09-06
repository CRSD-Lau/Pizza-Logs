import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerDirectory, PlayerDirectoryRow, type PlayerDirectoryEntry } from "../components/players/PlayerDirectory";
import { PlayerDirectoryFilters } from "../components/players/PlayerDirectoryFilters";
import { WOW_CLASSES } from "../lib/constants/classes";
import { getPlayerClassMeta } from "../lib/player-class";

const basePlayer: PlayerDirectoryEntry = {
  id: "player-one",
  name: "Lausudo",
  class: "Paladin",
  classSource: "armory",
  realm: { name: "Lordaeron" },
  raceName: "Human",
  guildName: "Pizza Warriors",
  _count: { participants: 1234 },
};

for (const className of WOW_CLASSES) {
  const meta = getPlayerClassMeta(className);
  const markup = renderToStaticMarkup(React.createElement(PlayerDirectoryRow, {
    player: { ...basePlayer, class: className },
    includeShortPulls: true,
  }));
  assert.ok(markup.includes(`data-player-class="${className}"`));
  assert.ok(markup.includes(`color:${meta.textColor}`), `${className} name uses the readable hue of its class`);
  assert.ok(meta.iconUrl && markup.includes(meta.iconUrl), `${className} has the matching class icon before opening Armory`);
  assert.ok(markup.includes(`background-color:${meta.color}`), `${className} carries its authentic class swatch`);
  assert.match(markup, /1,234 pulls/);
  assert.match(markup, /Armory class/);
  assert.match(markup, /href="\/players\/Lausudo\?realm=Lordaeron&amp;includeShortPulls=1"/);
  assert.ok(markup.includes('href="https://armory.warmane.com/character/Lausudo/Lordaeron/summary"'));
  assert.match(markup, /opens in a new tab/);
  assert.match(markup, /min-h-11/);
}

const unknown = renderToStaticMarkup(React.createElement(PlayerDirectoryRow, {
  player: { ...basePlayer, class: null, classSource: "unknown", _count: { participants: 1 } },
}));
assert.match(unknown, /data-player-class="Unknown"/);
assert.match(unknown, /Unknown class/);
assert.match(unknown, /Class not yet known/);
assert.match(unknown, /1 pull</);
assert.ok(unknown.includes(`color:${getPlayerClassMeta(null).textColor}`));
assert.doesNotMatch(unknown, /Armory class|Combat-log class/);

const unknownFromArmory = renderToStaticMarkup(React.createElement(PlayerDirectoryRow, {
  player: { ...basePlayer, class: null, classSource: "armory" },
}));
assert.match(unknownFromArmory, /Unknown class/);
assert.match(unknownFromArmory, /Class not yet known/);
assert.doesNotMatch(unknownFromArmory, /Armory class/);

const combatLog = renderToStaticMarkup(React.createElement(PlayerDirectoryRow, {
  player: { ...basePlayer, class: "deathknight", classSource: "combat-log" },
}));
assert.match(combatLog, /data-player-class="Death Knight"/);
assert.match(combatLog, /classicon_deathknight/);
assert.match(combatLog, /Combat-log class/);

const realmIsolated = renderToStaticMarkup(React.createElement(PlayerDirectoryRow, {
  player: { ...basePlayer, realm: { name: "Icecrown" } },
}));
assert.match(realmIsolated, /data-player-realm="Icecrown"/);
assert.match(realmIsolated, /href="\/players\/Lausudo\?realm=Icecrown"/);
assert.match(realmIsolated, /\/character\/Lausudo\/Icecrown\/summary/);

// Server rendering must neither require a browser router nor request upstream gear.
const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async () => { requests += 1; throw new Error("Unexpected directory render fetch"); };
try {
  const directory = renderToStaticMarkup(React.createElement(PlayerDirectory, {
    players: [basePlayer], includeShortPulls: false,
  }));
  assert.match(directory, /aria-label="Players"/);
  assert.match(directory, /Lausudo/);
  assert.equal(requests, 0);
} finally {
  globalThis.fetch = originalFetch;
}

const filters = renderToStaticMarkup(React.createElement(PlayerDirectoryFilters, {
  query: "Lau", classFilter: "Paladin", includeShortPulls: true,
}));
assert.match(filters, /role="search"/);
assert.match(filters, /name="q"[^>]*value="Lau"/);
assert.match(filters, /<option value="Paladin" selected="">Paladin<\/option>/);
assert.match(filters, /name="includeShortPulls" value="1"/);
const selectedFilter = filters.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0];
assert.ok(selectedFilter);
assert.match(selectedFilter, /href="\/players\?q=Lau&amp;class=Paladin&amp;includeShortPulls=1"/);
assert.match(filters, /href="\/players\?includeShortPulls=1"/);
assert.doesNotMatch(filters, /name="page"|[?&]page=/);
for (const className of WOW_CLASSES) {
  assert.ok(filters.includes(getPlayerClassMeta(className).iconUrl!), `${className} filter includes its class icon`);
}

console.log("player-directory-render tests passed");
