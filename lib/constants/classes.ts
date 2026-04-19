export const WOW_CLASSES = [
  "Death Knight",
  "Druid",
  "Hunter",
  "Mage",
  "Paladin",
  "Priest",
  "Rogue",
  "Shaman",
  "Warlock",
  "Warrior",
] as const;

export type WowClass = (typeof WOW_CLASSES)[number];

export const CLASS_COLORS: Record<string, string> = {
  "Death Knight": "#c41e3a",
  Druid:          "#f0a040",
  Hunter:         "#aad372",
  Mage:           "#80c0f0",
  Monk:           "#00ff98",
  Paladin:        "#f4a0c0",
  Priest:         "#e8e8e8",
  Rogue:          "#fff468",
  Shaman:         "#0090f8",
  Warlock:        "#9482c9",
  Warrior:        "#c89040",
  "Demon Hunter": "#a330c9",
  Unknown:        "#888888",
};

export const CLASS_ABBREV: Record<string, string> = {
  "Death Knight": "DK",
  Druid:          "DR",
  Hunter:         "HU",
  Mage:           "MA",
  Monk:           "MO",
  Paladin:        "PA",
  Priest:         "PR",
  Rogue:          "RO",
  Shaman:         "SH",
  Warlock:        "WL",
  Warrior:        "WA",
  "Demon Hunter": "DH",
  Unknown:        "??",
};

export const SCHOOL_NAMES: Record<number, string> = {
  1:  "Physical",
  2:  "Holy",
  4:  "Fire",
  8:  "Nature",
  16: "Frost",
  32: "Shadow",
  64: "Arcane",
};

export const SCHOOL_COLORS: Record<number, string> = {
  1:  "#c0c8d8",
  2:  "#f0c040",
  4:  "#e06030",
  8:  "#60c060",
  16: "#80c8f0",
  32: "#a070d0",
  64: "#d080f0",
};

// Stable palette for unknown classes — consistent per player name
const PALETTE = [
  "#f4a0c0", "#c89040", "#80c0f0", "#f0a040",
  "#e8e8e8", "#0090f8", "#9482c9", "#aad372",
  "#c41e3a", "#fff468", "#00ff98", "#a330c9",
];

export function getClassColor(classOrName: string): string {
  if (CLASS_COLORS[classOrName]) return CLASS_COLORS[classOrName];
  let hash = 0;
  for (let i = 0; i < classOrName.length; i++) {
    hash = ((hash * 31) + classOrName.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
