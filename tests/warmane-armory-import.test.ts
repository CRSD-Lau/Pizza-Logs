import assert from "node:assert/strict";
import { collectWowItemIconBackfills, gearNeedsEnrichment, normalizeArmoryGearSlots, normalizeImportedArmoryGear } from "../lib/warmane-armory";

const result = normalizeImportedArmoryGear({
  characterName: "Ashien",
  realm: "Lordaeron",
  sourceUrl: "https://armory.warmane.com/character/Ashien/Lordaeron/summary",
  items: [
    {
      name: "Sanctified Lightsworn Headpiece",
      itemUrl: "https://armory.warmane.com/item/51272",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_158.jpg",
    },
    { name: "" },
  ],
});

assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.gear.characterName, "Ashien");
  assert.equal(result.gear.realm, "Lordaeron");
  assert.equal(result.gear.items.length, 1);
  assert.equal(result.gear.items[0].slot, "Head");
  assert.equal(result.gear.items[0].name, "Sanctified Lightsworn Headpiece");
}

assert.deepEqual(
  normalizeImportedArmoryGear({
    characterName: "../Ashien",
    realm: "Lordaeron",
    sourceUrl: "https://armory.warmane.com/character/Ashien/Lordaeron/summary",
    items: [{ name: "Bad" }],
  }),
  { ok: false, error: "Invalid character name." },
);

const apiResult = normalizeImportedArmoryGear({
  name: "Aalaska",
  realm: "Lordaeron",
  equipment: [
    {
      name: "Sanctified Bloodmage Hood",
      item: "51281",
    },
  ],
});

assert.equal(apiResult.ok, true);
if (apiResult.ok) {
  assert.equal(apiResult.gear.characterName, "Aalaska");
  assert.equal(apiResult.gear.items[0].itemUrl, undefined);
}

assert.deepEqual(
  normalizeArmoryGearSlots([
    { slot: "Trinket 1", name: "Archus, Greatstaff of Antonidas", equipLoc: "INVTYPE_2HWEAPON" },
    { slot: "Trinket 2", name: "Nightmare Ender", equipLoc: "INVTYPE_RANGEDRIGHT" },
    { slot: "Off Hand", name: "Libram of Three Truths", equipLoc: "INVTYPE_RELIC" },
  ]).map((item) => item.slot),
  ["Main Hand", "Ranged/Relic", "Ranged/Relic"],
);

assert.deepEqual(
  normalizeArmoryGearSlots([
    { slot: "Main Hand", name: "Bryntroll, the Bone Arbiter", equipLoc: "INVTYPE_2HWEAPON" },
    { slot: "Off Hand", name: "Shadowmourne", equipLoc: "INVTYPE_2HWEAPON" },
  ]).map((item) => item.slot),
  ["Main Hand", "Off Hand"],
);

assert.equal(
  gearNeedsEnrichment({
    characterName: "Aalaska",
    realm: "Lordaeron",
    sourceUrl: "https://armory.warmane.com/character/Aalaska/Lordaeron/summary",
    fetchedAt: new Date().toISOString(),
    items: [
      {
        slot: "Head",
        name: "Sanctified Bloodmage Hood",
        itemUrl: "https://armory.warmane.com/item/51281",
      },
    ],
  }),
  true,
);

assert.equal(
  gearNeedsEnrichment({
    characterName: "Aalaska",
    realm: "Lordaeron",
    sourceUrl: "https://armory.warmane.com/character/Aalaska/Lordaeron/summary",
    fetchedAt: new Date().toISOString(),
    items: [
      {
        slot: "Head",
        name: "Sanctified Bloodmage Hood",
        itemId: "51281",
        itemLevel: 264,
        equipLoc: "INVTYPE_HEAD",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_142.jpg",
        itemUrl: "https://www.wowhead.com/wotlk/item=51281/sanctified-bloodmage-hood",
        details: ["Item Level 264"],
      },
    ],
  }),
  false,
);

assert.deepEqual(
  collectWowItemIconBackfills([
    {
      slot: "Chest",
      name: "Blightborne Warplate",
      itemId: "50024",
      itemLevel: 264,
      quality: "epic",
      equipLoc: "INVTYPE_CHEST",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_chest_plate_26.jpg",
    },
    {
      slot: "Legs",
      name: "Legguards of Lost Hope",
      itemId: "49964",
      iconUrl: "https://example.com/not-a-wow-icon.jpg",
    },
    {
      slot: "Finger 1",
      name: "Juggernaut Band",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_85.jpg",
    },
  ]),
  [
    {
      itemId: "50024",
      name: "Blightborne Warplate",
      itemLevel: 264,
      quality: "epic",
      equipLoc: "INVTYPE_CHEST",
      iconName: "inv_chest_plate_26",
    },
  ],
);

console.log("warmane-armory-import tests passed");
