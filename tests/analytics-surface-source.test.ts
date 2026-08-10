import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const parser = readFileSync("parser/parser_core.py", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");
const sessionPage = readFileSync("app/uploads/[id]/sessions/[sessionIdx]/page.tsx", "utf8");
const meter = readFileSync("components/meter/DamageMeter.tsx", "utf8");
const uploadRoute = readFileSync("app/api/upload/route.ts", "utf8");

for (const field of [
  "totalAbsorbs",
  "unattributedAbsorbs",
  "absorbBreakdown",
  "auraBreakdown",
  "consumableBreakdown",
  "powerBreakdown",
  "deathEvents",
]) {
  assert.match(schema, new RegExp(field), `${field} remains in the database contract`);
  assert.match(uploadRoute, new RegExp(field), `${field} remains in upload persistence`);
}

assert.match(parser, /infer_spec/);
assert.match(parser, /ambiguousHits/);
assert.match(parser, /recentDamage/);
assert.match(parser, /reported_damage_taken_amount/);
assert.match(parser, /_owner_evidence_from_event/);
assert.match(parser, /recently_removed_absorb_auras/);
assert.match(encounterPage, /Absorb Breakdown/);
assert.match(encounterPage, /Healing \+ Absorbs \(UwU-compatible\)/);
assert.match(encounterPage, /Effective Healing Breakdown/);
assert.match(encounterPage, /Aura Uptime/);
assert.match(encounterPage, /Consumables/);
assert.match(encounterPage, /Power Gains/);
assert.match(encounterPage, /Death Timeline/);
assert.match(sessionPage, /Encounter Damage/);
assert.match(sessionPage, /Full Log Damage/);
assert.match(sessionPage, /Heal \+ Absorbs/);
assert.match(meter, /H\+A PS/);

console.log("analytics-surface-source tests passed");
