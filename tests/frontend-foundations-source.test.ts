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
const analyticsBreakdown = readFileSync("components/analytics/FilteredAnalyticsBreakdown.tsx", "utf8");
const sessionChart = readFileSync("components/charts/SessionLineChart.tsx", "utf8");
const playerSessionPage = readFileSync("app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx", "utf8");

assert.doesNotMatch(tailwind, /colors:/, "Tailwind v4 theme variables are the single color source");
for (const variable of [
  "bg-card",
  "gold",
  "gold-light",
  "text-primary",
  "text-secondary",
  "text-dim",
  "school-physical",
  "school-holy",
  "school-fire",
  "school-nature",
  "school-frost",
  "school-shadow",
  "school-arcane",
]) {
  assert.match(globals, new RegExp(`--color-${variable}:`), `${variable} is available to utilities and inline SVG styles`);
}
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
assert.match(damageMeter, /spell\[outputMetric\]/);
assert.match(damageMeter, /metric === "dps" \? "damage" : "healing"/);
assert.match(damageMeter, /formatCountLabel\(s.hits, "total event"\)/);
assert.doesNotMatch(damageMeter, /bg-holy/);
assert.doesNotMatch(damageMeter, /gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr"/);
assert.match(mobBreakdown, /aria-expanded=\{isOpen\}/);
assert.doesNotMatch(mobBreakdown, /gridTemplateColumns: "2fr 1fr 1fr 1fr"/);

assert.match(readFileSync("lib/player-directory.ts", "utf8"), /PLAYERS_PER_PAGE = 30/);
assert.match(playersPage, /<PlayerDirectory players=\{data.players\}/);
assert.match(leaderboardsPage, /<AccordionSection/);
assert.match(encounterPage, /defaultOpen=\{false\}/);
assert.match(analyticsBreakdown, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)_auto_auto\]/);
assert.match(sessionChart, /var\(--color-text-secondary\)/);
assert.match(sessionChart, /strokeOpacity=\{p\.isSubject \? 1 : 0\.78\}/);
assert.match(sessionChart, /interval="preserveStartEnd"/);
assert.match(sessionChart, /minTickGap=\{18\}/);
assert.match(playerSessionPage, /var\(--color-gold-light\)/);

console.log("frontend foundation source tests passed");
