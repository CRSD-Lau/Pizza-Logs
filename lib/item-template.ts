import { db } from "./db";
import type { ArmoryGearItem } from "./warmane-armory";
import type { GearScoreEquipLoc } from "./gearscore";
import { formatDecimal, formatInteger, formatNumber, formatRate } from "./utils";

export const QUALITY_MAP: Record<number, string> = {
  0: "poor",
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "legendary",
  6: "artifact",
};

export const INVENTORY_TYPE_MAP: Record<number, GearScoreEquipLoc | null> = {
  0:  null,
  1:  "INVTYPE_HEAD",
  2:  "INVTYPE_NECK",
  3:  "INVTYPE_SHOULDER",
  4:  "INVTYPE_BODY",
  5:  "INVTYPE_CHEST",
  6:  "INVTYPE_WAIST",
  7:  "INVTYPE_LEGS",
  8:  "INVTYPE_FEET",
  9:  "INVTYPE_WRIST",
  10: "INVTYPE_HAND",
  11: "INVTYPE_FINGER",
  12: "INVTYPE_TRINKET",
  13: "INVTYPE_WEAPON",
  14: "INVTYPE_SHIELD",
  15: "INVTYPE_RANGED",
  16: "INVTYPE_CLOAK",
  17: "INVTYPE_2HWEAPON",
  18: null,
  19: "INVTYPE_TABARD" as GearScoreEquipLoc,
  20: "INVTYPE_ROBE",
  21: "INVTYPE_WEAPONMAINHAND",
  22: "INVTYPE_WEAPONOFFHAND",
  23: "INVTYPE_HOLDABLE",
  24: null,
  25: "INVTYPE_THROWN",
  26: "INVTYPE_RANGEDRIGHT",
  27: null,
  28: "INVTYPE_RELIC",
  29: null,
};

export const STAT_TYPE_NAMES: Record<number, string> = {
  1:  "Health",
  3:  "Agility",
  4:  "Strength",
  5:  "Intellect",
  6:  "Spirit",
  7:  "Stamina",
  12: "Defense",
  13: "Dodge",
  14: "Parry",
  15: "Block",
  31: "Hit Rating",
  32: "Crit Rating",
  35: "Resilience",
  36: "Haste Rating",
  37: "Expertise",
  38: "Attack Power",
  39: "Ranged Attack Power",
  43: "Spell Power",
  44: "Mana per 5 sec",
  45: "Armor Penetration",
  47: "Health per 5 sec",
};

/**
 * Parses a MySQL VALUES tuple like "(1, 'Foo', NULL, -1)" into an array of
 * string values (null for SQL NULL). Handles quoted strings with \' or '' escapes.
 */
export function parseSqlTuple(raw: string): (string | null)[] {
  const inner = raw.trim().replace(/^\(/, "").replace(/\)$/, "");
  const values: (string | null)[] = [];
  let i = 0;
  const len = inner.length;

  while (i < len) {
    while (i < len && (inner[i] === " " || inner[i] === "\t")) i++;
    if (i >= len) break;
    if (inner[i] === ",") { i++; continue; }

    if (inner[i] === "'") {
      i++;
      let str = "";
      while (i < len) {
        if (inner[i] === "\\" && inner[i + 1] === "'") { str += "'"; i += 2; }
        else if (inner[i] === "'" && inner[i + 1] === "'") { str += "'"; i += 2; }
        else if (inner[i] === "'") { i++; break; }
        else { str += inner[i]; i++; }
      }
      values.push(str);
    } else {
      let token = "";
      while (i < len && inner[i] !== "," && inner[i] !== " " && inner[i] !== "\t") {
        token += inner[i]; i++;
      }
      values.push(token.toUpperCase() === "NULL" ? null : token);
    }
  }

  return values;
}

export function buildStatsFromTemplate(
  statTypes: number[],
  statValues: number[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const typeId = statTypes[i] ?? 0;
    const value  = statValues[i] ?? 0;
    if (typeId === 0 || value === 0) continue;
    const name = STAT_TYPE_NAMES[typeId];
    if (!name) continue;
    result[name] = (result[name] ?? 0) + value;
  }
  return result;
}

export function buildItemDetailsFromTemplate(item: {
  armor?: number | null;
  dmgMin?: number | null;
  dmgMax?: number | null;
  delay?: number | null;
  stats?: Record<string, number> | null;
  description?: string | null;
  bonding?: number | null;
  requiredLevel?: number | null;
}): string[] {
  const lines: string[] = [];
  const bondingLabels: Record<number, string> = {
    1: "Binds when picked up",
    2: "Binds when equipped",
    3: "Binds when used",
    4: "Quest item",
  };
  if (item.bonding != null && bondingLabels[item.bonding]) {
    lines.push(bondingLabels[item.bonding]);
  }
  if (item.armor && item.armor > 0) lines.push(`${formatInteger(item.armor)} Armor`);
  if (item.dmgMin && item.dmgMax && item.delay) {
    const dps = formatRate((item.dmgMin + item.dmgMax) / 2 / (item.delay / 1000));
    lines.push(`${formatNumber(item.dmgMin)}–${formatNumber(item.dmgMax)} Damage, Speed ${formatDecimal(item.delay / 1000)}`);
    lines.push(`(${dps} damage per second)`);
  }
  if (item.stats && typeof item.stats === "object") {
    for (const [stat, value] of Object.entries(item.stats as Record<string, number>)) {
      if (value > 0) lines.push(`+${formatInteger(value)} ${stat}`);
    }
  }
  if (item.requiredLevel && item.requiredLevel > 0) {
    lines.push(`Requires Level ${item.requiredLevel}`);
  }
  if (item.description?.trim()) lines.push(`"${item.description.trim()}"`);
  return lines;
}

export async function enrichGearWithLocalTemplate(
  items: ArmoryGearItem[]
): Promise<ArmoryGearItem[]> {
  const ids = items.map(i => i.itemId).filter((id): id is string => Boolean(id));
  const rows = ids.length > 0
    ? await db.wowItem.findMany({ where: { itemId: { in: ids } } })
    : [];
  const map = new Map(rows.map(r => [r.itemId, r]));

  return items.map((item): ArmoryGearItem => {
    if (!item.itemId) return item;
    const row = map.get(item.itemId);
    if (!row) return item;

    const iconUrl = row.iconName
      ? `https://wow.zamimg.com/images/wow/icons/large/${row.iconName}.jpg`
      : item.iconUrl;

    return {
      ...item,
      name:      row.name      ?? item.name,
      quality:   row.quality   ?? item.quality,
      itemLevel: row.itemLevel ?? item.itemLevel,
      iconUrl,
      equipLoc:  (row.equipLoc as GearScoreEquipLoc | null) ?? item.equipLoc,
      details:   buildItemDetailsFromTemplate({
        armor: row.armor, dmgMin: row.dmgMin, dmgMax: row.dmgMax,
        delay: row.delay, stats: row.stats as Record<string, number> | null,
        description: row.description, bonding: row.bonding,
        requiredLevel: row.requiredLevel,
      }),
    };
  });
}
