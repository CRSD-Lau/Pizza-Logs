import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sessionPage = readFileSync(
  "app/uploads/[id]/sessions/[sessionIdx]/page.tsx",
  "utf8",
);
const guildRosterTable = readFileSync(
  "components/guild-roster/GuildRosterTable.tsx",
  "utf8",
);
const sessionPlayerTable = readFileSync("components/reports/SessionPlayerTable.tsx", "utf8");

assert.match(sessionPage, /<SessionPlayerTable rows=\{killBreakdownRows\} label="Boss kill player metrics"/);
assert.match(sessionPage, /<SessionPlayerTable rows=\{sessionBreakdownRows\} label="Full session player metrics"/);
assert.match(sessionPlayerTable, /className="data-panel xl:hidden"/);
assert.match(sessionPlayerTable, /className="data-panel hidden xl:block"/);
assert.doesNotMatch(sessionPlayerTable, /min-w-\[760px\]/);
for (const label of ["Total Damage", "DPS", "Healing + absorbs", "Healing + absorbs /s", "Damage Taken", "DTPS"]) {
  assert.ok(sessionPlayerTable.includes(`label: "${label}"`), `${label} remains available in the mobile summary`);
}

assert.match(guildRosterTable, /aria-label="Guild roster members"/);
assert.match(guildRosterTable, /className="divide-y divide-gold-dim xl:hidden"/);
assert.match(guildRosterTable, /className="hidden overflow-x-auto xl:block"/);

console.log("mobile table source tests passed");
