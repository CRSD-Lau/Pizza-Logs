import assert from "node:assert/strict";
import { parseWowheadTooltipJson } from "../lib/wowhead-items";

// Sample Wowhead /wotlk/tooltip/item/51167 JSON response
const tooltipJson = {
  name: "Sanctified Lightsworn Headpiece",
  quality: 4,
  icon: "inv_helmet_154",
  tooltip: [
    '<table><tr><td>',
    '<b class="q4">Sanctified Lightsworn Headpiece</b>',
    '<span class="q"><br>Item Level <!--ilvl-->264</span>',
    '<br>Binds when picked up',
    '<table width="100%"><tr><td>Head</td><th><span class="q1">Plate</span></th></tr></table>',
    '<span>2145 Armor</span><br>',
    '<span>+123 Stamina</span><br>',
    '<span>+123 Intellect</span><br>',
    'Durability 100 / 100',
    '</td></tr></table>',
  ].join(""),
  jsonequip: { slotbak: 1, armor: 2145, sta: 123, int: 123 },
};

const parsed = parseWowheadTooltipJson(51167, tooltipJson);

assert.strictEqual(parsed.itemId, "51167");
assert.strictEqual(parsed.name, "Sanctified Lightsworn Headpiece");
assert.strictEqual(parsed.quality, "epic");
assert.strictEqual(parsed.itemLevel, 264);
assert.strictEqual(parsed.iconUrl, "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_154.jpg");
assert.strictEqual(parsed.itemUrl, "https://www.wowhead.com/wotlk/item=51167/sanctified-lightsworn-headpiece");
assert.strictEqual(parsed.equipLoc, "INVTYPE_HEAD");
assert.ok(Array.isArray(parsed.details) && parsed.details.length > 0, "details should be populated");
assert.ok(parsed.details?.includes("Sanctified Lightsworn Headpiece"), "details should include item name");
assert.ok(parsed.details?.includes("2145 Armor"), "details should include armor value");

// Missing fields degrade gracefully — no name, no icon, no tooltip, no jsonequip
const minimal = parseWowheadTooltipJson(12345, { quality: 3 });
assert.strictEqual(minimal.itemId, "12345");
assert.strictEqual(minimal.quality, "rare");
assert.strictEqual(minimal.name, undefined);
assert.strictEqual(minimal.itemLevel, undefined);
assert.strictEqual(minimal.equipLoc, undefined);

// slotbak=4 → INVTYPE_CHEST, slotbak=8 → INVTYPE_FEET, slotbak=11 → INVTYPE_FINGER
for (const [slotbak, expected] of [
  [4, "INVTYPE_CHEST"],
  [8, "INVTYPE_FEET"],
  [11, "INVTYPE_FINGER"],
  [13, "INVTYPE_TRINKET"],
  [17, "INVTYPE_2HWEAPON"],
] as const) {
  const result = parseWowheadTooltipJson(1, { jsonequip: { slotbak } });
  assert.strictEqual(result.equipLoc, expected, `slotbak ${slotbak} should map to ${expected}`);
}

console.log("wowhead-items tests passed");
