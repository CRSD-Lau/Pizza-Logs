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

assert.match(sessionPage, /aria-label="Full session player metrics"/);
assert.match(sessionPage, /className="data-panel md:hidden"/);
assert.match(sessionPage, /className="data-panel hidden md:block"/);
assert.doesNotMatch(sessionPage, /min-w-\[760px\]/);
for (const label of ["Total Damage", "DPS", "Heal", "HPS", "Damage Taken", "DTPS"]) {
  assert.match(sessionPage, new RegExp(`>${label}<`), `${label} remains visible in the mobile summary`);
}

assert.match(guildRosterTable, /aria-label="Guild roster members"/);
assert.match(guildRosterTable, /className="divide-y divide-gold-dim xl:hidden"/);
assert.match(guildRosterTable, /className="hidden overflow-x-auto xl:block"/);

console.log("mobile table source tests passed");
