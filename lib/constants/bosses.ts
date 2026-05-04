export interface BossDefinition {
  name: string;
  slug: string;
  raid: string;
  raidSlug: string;
  wowBossId?: number; // ENCOUNTER_START numeric ID (when present)
  aliases?: string[]; // alternative names seen in logs
  sortOrder: number;
}

// WotLK encounter IDs (Warmane / Blizzard WotLK)
// Ordered most-relevant first: ICC → Ruby Sanctum → ToC → Ulduar → VoA → EoE → OS → Naxx
export const WOTLK_BOSSES: BossDefinition[] = [
  // ─── ICECROWN CITADEL ────────────────────────────────────────
  { name: "Lord Marrowgar",       slug: "lord-marrowgar",       raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36612, sortOrder: 10 },
  { name: "Lady Deathwhisper",    slug: "lady-deathwhisper",    raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36855, sortOrder: 11 },
  { name: "Gunship Battle",       slug: "gunship-battle",       raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37813, sortOrder: 12, aliases: ["Skybreaker", "Orgrim's Hammer"] },
  { name: "Deathbringer Saurfang",slug: "deathbringer-saurfang",raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37813, sortOrder: 13 },
  { name: "Festergut",            slug: "festergut",            raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36626, sortOrder: 20 },
  { name: "Rotface",              slug: "rotface",              raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36627, sortOrder: 21 },
  { name: "Professor Putricide",  slug: "professor-putricide",  raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36678, sortOrder: 22 },
  { name: "Blood Prince Council", slug: "blood-prince-council", raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37958, sortOrder: 30, aliases: ["Prince Valanar", "Prince Keleseth", "Prince Taldaram"] },
  { name: "Blood-Queen Lana'thel",slug: "blood-queen-lanathel", raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37955, sortOrder: 31 },
  { name: "Valithria Dreamwalker",slug: "valithria-dreamwalker",raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36789, sortOrder: 32 },
  { name: "Sindragosa",           slug: "sindragosa",           raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36853, sortOrder: 33 },
  { name: "The Lich King",        slug: "the-lich-king",        raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36597, sortOrder: 40, aliases: ["Lich King", "Arthas"] },

  // ─── RUBY SANCTUM ────────────────────────────────────────────
  { name: "Halion",               slug: "halion",               raid: "Ruby Sanctum",               raidSlug: "ruby-sanctum",               wowBossId: 39863, sortOrder: 100 },

  // ─── TRIAL OF THE CRUSADER ───────────────────────────────────
  { name: "Northrend Beasts",     slug: "northrend-beasts",     raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34796, sortOrder: 200, aliases: ["Gormok the Impaler", "Icehowl", "Acidmaw", "Dreadscale"] },
  { name: "Lord Jaraxxus",        slug: "lord-jaraxxus",        raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34780, sortOrder: 201 },
  { name: "Faction Champions",    slug: "faction-champions",    raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34968, sortOrder: 202 },
  { name: "Twin Val'kyr",         slug: "twin-valkyr",          raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34497, sortOrder: 203, aliases: ["Fjola Lightbane", "Eydis Darkbane"] },
  { name: "Anub'arak",            slug: "anubarak",             raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34564, sortOrder: 204 },

  // ─── ULDUAR ──────────────────────────────────────────────────
  { name: "Flame Leviathan",      slug: "flame-leviathan",      raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33113, sortOrder: 300 },
  { name: "Ignis the Furnace Master", slug: "ignis",            raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33118, sortOrder: 301 },
  { name: "Razorscale",           slug: "razorscale",           raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33186, sortOrder: 302 },
  { name: "XT-002 Deconstructor", slug: "xt-002",               raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33293, sortOrder: 303 },
  { name: "Assembly of Iron",     slug: "assembly-of-iron",     raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33271, sortOrder: 310, aliases: ["Steelbreaker", "Molgeim", "Brundir"] },
  { name: "Kologarn",             slug: "kologarn",             raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32930, sortOrder: 311 },
  { name: "Auriaya",              slug: "auriaya",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33515, sortOrder: 312 },
  { name: "Hodir",                slug: "hodir",                raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32845, sortOrder: 320 },
  { name: "Thorim",               slug: "thorim",               raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32865, sortOrder: 321 },
  { name: "Freya",                slug: "freya",                raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32906, sortOrder: 322 },
  { name: "Mimiron",              slug: "mimiron",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33350, sortOrder: 323 },
  { name: "General Vezax",        slug: "general-vezax",        raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33271, sortOrder: 330 },
  { name: "Yogg-Saron",           slug: "yogg-saron",           raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33288, sortOrder: 331 },
  { name: "Algalon the Observer", slug: "algalon",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32871, sortOrder: 332 },

  // ─── VAULT OF ARCHAVON ───────────────────────────────────────
  { name: "Archavon the Stone Watcher", slug: "archavon",      raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 31125, sortOrder: 400 },
  { name: "Emalon the Storm Watcher",   slug: "emalon",        raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 33993, sortOrder: 401 },
  { name: "Koralon the Flame Watcher",  slug: "koralon",       raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 35013, sortOrder: 402 },
  { name: "Toravon the Ice Watcher",    slug: "toravon",       raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 38433, sortOrder: 403 },

  // ─── EYE OF ETERNITY ─────────────────────────────────────────
  { name: "Malygos",              slug: "malygos",              raid: "Eye of Eternity",            raidSlug: "eye-of-eternity",            wowBossId: 28859, sortOrder: 500 },

  // ─── OBSIDIAN SANCTUM ────────────────────────────────────────
  { name: "Sartharion",           slug: "sartharion",           raid: "The Obsidian Sanctum",       raidSlug: "obsidian-sanctum",           wowBossId: 28860, sortOrder: 600 },

  // ─── NAXXRAMAS ───────────────────────────────────────────────
  { name: "Anub'Rekhan",          slug: "anub-rekhan",          raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15956, sortOrder: 700 },
  { name: "Grand Widow Faerlina", slug: "grand-widow-faerlina", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15953, sortOrder: 701 },
  { name: "Maexxna",              slug: "maexxna",              raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15952, sortOrder: 702 },
  { name: "Noth the Plaguebringer", slug: "noth-the-plaguebringer", raid: "Naxxramas",              raidSlug: "naxxramas",                  wowBossId: 15954, sortOrder: 710 },
  { name: "Heigan the Unclean",   slug: "heigan-the-unclean",   raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15936, sortOrder: 711 },
  { name: "Loatheb",              slug: "loatheb",              raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16011, sortOrder: 712 },
  { name: "Instructor Razuvious", slug: "instructor-razuvious", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16061, sortOrder: 720 },
  { name: "Gothik the Harvester", slug: "gothik-the-harvester", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16060, sortOrder: 721 },
  { name: "The Four Horsemen",    slug: "the-four-horsemen",    raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16062, sortOrder: 722, aliases: ["Baron Rivendare", "Highlord Mograine", "Lady Blaumeux", "Thane Kor'thazz"] },
  { name: "Patchwerk",            slug: "patchwerk",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16028, sortOrder: 730 },
  { name: "Grobbulus",            slug: "grobbulus",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15931, sortOrder: 731 },
  { name: "Gluth",                slug: "gluth",                raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15932, sortOrder: 732 },
  { name: "Thaddius",             slug: "thaddius",             raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15928, sortOrder: 733 },
  { name: "Sapphiron",            slug: "sapphiron",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15989, sortOrder: 740 },
  { name: "Kel'Thuzad",           slug: "kelthuzad",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15990, sortOrder: 741, aliases: ["Kel'Thuzad"] },
];

// ICC boss displays must follow raid progression; alphabetical order puts later wings first.
export const ICC_BOSS_ORDER_NAMES = [
  "Lord Marrowgar",
  "Lady Deathwhisper",
  "Gunship Battle",
  "Deathbringer Saurfang",
  "Festergut",
  "Rotface",
  "Professor Putricide",
  "Blood Prince Council",
  "Blood-Queen Lana'thel",
  "Valithria Dreamwalker",
  "Sindragosa",
  "The Lich King",
] as const;

export type IccBossName = typeof ICC_BOSS_ORDER_NAMES[number];

export const ICC_BOSS_ORDER: Record<IccBossName, number> = ICC_BOSS_ORDER_NAMES.reduce(
  (acc, name, index) => {
    acc[name] = index + 1;
    return acc;
  },
  {} as Record<IccBossName, number>
);

const ICC_BOSS_NAME_ALIASES: ReadonlyArray<readonly [string, IccBossName]> = [
  ["Gunship", "Gunship Battle"],
  ["Gunship Battle - Alliance", "Gunship Battle"],
  ["Gunship Battle - Horde", "Gunship Battle"],
  ["Skybreaker", "Gunship Battle"],
  ["The Skybreaker", "Gunship Battle"],
  ["Orgrim's Hammer", "Gunship Battle"],
  ["Blood Queen Lana'thel", "Blood-Queen Lana'thel"],
  ["Blood Queen Lanathel", "Blood-Queen Lana'thel"],
  ["Blood-Queen Lanathel", "Blood-Queen Lana'thel"],
  ["Lich King", "The Lich King"],
  ["Arthas", "The Lich King"],
];

const ICC_BOSS_NAME_BY_LOOKUP = new Map<string, IccBossName>([
  ...ICC_BOSS_ORDER_NAMES.map((name) => [normalizeBossLookupKey(name), name] as const),
  ...ICC_BOSS_NAME_ALIASES.map(([alias, canonical]) => [normalizeBossLookupKey(alias), canonical] as const),
]);

function normalizeBossLookupKey(name: string): string {
  return name
    .trim()
    .replace(/[`\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*(alliance|horde)$/i, "")
    .toLowerCase();
}

export function normalizeIccBossName(name: string): string {
  const trimmed = name.trim();
  return ICC_BOSS_NAME_BY_LOOKUP.get(normalizeBossLookupKey(trimmed)) ?? trimmed;
}

export function getIccBossOrder(name: string): number | null {
  const normalizedName = normalizeIccBossName(name);
  return Object.prototype.hasOwnProperty.call(ICC_BOSS_ORDER, normalizedName)
    ? ICC_BOSS_ORDER[normalizedName as IccBossName]
    : null;
}

export function compareBossNamesByICCOrder(a: string, b: string): number {
  const aOrder = getIccBossOrder(a);
  const bOrder = getIccBossOrder(b);

  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  if (aOrder !== null) return -1;
  if (bOrder !== null) return 1;
  return 0;
}

export function sortByICCOrder<T>(items: readonly T[], getBossName: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (
      compareBossNamesByICCOrder(getBossName(a.item), getBossName(b.item))
      || a.index - b.index
    ))
    .map(({ item }) => item);
}

export function sortBossesByICCOrder<T extends { name: string }>(bosses: readonly T[]): T[] {
  return sortByICCOrder(bosses, boss => boss.name);
}

// Lookup maps for fast parser access
export const BOSS_BY_NAME = new Map(
  WOTLK_BOSSES.map(b => [b.name.toLowerCase(), b])
);

export const BOSS_BY_ID = new Map(
  WOTLK_BOSSES.filter(b => b.wowBossId).map(b => [b.wowBossId!, b])
);

export const BOSS_BY_SLUG = new Map(
  WOTLK_BOSSES.map(b => [b.slug, b])
);

// All known boss/alias names flattened for quick set lookup
export const ALL_BOSS_NAMES: Set<string> = new Set([
  ...WOTLK_BOSSES.map(b => b.name.toLowerCase()),
  ...WOTLK_BOSSES.flatMap(b => (b.aliases ?? []).map(a => a.toLowerCase())),
]);

export const RAIDS = [
  ...new Map(WOTLK_BOSSES.map(b => [b.raidSlug, { name: b.raid, slug: b.raidSlug }])).values(),
];
