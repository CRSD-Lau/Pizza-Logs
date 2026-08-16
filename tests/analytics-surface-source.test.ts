import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readUiSources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readUiSources(path);
    return entry.isFile() && entry.name.endsWith(".tsx")
      ? [readFileSync(path, "utf8")]
      : [];
  });
}

const parser = readFileSync("parser/parser_core.py", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");
const sessionPage = readFileSync("app/uploads/[id]/sessions/[sessionIdx]/page.tsx", "utf8");
const meter = readFileSync("components/meter/DamageMeter.tsx", "utf8");
const filteredAnalytics = readFileSync("components/analytics/FilteredAnalyticsBreakdown.tsx", "utf8");
const uploadRoute = readFileSync("app/api/upload/route.ts", "utf8");
const publicUiSource = [...readUiSources("app"), ...readUiSources("components")].join("\n");

for (const field of [
  "totalAbsorbs",
  "unattributedAbsorbs",
  "absorbBreakdown",
  "auraBreakdown",
  "consumableBreakdown",
  "powerBreakdown",
  "deathEvents",
  "sessionAnalytics",
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
assert.match(encounterPage, /Healing \+ Absorbs/);
assert.match(encounterPage, /Effective Healing Breakdown/);
assert.match(encounterPage, /Aura Uptime/);
assert.match(encounterPage, /Consumables/);
assert.match(encounterPage, /Power Gains/);
assert.match(encounterPage, /FilteredAnalyticsBreakdown/);
assert.match(filteredAnalytics, /type="search"/);
assert.match(filteredAnalytics, /<datalist/);
assert.match(filteredAnalytics, /aria-invalid/);
assert.match(filteredAnalytics, /aria-live="polite"/);
assert.match(filteredAnalytics, /Clear filters/);
assert.match(filteredAnalytics, /const PAGE_SIZE = 50/);
assert.match(filteredAnalytics, /Show \{Math\.min\(PAGE_SIZE, remainingRows\)\} more/);
assert.match(filteredAnalytics, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)_auto_auto\]/);
assert.match(encounterPage, /Death Timeline/);
assert.match(sessionPage, /Full Session Breakdown/);
assert.match(sessionPage, /label="Total Damage"/);
assert.match(sessionPage, /label="Heal"/);
assert.match(sessionPage, /label="Damage Taken"/);
assert.match(sessionPage, /formatDurationPrecise/);
assert.match(sessionPage, /first to last log event/);
assert.match(meter, /H\+A PS/);
assert.doesNotMatch(publicUiSource, /%c\b/, "critical-hit rate is written out in public UI");
assert.doesNotMatch(publicUiSource, /\bUwU\b/i, "public UI uses Pizza Logs-native wording");
assert.doesNotMatch(publicUiSource, /Custom Slice/i, "public UI avoids external report terminology");

console.log("analytics-surface-source tests passed");
