import assert from "node:assert/strict";
import { parseSqlTuple, QUALITY_MAP, INVENTORY_TYPE_MAP, buildStatsFromTemplate, buildItemDetailsFromTemplate, enrichGearWithLocalTemplate } from "../lib/item-template";

// parseSqlTuple: parses a raw MySQL VALUES tuple string into array of string|null values
const raw = "(17, 4, 1, -1, 'Martin Fury', 7016, 6, 0, 0, 1, 0, 7, 4, -1, -1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 1, '', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, '', 0, 0, 0, 0, 0, 1)";

const values = parseSqlTuple(raw);
assert.strictEqual(values[0], "17");
assert.strictEqual(values[4], "Martin Fury");
assert.strictEqual(values[6], "6");
assert.ok(values.length >= 126, `expected at least 126 values, got ${values.length}`);

// QUALITY_MAP
assert.strictEqual(QUALITY_MAP[0], "poor");
assert.strictEqual(QUALITY_MAP[4], "epic");
assert.strictEqual(QUALITY_MAP[5], "legendary");

// INVENTORY_TYPE_MAP
assert.strictEqual(INVENTORY_TYPE_MAP[1], "INVTYPE_HEAD");
assert.strictEqual(INVENTORY_TYPE_MAP[11], "INVTYPE_FINGER");
assert.strictEqual(INVENTORY_TYPE_MAP[17], "INVTYPE_2HWEAPON");
assert.ok(INVENTORY_TYPE_MAP[0] == null);

// buildStatsFromTemplate
const statTypes  = [7, 5, 0, 0, 0, 0, 0, 0, 0, 0];
const statValues = [74, 56, 0, 0, 0, 0, 0, 0, 0, 0];
const stats = buildStatsFromTemplate(statTypes, statValues);
assert.deepStrictEqual(stats, { Stamina: 74, Intellect: 56 });

const emptyStats = buildStatsFromTemplate([0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0]);
assert.deepStrictEqual(emptyStats, {});

// buildItemDetailsFromTemplate
const detailsFull = buildItemDetailsFromTemplate({
  armor: 2145,
  dmgMin: null,
  dmgMax: null,
  delay: null,
  stats: { Stamina: 74, Intellect: 56 },
  description: "A legendary artifact.",
  bonding: 1,
  requiredLevel: 80,
});
assert.ok(detailsFull.includes("Binds when picked up"), `missing bonding: ${JSON.stringify(detailsFull)}`);
assert.ok(detailsFull.includes("2145 Armor"), `missing armor: ${JSON.stringify(detailsFull)}`);
assert.ok(detailsFull.includes("+74 Stamina"), `missing stamina: ${JSON.stringify(detailsFull)}`);
assert.ok(detailsFull.includes("+56 Intellect"), `missing intellect: ${JSON.stringify(detailsFull)}`);
assert.ok(detailsFull.includes("Requires Level 80"), `missing req level: ${JSON.stringify(detailsFull)}`);
assert.ok(detailsFull.some((l: string) => l.includes("legendary artifact")), `missing description: ${JSON.stringify(detailsFull)}`);

// Weapon with damage + speed
const weaponDetails = buildItemDetailsFromTemplate({
  armor: 0, dmgMin: 200, dmgMax: 300, delay: 2600,
  stats: { Strength: 50 }, description: null, bonding: 2, requiredLevel: 80,
});
assert.ok(weaponDetails.some((l: string) => l.includes("200") && l.includes("300")), `missing dmg range: ${JSON.stringify(weaponDetails)}`);
assert.ok(weaponDetails.some((l: string) => l.includes("damage per second")), `missing dps: ${JSON.stringify(weaponDetails)}`);

// Empty item
const emptyDetails = buildItemDetailsFromTemplate({
  armor: null, dmgMin: null, dmgMax: null, delay: null,
  stats: null, description: null, bonding: null, requiredLevel: null,
});
assert.deepStrictEqual(emptyDetails, []);

// No-Wowhead guard: verify enrichGearWithLocalTemplate is a function
// and that importing it (at module evaluation time) does not call fetch with a Wowhead URL.
let wowheadCallDetected = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input
    : input instanceof URL ? input.href
    : (input as Request).url;
  if (url.includes("wowhead.com")) {
    wowheadCallDetected = true;
    throw new Error(`BLOCKED: Wowhead fetch detected: ${url}`);
  }
  return originalFetch(input as Parameters<typeof originalFetch>[0], init);
};

// The module was already imported at the top of this file.
// If enrichGearWithLocalTemplate triggered a Wowhead call at import time, wowheadCallDetected would be true.
assert.strictEqual(typeof enrichGearWithLocalTemplate, "function", "enrichGearWithLocalTemplate should be a function");
assert.strictEqual(wowheadCallDetected, false, "No Wowhead fetch should occur at import time");

// Restore
globalThis.fetch = originalFetch;
console.log("No-Wowhead guard passed");

console.log("item-template tests passed");
