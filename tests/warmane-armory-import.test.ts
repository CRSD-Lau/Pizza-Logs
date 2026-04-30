import assert from "node:assert/strict";
import { gearNeedsWowheadEnrichment, normalizeImportedArmoryGear } from "../lib/warmane-armory";

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
  assert.equal(apiResult.gear.items[0].itemUrl, "https://www.wowhead.com/wotlk/item=51281/sanctified-bloodmage-hood");
}

assert.equal(
  gearNeedsWowheadEnrichment({
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
  gearNeedsWowheadEnrichment({
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
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_142.jpg",
        itemUrl: "https://www.wowhead.com/wotlk/item=51281/sanctified-bloodmage-hood",
        details: ["Item Level 264"],
      },
    ],
  }),
  false,
);

console.log("warmane-armory-import tests passed");
