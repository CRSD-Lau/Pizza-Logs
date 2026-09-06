import { CLASS_COLORS, WOW_CLASSES } from "./constants/classes";

export type WowClass = typeof WOW_CLASSES[number];

// Wrath class IDs, colors and icons are one identity. Unknown characters must
// never acquire another class's color through a name hash.
const CLASSES: Record<WowClass, { id: number; color: string; slug: string }> = {
  "Death Knight": { id: 6, color: "#c41f3b", slug: "deathknight" },
  Druid: { id: 11, color: "#ff7d0a", slug: "druid" },
  Hunter: { id: 3, color: "#abd473", slug: "hunter" },
  Mage: { id: 8, color: "#69ccf0", slug: "mage" },
  Paladin: { id: 2, color: "#f58cba", slug: "paladin" },
  Priest: { id: 5, color: "#ffffff", slug: "priest" },
  Rogue: { id: 4, color: "#fff569", slug: "rogue" },
  Shaman: { id: 7, color: "#0070de", slug: "shaman" },
  Warlock: { id: 9, color: "#9482c9", slug: "warlock" },
  Warrior: { id: 1, color: "#c79c6e", slug: "warrior" },
};

export function normalizePlayerClass(value: unknown): WowClass | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim().toLowerCase();
  if (/^\d+$/.test(raw)) return WOW_CLASSES.find(name => raw === String(CLASSES[name].id)) ?? null;
  if (!/^[a-z\s_-]+$/.test(raw)) return null;
  const key = raw.replace(/[\s_-]+/g, "");
  if (!key) return null;
  return WOW_CLASSES.find(name => {
    const info = CLASSES[name];
    return key === info.slug || (key === "dk" && info.id === 6);
  }) ?? null;
}

export function getPlayerClassMeta(value: unknown) {
  const className = normalizePlayerClass(value);
  const info = className ? CLASSES[className] : null;
  return {
    className,
    label: className ?? "Unknown class",
    color: info?.color ?? "#a3a3a3",
    // Keep authentic swatches/borders while meaningful small text retains the
    // site's readable class hue on dark surfaces.
    textColor: className ? CLASS_COLORS[className] : "#a3a3a3",
    iconUrl: info ? `https://cdn.warmane.com/wotlk/icons/large/classicon_${info.slug}.jpg` : null,
  };
}
