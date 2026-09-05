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

export const CLASS_COLORS: Record<string, string> = {
  "Death Knight": "#f07188",
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
  "Demon Hunter": "#ce87ec",
  Unknown:        "#888888",
};

// Stable palette for unknown classes, with readable text on the dark report surfaces.
const PALETTE = [
  "#f4a0c0", "#c89040", "#80c0f0", "#f0a040",
  "#e8e8e8", "#0090f8", "#9482c9", "#aad372",
  "#f07188", "#fff468", "#00ff98", "#ce87ec",
];

export function getClassColor(classOrName: string): string {
  if (CLASS_COLORS[classOrName]) return CLASS_COLORS[classOrName];
  let hash = 0;
  for (let i = 0; i < classOrName.length; i++) {
    hash = ((hash * 31) + classOrName.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
