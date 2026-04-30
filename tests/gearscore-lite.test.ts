import assert from "node:assert/strict";
import {
  calculateGearScore,
  calculateGearScoreForItem,
  getGearScoreQuality,
  mapWowheadInventoryTypeToEquipLoc,
} from "../lib/gearscore";
import type { GearScoreEquipLoc } from "../lib/gearscore";

assert.equal(mapWowheadInventoryTypeToEquipLoc(1), "INVTYPE_HEAD");
assert.equal(mapWowheadInventoryTypeToEquipLoc(17), "INVTYPE_2HWEAPON");
assert.equal(mapWowheadInventoryTypeToEquipLoc(26), "INVTYPE_RANGEDRIGHT");
assert.equal(mapWowheadInventoryTypeToEquipLoc(19), undefined);

assert.equal(
  calculateGearScoreForItem({
    slot: "Head",
    name: "Sanctified Lightsworn Headpiece",
    quality: "epic",
    itemLevel: 277,
    equipLoc: "INVTYPE_HEAD",
  })?.score,
  531,
);

assert.equal(
  calculateGearScoreForItem({
    slot: "Main Hand",
    name: "Oathbinder, Charge of the Ranger-General",
    quality: "epic",
    itemLevel: 284,
    equipLoc: "INVTYPE_2HWEAPON",
  })?.score,
  1103,
);

const gear = [
  { slot: "Head", name: "Head", quality: "epic", itemLevel: 277, equipLoc: "INVTYPE_HEAD" },
  { slot: "Neck", name: "Neck", quality: "epic", itemLevel: 277, equipLoc: "INVTYPE_NECK" },
  { slot: "Shirt", name: "Shirt", quality: "common", itemLevel: 1, equipLoc: "INVTYPE_BODY" },
  { slot: "Tabard", name: "Tabard", quality: "common", itemLevel: 1 },
  { slot: "Main Hand", name: "Main Hand", quality: "epic", itemLevel: 284, equipLoc: "INVTYPE_2HWEAPON" },
  { slot: "Off Hand", name: "Off Hand", quality: "epic", itemLevel: 284, equipLoc: "INVTYPE_2HWEAPON" },
  { slot: "Ranged", name: "Ranged", quality: "epic", itemLevel: 284, equipLoc: "INVTYPE_RANGEDRIGHT" },
] satisfies Array<{
  slot: string;
  name: string;
  quality: string;
  itemLevel: number;
  equipLoc?: GearScoreEquipLoc;
}>;

const score = calculateGearScore(gear);

assert.deepEqual(score, {
  score: 2106,
  averageItemLevel: 281,
  scoredItemCount: 5,
  quality: getGearScoreQuality(2106),
  itemScores: {
    "Head": 531,
    "Neck": 298,
    "Main Hand": 551,
    "Off Hand": 551,
    "Ranged": 174,
  },
});

assert.equal(calculateGearScore(gear, "Hunter")?.score, 2104);

console.log("gearscore-lite tests passed");
