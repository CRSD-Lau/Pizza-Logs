import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accordion = readFileSync("components/ui/AccordionSection.tsx", "utf8");
const damageMeter = readFileSync("components/meter/DamageMeter.tsx", "utf8");
const mobBreakdown = readFileSync("components/meter/MobBreakdown.tsx", "utf8");
const leaderboardBar = readFileSync("components/charts/LeaderboardBar.tsx", "utf8");
const playersPage = readFileSync("app/players/page.tsx", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");
const sessionPage = readFileSync(
  "app/uploads/[id]/sessions/[sessionIdx]/page.tsx",
  "utf8",
);

// Mobile data panels expand into the page gutter. The accordion's animated
// overflow clip must expand by the same amount or it cuts 16px from both sides.
assert.match(
  accordion,
  /"-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0"/,
  "accordion clipping region must include full-bleed mobile data panels",
);

// All encounter metric variants share the same responsive meter implementation.
for (const metric of ["dps", "ha", "hps", "aps"]) {
  assert.match(encounterPage, new RegExp(`<DamageMeter participants=\\{[^}]+\\} metric="${metric}"`));
}
assert.match(encounterPage, /<MobBreakdown mobs=\{mobEntries\}/);
assert.match(sessionPage, /<MobBreakdown mobs=\{mobEntries\}/);

// Meter rows stay mobile-native and must never reintroduce a forced table width.
assert.match(damageMeter, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
assert.match(mobBreakdown, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
assert.doesNotMatch(damageMeter, /min-w-\[/);
assert.doesNotMatch(mobBreakdown, /min-w-\[/);

// The other class-color bar families are already contained within mobile gutters.
assert.match(leaderboardBar, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
assert.match(playersPage, /className="flex-1 h-3 bg-bg-card rounded-sm overflow-hidden"/);

console.log("mobile meter source tests passed");
