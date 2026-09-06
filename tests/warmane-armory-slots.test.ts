import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import type { ArmoryGearItem } from "../lib/warmane-armory";

const leftIds = [49986, 50627, 50660, 50718, 51174, 4333, null, 50611];
const rightIds = [51172, 50691, 51171, 50625, 50622, 50404, 54571, 50361];
const bottomIds = [49997, 50065, 45145];
const title = "<title>Warmane Armory | Character Lausudo @ Lordaeron</title>";
const cell = (itemId: number | null) => `<div class="item-slot"><div class="icon-quality">${itemId
  ? `<a href="http://wotlk.cavernoftime.com/item=${itemId}" rel="item=${itemId}&amp;ench=1"><img src="https://cdn.warmane.com/wotlk/icons/large/test.jpg" /></a>`
  : '<div class="tooltip" data-tooltip="Tabard"><a href="#self"></a></div>'}</div></div>`;
const profile = (right: Array<number | null> = rightIds) => `${title}<div class="equipment"><div class="item-left">${leftIds.map(cell).join("")}</div>
  <div class="item-right">${right.map(cell).join("")}</div><div class="item-bottom">${bottomIds.map(cell).join("")}</div></div>`;
const equipment = (right: Array<number | null> = rightIds) => [...leftIds, ...right, ...bottomIds].filter(id => id !== null)
  .map(id => ({ item: String(id), name: `Item ${id}` }));

async function main() {
  const moduleLoader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = moduleLoader._resolveFilename;
  const originalFetch = globalThis.fetch;
  const dbMockPath = path.join(process.cwd(), "tests", "__mocks__", "armory-slots-db.js");
  const itemsMockPath = path.join(process.cwd(), "tests", "__mocks__", "armory-slots-items.js");
  moduleLoader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (parent?.filename === path.join(process.cwd(), "lib", "warmane-armory.ts")) {
      if (request === "./db") return dbMockPath;
      if (request === "./item-template") return itemsMockPath;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbMockPath] = { id: dbMockPath, filename: dbMockPath, loaded: true, exports: { db: {} } } as NodeModule;
  require.cache[itemsMockPath] = { id: itemsMockPath, filename: itemsMockPath, loaded: true,
    exports: { enrichGearWithLocalTemplate: async (items: ArmoryGearItem[]) => items } } as NodeModule;
  try {
    const { extractWarmaneEquipmentSlots, fetchWarmaneGearLive, normalizeArmoryGearSlots } = require("../lib/warmane-armory") as typeof import("../lib/warmane-armory");
    const slots = extractWarmaneEquipmentSlots(profile(), "Lausudo", "Lordaeron");
    assert.equal(slots.length, 19);
    assert.deepEqual(slots[6], { slot: "Tabard", itemId: null });
    assert.deepEqual(slots[7], { slot: "Wrist", itemId: "50611" });
    assert.deepEqual(slots[8], { slot: "Hands", itemId: "51172" });
    assert.deepEqual(slots.slice(16), [
      { slot: "Main Hand", itemId: "49997" }, { slot: "Off Hand", itemId: "50065" }, { slot: "Ranged/Relic", itemId: "45145" },
    ]);
    assert.deepEqual(extractWarmaneEquipmentSlots(profile(), "Lausudo", "Icecrown"), []);
    assert.deepEqual(extractWarmaneEquipmentSlots(profile(rightIds.slice(1)), "Lausudo", "Lordaeron"), [], "A truncated rail cannot establish slots");
    assert.deepEqual(extractWarmaneEquipmentSlots(profile() + `<div class="item-left">${leftIds.map(cell).join("")}</div>`, "Lausudo", "Lordaeron"), [], "Duplicate grids are ambiguous");

    let currentEquipment: unknown[] = equipment();
    let currentProfile: string | null = profile();
    globalThis.fetch = async input => String(input).includes("/api/character/")
      ? Response.json({ name: "Lausudo", realm: "Lordaeron", class: "Paladin", equipment: currentEquipment })
      : new Response(currentProfile ?? "Unavailable", { status: currentProfile ? 200 : 503 });
    const fetchItems = async () => {
      const result = await fetchWarmaneGearLive("Lausudo", "Lordaeron");
      if (!result.ok) throw new Error("Expected healthy equipment");
      return result.gear.items;
    };
    const compact = await fetchItems();
    const byId = new Map(compact.map(item => [item.itemId, item.slot]));
    for (const [id, slot] of [["49986", "Head"], ["50611", "Wrist"], ["51172", "Hands"], ["49997", "Main Hand"], ["50065", "Off Hand"], ["45145", "Ranged/Relic"]]) {
      assert.equal(byId.get(id), slot, `${id} keeps its real slot when the compact API omits Tabard and item metadata is absent`);
    }
    assert.equal(compact.length, 18);
    assert.ok(compact.every(item => item.slotSource === "armory-profile"));
    assert.equal(normalizeArmoryGearSlots([{ slot: "Off Hand", slotSource: "armory-profile", name: "Offhand Weapon", equipLoc: "INVTYPE_WEAPON" }])[0].slot, "Off Hand", "An observed slot survives later equipment-type normalization");

    const repeatedRings = [...rightIds]; repeatedRings[5] = repeatedRings[4];
    currentEquipment = equipment(repeatedRings); currentProfile = profile(repeatedRings);
    assert.deepEqual((await fetchItems()).filter(item => item.itemId === "50622").map(item => item.slot), ["Finger 1", "Finger 2"], "Repeated IDs consume matching slot occurrences");

    currentEquipment = equipment(); currentProfile = null;
    assert.ok((await fetchItems()).every(item => item.slot === "Unknown slot"), "Compact equipment without profile or item metadata cannot invent shifted slots");
    currentEquipment = [{ item: "50611", name: "Bracers", equipLoc: "INVTYPE_WRIST" }];
    assert.equal((await fetchItems())[0].slot, "Wrist", "Available item metadata still establishes a slot without the profile");
    currentEquipment = Array.from({ length: 19 }, (_, index) => index === 7 ? { item: "50611", name: "Bracers" } : null);
    assert.equal((await fetchItems())[0].slot, "Wrist", "A complete positional array can retain explicit empty positions");
    currentEquipment = equipment(); currentProfile = profile().replace("@ Lordaeron", "@ Icecrown");
    assert.ok((await fetchItems()).every(item => item.slot === "Unknown slot"), "A different realm's profile never assigns slots");
  } finally {
    moduleLoader._resolveFilename = originalResolve; globalThis.fetch = originalFetch;
    delete require.cache[dbMockPath]; delete require.cache[itemsMockPath];
  }
  console.log("warmane armory equipment slot tests passed");
}
main().catch(error => { console.error(error); process.exit(1); });
