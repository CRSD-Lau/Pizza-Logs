import { z } from "zod";

export const ARMORY_SECTIONS = ["summary", "talents", "achievements", "statistics", "reputation", "collections", "pvp"] as const;
export type ArmorySection = typeof ARMORY_SECTIONS[number];
export const ARMORY_SECTION_LABELS: Record<ArmorySection, string> = {
  summary: "Overview", talents: "Talents & glyphs", achievements: "Achievements",
  statistics: "Statistics", reputation: "Reputation", collections: "Mounts & companions", pvp: "Arena history",
};
// Public Wrath categories observed in Warmane's own category navigation.
const CATEGORY_IDS = {
  achievements: "92,96,14861,14862,14863,97,14777,14778,14779,14780,95,165,14801,14802,14803,14804,14881,14901,15003,168,14808,14805,14806,14921,14922,14923,14961,14962,15001,15002,15041,15042,169,170,171,172,201,14864,14865,14866,155,160,187,159,163,161,162,158,14981,156,14941,81",
  statistics: "130,140,145,147,191,141,128,135,136,137,122,123,124,125,126,127,133,14807,14821,14822,14823,14963,15021,15062,132,178,173,134,131,21,152,153,154",
};
export function isArmoryCategory(section: ArmorySection, category: string): boolean {
  return category === "summary" || ((section === "achievements" || section === "statistics") && CATEGORY_IDS[section].split(",").includes(category));
}
const text = z.string().max(4000);
const link = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password
    && ["armory.warmane.com", "wotlk.cavernoftime.com"].includes(url.hostname);
});
const icon = z.string().regex(/^https:\/\/cdn\.warmane\.com\/wotlk\/(?:bw)?icons\/(?:small|medium|large)\/[a-z0-9_]+\.jpg$/);
const row = z.object({ label: text, value: text, detail: text.optional(), url: link.optional() });
const talent = z.object({
  spellId: z.number().int().positive().max(1000000), row: z.number().int().min(0).max(10),
  column: z.number().int().min(0).max(3), rank: z.number().int().min(0).max(5),
  maxRank: z.number().int().min(1).max(5), iconUrl: icon.optional(),
});
export const ArmorySectionDataSchema = z.object({
  version: z.literal(1), characterName: z.string().regex(/^[A-Za-z]{2,12}$/), realm: z.string().regex(/^[A-Za-z]{2,24}$/),
  section: z.enum(ARMORY_SECTIONS), category: z.string().regex(/^(summary|[0-9]{1,6})$/),
  groups: z.array(z.object({ title: text, rows: z.array(row).max(2000) })).max(32),
  categories: z.array(z.object({ id: z.string().regex(/^(summary|[0-9]{1,6})$/), name: text })).max(150),
  specs: z.array(z.object({
    name: text, index: z.number().int().min(0).max(1),
    trees: z.array(z.object({ name: text, points: z.number().int().min(0).max(71), nodes: z.array(talent).max(50) })).length(3),
    glyphs: z.array(z.object({ name: text, kind: z.enum(["Major", "Minor"]), spellId: z.number().int().positive().max(1000000) })).max(6),
  })).max(2),
});
export type ArmorySectionData = z.infer<typeof ArmorySectionDataSchema>;
export type ArmoryTalent = ArmorySectionData["specs"][number]["trees"][number]["nodes"][number];
export type ArmorySectionResult = {
  data: ArmorySectionData | null; fetchedAt: string | null; stale: boolean; sourceUrl: string; message?: string;
};
export const ArmorySpellSchema = z.object({ id: z.number().int().positive(), name: text, description: text });
export type ArmorySpell = z.infer<typeof ArmorySpellSchema>;
export function armorySectionUrl(name: string, realm: string, section: ArmorySection): string {
  const tab = section === "collections" ? "mounts-and-companions" : section === "pvp" ? "match-history" : section;
  return `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/${encodeURIComponent(tab)}`;
}
