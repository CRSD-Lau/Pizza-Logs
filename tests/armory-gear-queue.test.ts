import assert from "node:assert/strict";
import { getMissingArmoryGearPlayers } from "../lib/armory-gear-queue";

const missing = getMissingArmoryGearPlayers({
  players: [
    { name: "Lausudo", realm: { name: "Lordaeron" } },
  ],
  rosterMembers: [
    { characterName: "Maximusboom", normalizedCharacterName: "maximusboom", realm: "Lordaeron" },
    { characterName: "Lausudo", normalizedCharacterName: "lausudo", realm: "Lordaeron" },
  ],
  cachedRows: [
    {
      characterKey: "lausudo",
      realm: "Lordaeron",
      gear: {
        characterName: "Lausudo",
        realm: "Lordaeron",
        sourceUrl: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary",
        fetchedAt: "2026-05-01T12:00:00.000Z",
        items: [{
          slot: "Head",
          name: "Lightsworn Faceguard",
          itemId: "50862",
          quality: "Epic",
          itemLevel: 251,
          iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_154.jpg",
          itemUrl: "https://www.wowhead.com/wotlk/item=50862/lightsworn-faceguard",
          equipLoc: "INVTYPE_HEAD",
          details: ["Item Level 251"],
        }],
      },
    },
  ],
});

assert.deepEqual(missing, [
  { characterName: "Maximusboom", realm: "Lordaeron" },
]);

const missingIconOnly = getMissingArmoryGearPlayers({
  players: [
    { name: "Lausudo", realm: { name: "Lordaeron" } },
  ],
  rosterMembers: [],
  cachedRows: [
    {
      characterKey: "lausudo",
      realm: "Lordaeron",
      gear: {
        characterName: "Lausudo",
        realm: "Lordaeron",
        sourceUrl: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary",
        fetchedAt: "2026-05-01T12:00:00.000Z",
        items: [{
          slot: "Chest",
          name: "Blightborne Warplate",
          itemId: "50024",
          quality: "epic",
          itemLevel: 264,
          equipLoc: "INVTYPE_CHEST",
          details: ["2641 Armor", "+207 Stamina"],
        }],
      },
    },
  ],
});

assert.deepEqual(missingIconOnly, [
  { characterName: "Lausudo", realm: "Lordaeron" },
]);

const manyFreshPlayers = Array.from({ length: 120 }, (_, index) => ({
  name: `Fresh${String(index).padStart(3, "0")}`,
  realm: { name: "Lordaeron" },
}));
const lateMissing = getMissingArmoryGearPlayers({
  players: [
    ...manyFreshPlayers,
    { name: "Maxximusboom", realm: { name: "Lordaeron" } },
  ],
  rosterMembers: [],
  cachedRows: manyFreshPlayers.map((player) => ({
    characterKey: player.name.toLowerCase(),
    realm: "Lordaeron",
    gear: {
      characterName: player.name,
      realm: "Lordaeron",
      sourceUrl: `https://armory.warmane.com/character/${player.name}/Lordaeron/summary`,
      fetchedAt: "2026-05-01T12:00:00.000Z",
      items: [{
        slot: "Head",
        name: "Fresh Hat",
        itemId: "1",
        itemLevel: 1,
        equipLoc: "INVTYPE_HEAD",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg",
      }],
    },
  })),
});

assert.deepEqual(lateMissing, [
  { characterName: "Maxximusboom", realm: "Lordaeron" },
]);

console.log("armory-gear-queue tests passed");
