import assert from "node:assert/strict";
import { resolveArmoryGearResult, shouldRefreshArmoryGearCache } from "../lib/warmane-armory";
import type { ArmoryCharacterGear, ArmoryGearResult } from "../lib/warmane-armory";

const cachedGear: ArmoryCharacterGear = {
  characterName: "Aalaska",
  realm: "Lordaeron",
  sourceUrl: "https://armory.warmane.com/character/Aalaska/Lordaeron/summary",
  fetchedAt: "2026-04-30T12:00:00.000Z",
  items: [{ slot: "Head", name: "Cached Hat" }],
  appearance: null,
};

const liveFailure: ArmoryGearResult = {
  ok: false,
  sourceUrl: cachedGear.sourceUrl,
  message: "Gear data is temporarily unavailable from Warmane Armory.",
};

const liveAppearance = {
  modelId: "draeneifemale",
  skin: 0,
  hairStyle: 5,
  hairColor: 3,
  face: 7,
  facialHair: 0,
  faceColor: 0,
  earPiercing: 0,
  hornStyle: 4,
  tattoo: 0,
  classId: 2,
  items: [[1, 63931], [16, 48563]] as Array<[number, number]>,
};

assert.deepEqual(
  resolveArmoryGearResult({ cachedGear, liveResult: liveFailure }),
  { ok: true, gear: cachedGear, stale: true },
);

assert.deepEqual(
  resolveArmoryGearResult({
    cachedGear,
    liveResult: { ...liveFailure, appearance: liveAppearance },
  }),
  {
    ok: true,
    gear: { ...cachedGear, appearance: liveAppearance },
    stale: true,
  },
  "a healthy profile recipe upgrades cached gear even when the equipment API fails",
);

const liveGear: ArmoryCharacterGear = {
  ...cachedGear,
  fetchedAt: "2026-04-30T13:00:00.000Z",
  items: [{ slot: "Head", name: "Fresh Hat" }],
};

assert.deepEqual(
  resolveArmoryGearResult({ cachedGear, liveResult: { ok: true, gear: liveGear } }),
  { ok: true, gear: liveGear },
);

const freshButPartialGear: ArmoryCharacterGear = {
  ...cachedGear,
  fetchedAt: "2026-04-30T12:00:00.000Z",
  items: [{ slot: "Head", name: "Lightsworn Helmet", itemId: "50326" }],
};

assert.equal(
  shouldRefreshArmoryGearCache({
    cachedGear: freshButPartialGear,
    now: new Date("2026-04-30T12:05:00.000Z"),
  }),
  true,
);

assert.equal(
  shouldRefreshArmoryGearCache({
    cachedGear: {
      ...freshButPartialGear,
      items: [{
        slot: "Head",
        name: "Lightsworn Helmet",
        itemId: "50326",
        itemLevel: 251,
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_154.jpg",
        itemUrl: "https://www.wowhead.com/wotlk/item=50326/lightsworn-helmet",
        equipLoc: "INVTYPE_HEAD",
        details: ["Item Level 251"],
      }],
    },
    now: new Date("2026-04-30T12:05:00.000Z"),
  }),
  false,
);

const legacyGear: ArmoryCharacterGear = { ...cachedGear };
delete legacyGear.appearance;
assert.equal(
  shouldRefreshArmoryGearCache({
    cachedGear: legacyGear,
    now: new Date("2026-04-30T12:01:00.000Z"),
  }),
  true,
  "legacy snapshots without an appearance field refresh once",
);

assert.equal(
  shouldRefreshArmoryGearCache({
    cachedGear: {
      ...freshButPartialGear,
      fetchedAt: "2026-04-30T12:00:00.000Z",
      items: [{
        slot: "Head",
        name: "Lightsworn Helmet",
        itemId: "50326",
        itemLevel: 251,
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_154.jpg",
        equipLoc: "INVTYPE_HEAD",
      }],
    },
    now: new Date("2026-04-30T12:06:00.000Z"),
    maxAgeMs: 5 * 60 * 1000,
  }),
  true,
  "the quick-look path can use a shorter cache window than full profile pages",
);

console.log("warmane-armory-cache tests passed");
