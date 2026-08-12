import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getPlayerGearTooltipPosition, PlayerAvatar } from "../components/players/PlayerAvatar";

assert.deepEqual(
  getPlayerGearTooltipPosition(
    { left: 40, right: 84, top: 100, bottom: 144 },
    { width: 480, height: 420 },
    { width: 1280, height: 800 },
  ),
  { left: 12, top: 154 },
);

assert.deepEqual(
  getPlayerGearTooltipPosition(
    { left: 300, right: 344, top: 650, bottom: 694 },
    { width: 351, height: 500 },
    { width: 375, height: 812 },
  ),
  { left: 12, top: 140 },
  "keeps the compact quick look inside a narrow mobile viewport",
);

const markup = renderToStaticMarkup(React.createElement(PlayerAvatar, {
  name: "Lausudo",
  realmName: "Lordaeron",
  characterClass: "Paladin",
  raceName: "Human",
  guildName: "Pizza Warriors",
  color: "#f58cba",
  fallbackIconUrl: "https://cdn.warmane.com/wotlk/icons/large/classicon_paladin.jpg",
  size: "sm",
}));

assert.match(markup, /<button/);
assert.match(markup, /aria-label="View live gear for Lausudo"/);
assert.match(markup, /data-pizza-avatar-state="class-icon"/);
assert.match(markup, /classicon_paladin/);
assert.match(markup, /min-h-11 min-w-11/);

const source = fs.readFileSync("components/players/PlayerAvatar.tsx", "utf8");
assert.match(source, /\/api\/players\/\$\{encodeURIComponent\(name\)\}\/gear/);
assert.match(source, /createPortal\(/);
assert.match(source, /role="tooltip"/);
assert.match(source, /Pulling current gear from Warmane/);
assert.match(source, /Live Armory/);
assert.match(source, /w-\[min\(46rem,calc\(100vw-1\.5rem\)\)\]/);
assert.match(source, /grid-cols-2[^\n]*sm:grid-cols-3/);
assert.doesNotMatch(source, /max-h-\[min\(24rem,65vh\)\]|overflow-hidden px-3 py-3 sm:grid-cols-2/);

console.log("player-gear-quicklook tests passed");
