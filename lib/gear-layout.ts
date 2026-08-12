import type { ArmoryGearItem } from "./warmane-armory";

export const PAPER_DOLL_LEFT_SLOTS = ["Head", "Neck", "Shoulder", "Back", "Chest", "Shirt", "Tabard", "Wrist"] as const;
export const PAPER_DOLL_RIGHT_SLOTS = ["Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2", "Trinket 1", "Trinket 2"] as const;
export const PAPER_DOLL_WEAPON_SLOTS = ["Main Hand", "Off Hand", "Ranged/Relic"] as const;

const LEFT_SLOTS = new Set<string>(PAPER_DOLL_LEFT_SLOTS);
const RIGHT_SLOTS = new Set<string>(PAPER_DOLL_RIGHT_SLOTS);
const WEAPON_SLOTS = new Set(["Main Hand", "Off Hand", "Ranged", "Ranged/Relic"]);

const SLOT_ORDER = new Map([
  "Head",
  "Neck",
  "Shoulder",
  "Back",
  "Chest",
  "Shirt",
  "Tabard",
  "Wrist",
  "Hands",
  "Waist",
  "Legs",
  "Feet",
  "Finger 1",
  "Finger 2",
  "Trinket 1",
  "Trinket 2",
  "Main Hand",
  "Off Hand",
  "Ranged",
  "Ranged/Relic",
].map((slot, index) => [slot, index]));

function bySlotOrder(a: ArmoryGearItem, b: ArmoryGearItem): number {
  return (SLOT_ORDER.get(a.slot) ?? 99) - (SLOT_ORDER.get(b.slot) ?? 99);
}

export function getPlayerGearGroups(items: ArmoryGearItem[]): {
  left: ArmoryGearItem[];
  right: ArmoryGearItem[];
  weapons: ArmoryGearItem[];
} {
  const sorted = [...items].sort(bySlotOrder);

  return {
    left: sorted.filter((item) => LEFT_SLOTS.has(item.slot)),
    right: sorted.filter((item) => RIGHT_SLOTS.has(item.slot)),
    weapons: sorted.filter((item) => WEAPON_SLOTS.has(item.slot)),
  };
}
