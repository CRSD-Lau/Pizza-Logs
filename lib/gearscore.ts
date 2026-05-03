import type { ArmoryGearItem } from "./warmane-armory";

export type GearScoreEquipLoc =
  | "INVTYPE_RELIC"
  | "INVTYPE_TRINKET"
  | "INVTYPE_2HWEAPON"
  | "INVTYPE_WEAPONMAINHAND"
  | "INVTYPE_WEAPONOFFHAND"
  | "INVTYPE_RANGED"
  | "INVTYPE_THROWN"
  | "INVTYPE_RANGEDRIGHT"
  | "INVTYPE_SHIELD"
  | "INVTYPE_WEAPON"
  | "INVTYPE_HOLDABLE"
  | "INVTYPE_HEAD"
  | "INVTYPE_NECK"
  | "INVTYPE_SHOULDER"
  | "INVTYPE_CHEST"
  | "INVTYPE_ROBE"
  | "INVTYPE_WAIST"
  | "INVTYPE_LEGS"
  | "INVTYPE_FEET"
  | "INVTYPE_WRIST"
  | "INVTYPE_HAND"
  | "INVTYPE_FINGER"
  | "INVTYPE_CLOAK"
  | "INVTYPE_BODY";

type GearScoreItemInput = Pick<ArmoryGearItem, "slot" | "name" | "quality" | "itemLevel" | "equipLoc">;

export type GearScoreQuality = {
  description: string;
  color: string;
};

export type GearScoreSummary = {
  score: number;
  averageItemLevel: number;
  scoredItemCount: number;
  quality: GearScoreQuality;
  itemScores: Record<string, number>;
};

const SCALE = 1.8618;
const HUNTER_MELEE_MOD = 0.3164;
const HUNTER_RANGED_MOD = 5.3224;

const ITEM_TYPES: Record<GearScoreEquipLoc, { slotMod: number; scoreSlot: number }> = {
  INVTYPE_RELIC: { slotMod: 0.3164, scoreSlot: 18 },
  INVTYPE_TRINKET: { slotMod: 0.5625, scoreSlot: 33 },
  INVTYPE_2HWEAPON: { slotMod: 2.0, scoreSlot: 16 },
  INVTYPE_WEAPONMAINHAND: { slotMod: 1.0, scoreSlot: 16 },
  INVTYPE_WEAPONOFFHAND: { slotMod: 1.0, scoreSlot: 17 },
  INVTYPE_RANGED: { slotMod: 0.3164, scoreSlot: 18 },
  INVTYPE_THROWN: { slotMod: 0.3164, scoreSlot: 18 },
  INVTYPE_RANGEDRIGHT: { slotMod: 0.3164, scoreSlot: 18 },
  INVTYPE_SHIELD: { slotMod: 1.0, scoreSlot: 17 },
  INVTYPE_WEAPON: { slotMod: 1.0, scoreSlot: 36 },
  INVTYPE_HOLDABLE: { slotMod: 1.0, scoreSlot: 17 },
  INVTYPE_HEAD: { slotMod: 1.0, scoreSlot: 1 },
  INVTYPE_NECK: { slotMod: 0.5625, scoreSlot: 2 },
  INVTYPE_SHOULDER: { slotMod: 0.75, scoreSlot: 3 },
  INVTYPE_CHEST: { slotMod: 1.0, scoreSlot: 5 },
  INVTYPE_ROBE: { slotMod: 1.0, scoreSlot: 5 },
  INVTYPE_WAIST: { slotMod: 0.75, scoreSlot: 6 },
  INVTYPE_LEGS: { slotMod: 1.0, scoreSlot: 7 },
  INVTYPE_FEET: { slotMod: 0.75, scoreSlot: 8 },
  INVTYPE_WRIST: { slotMod: 0.5625, scoreSlot: 9 },
  INVTYPE_HAND: { slotMod: 0.75, scoreSlot: 10 },
  INVTYPE_FINGER: { slotMod: 0.5625, scoreSlot: 31 },
  INVTYPE_CLOAK: { slotMod: 0.5625, scoreSlot: 15 },
  INVTYPE_BODY: { slotMod: 0, scoreSlot: 4 },
};

const FORMULA = {
  A: {
    4: { a: 91.45, b: 0.65 },
    3: { a: 81.375, b: 0.8125 },
    2: { a: 73.0, b: 1.0 },
  },
  B: {
    4: { a: 26.0, b: 1.2 },
    3: { a: 0.75, b: 1.8 },
    2: { a: 8.0, b: 2.0 },
    1: { a: 0.0, b: 2.25 },
  },
} as const;

const QUALITY_BY_NAME: Record<string, number> = {
  poor: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  artifact: 6,
  heirloom: 7,
};

const QUALITY_BANDS: Array<{ minExclusive: number; max: number; description: string; color: string }> = [
  { minExclusive: 0, max: 1000, description: "Trash", color: "#8c8c8c" },
  { minExclusive: 1000, max: 2000, description: "Common", color: "#ffffff" },
  { minExclusive: 2000, max: 3000, description: "Uncommon", color: "#1eff00" },
  { minExclusive: 3000, max: 4000, description: "Superior", color: "#0070dd" },
  { minExclusive: 4000, max: 5000, description: "Epic", color: "#a335ee" },
  { minExclusive: 5000, max: 6000, description: "Legendary", color: "#ff8000" },
];

const SLOT_FALLBACK_EQUIP_LOCS: Record<string, GearScoreEquipLoc | undefined> = {
  head: "INVTYPE_HEAD",
  neck: "INVTYPE_NECK",
  shoulder: "INVTYPE_SHOULDER",
  back: "INVTYPE_CLOAK",
  chest: "INVTYPE_CHEST",
  shirt: "INVTYPE_BODY",
  wrist: "INVTYPE_WRIST",
  hands: "INVTYPE_HAND",
  waist: "INVTYPE_WAIST",
  legs: "INVTYPE_LEGS",
  feet: "INVTYPE_FEET",
  "finger 1": "INVTYPE_FINGER",
  "finger 2": "INVTYPE_FINGER",
  "trinket 1": "INVTYPE_TRINKET",
  "trinket 2": "INVTYPE_TRINKET",
  "main hand": "INVTYPE_WEAPON",
  "off hand": "INVTYPE_HOLDABLE",
  ranged: "INVTYPE_RANGEDRIGHT",
  "ranged/relic": "INVTYPE_RANGEDRIGHT",
};

const INVENTORY_TYPE_EQUIP_LOCS: Record<number, GearScoreEquipLoc | undefined> = {
  1: "INVTYPE_HEAD",
  2: "INVTYPE_NECK",
  3: "INVTYPE_SHOULDER",
  4: "INVTYPE_BODY",
  5: "INVTYPE_CHEST",
  6: "INVTYPE_WAIST",
  7: "INVTYPE_LEGS",
  8: "INVTYPE_FEET",
  9: "INVTYPE_WRIST",
  10: "INVTYPE_HAND",
  11: "INVTYPE_FINGER",
  12: "INVTYPE_TRINKET",
  13: "INVTYPE_WEAPON",
  14: "INVTYPE_SHIELD",
  15: "INVTYPE_RANGED",
  16: "INVTYPE_CLOAK",
  17: "INVTYPE_2HWEAPON",
  20: "INVTYPE_ROBE",
  21: "INVTYPE_WEAPONMAINHAND",
  22: "INVTYPE_WEAPONOFFHAND",
  23: "INVTYPE_HOLDABLE",
  25: "INVTYPE_THROWN",
  26: "INVTYPE_RANGEDRIGHT",
  28: "INVTYPE_RELIC",
};

export function mapInventoryTypeToEquipLoc(value: number | undefined): GearScoreEquipLoc | undefined {
  return value === undefined ? undefined : INVENTORY_TYPE_EQUIP_LOCS[value];
}

function getEquipLoc(item: GearScoreItemInput): GearScoreEquipLoc | undefined {
  if (item.equipLoc && item.equipLoc in ITEM_TYPES) return item.equipLoc as GearScoreEquipLoc;
  return SLOT_FALLBACK_EQUIP_LOCS[item.slot.toLowerCase()];
}

function getRarityId(quality?: string): number | undefined {
  if (!quality) return undefined;
  return QUALITY_BY_NAME[quality.toLowerCase()];
}

export function calculateGearScoreForItem(item: GearScoreItemInput): { score: number; itemLevel: number; equipLoc: GearScoreEquipLoc } | null {
  const equipLoc = getEquipLoc(item);
  if (!equipLoc) return null;

  const itemType = ITEM_TYPES[equipLoc];
  const originalItemLevel = item.itemLevel ?? 0;
  let itemLevel = originalItemLevel;
  let rarity = getRarityId(item.quality);
  let qualityScale = 1;

  if (itemType.slotMod <= 0 || !itemLevel || rarity === undefined) return null;

  if (rarity === 5) {
    qualityScale = 1.3;
    rarity = 4;
  } else if (rarity === 1 || rarity === 0) {
    qualityScale = 0.005;
    rarity = 2;
  } else if (rarity === 7) {
    rarity = 3;
    itemLevel = 187.05;
  }

  const formulaTable = itemLevel > 120 ? FORMULA.A : FORMULA.B;
  const formula = formulaTable[rarity as keyof typeof formulaTable];
  if (!formula) return null;

  const score = Math.max(0, Math.floor(((itemLevel - formula.a) / formula.b) * itemType.slotMod * SCALE * qualityScale));
  return { score, itemLevel: originalItemLevel, equipLoc };
}

export function getGearScoreQuality(score: number): GearScoreQuality {
  const normalized = Math.min(score, 5999);
  const band = QUALITY_BANDS.find(({ minExclusive, max }) => normalized > minExclusive && normalized <= max);
  return band ?? { description: "Trash", color: "#8c8c8c" };
}

function isHunter(playerClass?: string): boolean {
  return playerClass?.toUpperCase() === "HUNTER";
}

function isWeapon(equipLoc?: GearScoreEquipLoc): boolean {
  return equipLoc === "INVTYPE_2HWEAPON"
    || equipLoc === "INVTYPE_WEAPONMAINHAND"
    || equipLoc === "INVTYPE_WEAPONOFFHAND"
    || equipLoc === "INVTYPE_WEAPON"
    || equipLoc === "INVTYPE_HOLDABLE";
}

function isTitanGripWeapon(equipLoc?: GearScoreEquipLoc): boolean {
  return equipLoc === "INVTYPE_2HWEAPON"
    || equipLoc === "INVTYPE_WEAPONMAINHAND"
    || equipLoc === "INVTYPE_WEAPONOFFHAND"
    || equipLoc === "INVTYPE_WEAPON";
}

function isRanged(equipLoc?: GearScoreEquipLoc): boolean {
  return equipLoc === "INVTYPE_RANGED" || equipLoc === "INVTYPE_RANGEDRIGHT";
}

function scoreCharacterItem(item: GearScoreItemInput, playerClass?: string, titanGrip = 1): number | null {
  const itemScore = calculateGearScoreForItem(item);
  if (!itemScore) return null;

  let score = itemScore.score;
  if (isHunter(playerClass) && isWeapon(itemScore.equipLoc)) score *= HUNTER_MELEE_MOD;
  if (isHunter(playerClass) && isRanged(itemScore.equipLoc)) score *= HUNTER_RANGED_MOD;
  if (item.slot.toLowerCase() === "main hand" || item.slot.toLowerCase() === "off hand") score *= titanGrip;

  return score;
}

export function calculateGearScore(items: GearScoreItemInput[], playerClass?: string): GearScoreSummary | null {
  const mainHand = items.find(item => item.slot.toLowerCase() === "main hand");
  const offHand = items.find(item => item.slot.toLowerCase() === "off hand");
  const mainHandLoc = mainHand ? calculateGearScoreForItem(mainHand)?.equipLoc : undefined;
  const offHandLoc = offHand ? calculateGearScoreForItem(offHand)?.equipLoc : undefined;
  const titanGrip = mainHand
    && offHand
    && isTitanGripWeapon(mainHandLoc)
    && isTitanGripWeapon(offHandLoc)
    && (mainHandLoc === "INVTYPE_2HWEAPON" || offHandLoc === "INVTYPE_2HWEAPON")
    ? 0.5
    : 1;
  let score = 0;
  let itemLevelTotal = 0;
  let scoredItemCount = 0;
  const itemScores: Record<string, number> = {};

  for (const item of items) {
    const itemScore = calculateGearScoreForItem(item);
    const adjustedScore = scoreCharacterItem(item, playerClass, titanGrip);
    if (!itemScore || adjustedScore === null) continue;

    score += adjustedScore;
    itemLevelTotal += itemScore.itemLevel;
    scoredItemCount++;
    itemScores[item.slot] = Math.floor(adjustedScore);
  }

  if (scoredItemCount === 0) return null;

  const totalScore = Math.floor(score);
  return {
    score: totalScore,
    averageItemLevel: Math.floor(itemLevelTotal / scoredItemCount),
    scoredItemCount,
    quality: getGearScoreQuality(totalScore),
    itemScores,
  };
}
