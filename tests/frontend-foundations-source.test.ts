import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tailwind = readFileSync("tailwind.config.mjs", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const pageLayout = readFileSync("components/ui/PageLayout.tsx", "utf8");
const accordion = readFileSync("components/ui/AccordionSection.tsx", "utf8");
const damageMeter = readFileSync("components/meter/DamageMeter.tsx", "utf8");
const mobBreakdown = readFileSync("components/meter/MobBreakdown.tsx", "utf8");
const playersPage = readFileSync("app/players/page.tsx", "utf8");
const leaderboardsPage = readFileSync("app/leaderboards/page.tsx", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");

assert.match(tailwind, /"text-dim": "#918772"/);
assert.match(tailwind, /"text-secondary": "#b3a68c"/);
assert.match(globals, /@utility page-shell/);
assert.match(globals, /@utility page-section/);
assert.match(globals, /@utility data-panel/);
assert.match(globals, /min-height: 2\.75rem/);
assert.match(pageLayout, /function PageShell/);
assert.match(pageLayout, /function PageHeader/);
assert.match(pageLayout, /function PageSection/);
assert.match(pageLayout, /function DataPanel/);

assert.match(accordion, /aria-expanded=\{open\}/);
assert.match(accordion, /aria-controls=\{contentId\}/);
assert.match(damageMeter, /<button/);
assert.match(damageMeter, /aria-expanded=\{isActive\}/);
assert.match(damageMeter, /sm:grid-cols-\[minmax\(0,2fr\)_repeat\(4,minmax\(0,1fr\)\)\]/);
assert.doesNotMatch(damageMeter, /gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr"/);
assert.match(mobBreakdown, /aria-expanded=\{isOpen\}/);
assert.doesNotMatch(mobBreakdown, /gridTemplateColumns: "2fr 1fr 1fr 1fr"/);

assert.match(playersPage, /PLAYERS_PER_PAGE = 30/);
assert.match(playersPage, /visiblePlayers/);
assert.match(leaderboardsPage, /<details/);
assert.match(encounterPage, /defaultOpen=\{false\}/);
assert.match(encounterPage, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)_auto_auto\]/);

console.log("frontend foundation source tests passed");
