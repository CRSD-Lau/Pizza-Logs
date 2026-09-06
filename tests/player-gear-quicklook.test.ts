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

const unknown = renderToStaticMarkup(React.createElement(PlayerAvatar, {
  name: "Unresolved", characterClass: "not-a-class", color: "#f58cba", fallbackIconUrl: "https://example.test/paladin.jpg",
}));
assert.match(unknown, /data-pizza-avatar-state="fallback-icon"/);
assert.match(unknown, /data-pizza-avatar-fallback="true"/);
assert.match(unknown, /color:#a3a3a3/);
assert.doesNotMatch(unknown, /paladin.jpg|#f58cba/, "An unverified player cannot inherit a class icon or a name-derived class color");

const source = fs.readFileSync("components/players/PlayerAvatar.tsx", "utf8");
const previewSource = fs.readFileSync("lib/player-gear-preview.ts", "utf8");
const modelSource = fs.readFileSync("components/players/WarmaneCharacterModel.tsx", "utf8");
assert.match(previewSource, /\/api\/players\/\$\{encodeURIComponent\(name.trim\(\)\)\}\/gear/);
assert.match(source, /createPortal\(/);
assert.match(source, /role="tooltip"/);
assert.match(source, /Loading gear from Warmane/);
assert.match(source, /Armory snapshot/);
assert.match(source, /w-\[min\(46rem,calc\(100vw-1\.5rem\)\)\]/);
assert.match(source, /PAPER_DOLL_LEFT_SLOTS\.map/);
assert.match(source, /PAPER_DOLL_RIGHT_SLOTS\.map/);
assert.match(source, /PAPER_DOLL_WEAPON_SLOTS\.map/);
assert.match(source, /grid-cols-\[minmax\(0,1fr\)_11rem_minmax\(0,1fr\)\]/);
assert.doesNotMatch(source, /max-h-\[min\(24rem,65vh\)\]|overflow-hidden px-3 py-3 sm:grid-cols-2/);
assert.match(source, /<WarmaneCharacterModel appearance=\{preview\.gear\.appearance\}/);
assert.match(modelSource, /sandbox="allow-scripts"/);
assert.match(modelSource, /Content-Security-Policy/);
assert.match(modelSource, /matchMedia\("\(min-width: 640px\)"\)/);
assert.match(modelSource, /attempts >= 8 && canvas/);
assert.doesNotMatch(modelSource, /allow-same-origin/);

console.log("player-gear-quicklook tests passed");
