import assert from "node:assert/strict";
import {
  getPlayerGearGroups,
  PAPER_DOLL_LEFT_SLOTS,
  PAPER_DOLL_RIGHT_SLOTS,
  PAPER_DOLL_WEAPON_SLOTS,
} from "../lib/gear-layout";

assert.equal(PAPER_DOLL_LEFT_SLOTS.length, 8);
assert.equal(PAPER_DOLL_RIGHT_SLOTS.length, 8);
assert.deepEqual(PAPER_DOLL_WEAPON_SLOTS, ["Main Hand", "Off Hand", "Ranged/Relic"]);

const groups = getPlayerGearGroups([
  { slot: "Head", name: "Head" },
  { slot: "Wrist", name: "Wrist" },
  { slot: "Finger 1", name: "Ring" },
  { slot: "Trinket 1", name: "Trinket" },
  { slot: "Main Hand", name: "Staff" },
  { slot: "Ranged/Relic", name: "Wand" },
]);

assert.deepEqual(groups.left.map((item) => item.slot), ["Head", "Wrist"]);
assert.deepEqual(groups.right.map((item) => item.slot), ["Finger 1", "Trinket 1"]);
assert.deepEqual(groups.weapons.map((item) => item.slot), ["Main Hand", "Ranged/Relic"]);

console.log("gear-layout tests passed");
