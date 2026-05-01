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

console.log("armory-gear-queue tests passed");
