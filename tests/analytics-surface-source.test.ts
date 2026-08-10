import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const parser = readFileSync("parser/parser_core.py", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");
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
assert.match(encounterPage, /Absorb Breakdown/);
assert.match(encounterPage, /Aura Uptime/);
assert.match(encounterPage, /Consumables/);
assert.match(encounterPage, /Power Gains/);
assert.match(encounterPage, /Death Timeline/);

console.log("analytics-surface-source tests passed");
