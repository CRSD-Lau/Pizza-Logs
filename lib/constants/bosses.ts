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
export const WOTLK_BOSSES: BossDefinition[] = [
  // ─── NAXXRAMAS ───────────────────────────────────────────────
  { name: "Anub'Rekhan",          slug: "anub-rekhan",          raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15956, sortOrder: 10 },
  { name: "Grand Widow Faerlina", slug: "grand-widow-faerlina", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15953, sortOrder: 11 },
  { name: "Maexxna",              slug: "maexxna",              raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15952, sortOrder: 12 },
  { name: "Noth the Plaguebringer", slug: "noth-the-plaguebringer", raid: "Naxxramas",              raidSlug: "naxxramas",                  wowBossId: 15954, sortOrder: 20 },
  { name: "Heigan the Unclean",   slug: "heigan-the-unclean",   raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15936, sortOrder: 21 },
  { name: "Loatheb",              slug: "loatheb",              raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16011, sortOrder: 22 },
  { name: "Instructor Razuvious", slug: "instructor-razuvious", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16061, sortOrder: 30 },
  { name: "Gothik the Harvester", slug: "gothik-the-harvester", raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16060, sortOrder: 31 },
  { name: "The Four Horsemen",    slug: "the-four-horsemen",    raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16062, sortOrder: 32, aliases: ["Baron Rivendare", "Highlord Mograine", "Lady Blaumeux", "Thane Kor'thazz"] },
  { name: "Patchwerk",            slug: "patchwerk",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 16028, sortOrder: 40 },
  { name: "Grobbulus",            slug: "grobbulus",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15931, sortOrder: 41 },
  { name: "Gluth",                slug: "gluth",                raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15932, sortOrder: 42 },
  { name: "Thaddius",             slug: "thaddius",             raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15928, sortOrder: 43 },
  { name: "Sapphiron",            slug: "sapphiron",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15989, sortOrder: 50 },
  { name: "Kel'Thuzad",           slug: "kelthuzad",            raid: "Naxxramas",                  raidSlug: "naxxramas",                  wowBossId: 15990, sortOrder: 51, aliases: ["Kel'Thuzad"] },

  // ─── EYE OF ETERNITY ─────────────────────────────────────────
  { name: "Malygos",              slug: "malygos",              raid: "Eye of Eternity",            raidSlug: "eye-of-eternity",            wowBossId: 28859, sortOrder: 100 },

  // ─── OBSIDIAN SANCTUM ────────────────────────────────────────
  { name: "Sartharion",           slug: "sartharion",           raid: "The Obsidian Sanctum",       raidSlug: "obsidian-sanctum",           wowBossId: 28860, sortOrder: 110 },

  // ─── VAULT OF ARCHAVON ───────────────────────────────────────
  { name: "Archavon the Stone Watcher", slug: "archavon",      raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 31125, sortOrder: 120 },
  { name: "Emalon the Storm Watcher",   slug: "emalon",        raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 33993, sortOrder: 121 },
  { name: "Koralon the Flame Watcher",  slug: "koralon",       raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 35013, sortOrder: 122 },
  { name: "Toravon the Ice Watcher",    slug: "toravon",       raid: "Vault of Archavon",          raidSlug: "vault-of-archavon",          wowBossId: 38433, sortOrder: 123 },

  // ─── ULDUAR ──────────────────────────────────────────────────
  { name: "Flame Leviathan",      slug: "flame-leviathan",      raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33113, sortOrder: 200 },
  { name: "Ignis the Furnace Master", slug: "ignis",            raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33118, sortOrder: 201 },
  { name: "Razorscale",           slug: "razorscale",           raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33186, sortOrder: 202 },
  { name: "XT-002 Deconstructor", slug: "xt-002",               raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33293, sortOrder: 203 },
  { name: "Assembly of Iron",     slug: "assembly-of-iron",     raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33271, sortOrder: 210, aliases: ["Steelbreaker", "Molgeim", "Brundir"] },
  { name: "Kologarn",             slug: "kologarn",             raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32930, sortOrder: 211 },
  { name: "Auriaya",              slug: "auriaya",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33515, sortOrder: 212 },
  { name: "Hodir",                slug: "hodir",                raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32845, sortOrder: 220 },
  { name: "Thorim",               slug: "thorim",               raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32865, sortOrder: 221 },
  { name: "Freya",                slug: "freya",                raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32906, sortOrder: 222 },
  { name: "Mimiron",              slug: "mimiron",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33350, sortOrder: 223 },
  { name: "General Vezax",        slug: "general-vezax",        raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33271, sortOrder: 230 },
  { name: "Yogg-Saron",           slug: "yogg-saron",           raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 33288, sortOrder: 231 },
  { name: "Algalon the Observer", slug: "algalon",              raid: "Ulduar",                     raidSlug: "ulduar",                     wowBossId: 32871, sortOrder: 232 },

  // ─── TRIAL OF THE CRUSADER ───────────────────────────────────
  { name: "Northrend Beasts",     slug: "northrend-beasts",     raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34796, sortOrder: 300, aliases: ["Gormok the Impaler", "Icehowl", "Acidmaw", "Dreadscale"] },
  { name: "Lord Jaraxxus",        slug: "lord-jaraxxus",        raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34780, sortOrder: 301 },
  { name: "Faction Champions",    slug: "faction-champions",    raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34968, sortOrder: 302 },
  { name: "Twin Val'kyr",         slug: "twin-valkyr",          raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34497, sortOrder: 303, aliases: ["Fjola Lightbane", "Eydis Darkbane"] },
  { name: "Anub'arak",            slug: "anubarak",             raid: "Trial of the Crusader",      raidSlug: "trial-of-the-crusader",      wowBossId: 34564, sortOrder: 304 },

  // ─── ICECROWN CITADEL ────────────────────────────────────────
  { name: "Lord Marrowgar",       slug: "lord-marrowgar",       raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36612, sortOrder: 400 },
  { name: "Lady Deathwhisper",    slug: "lady-deathwhisper",    raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36855, sortOrder: 401 },
  { name: "Gunship Battle",       slug: "gunship-battle",       raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37813, sortOrder: 402, aliases: ["Skybreaker", "Orgrim's Hammer"] },
  { name: "Deathbringer Saurfang",slug: "deathbringer-saurfang",raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37813, sortOrder: 403 },
  { name: "Festergut",            slug: "festergut",            raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36626, sortOrder: 410 },
  { name: "Rotface",              slug: "rotface",              raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36627, sortOrder: 411 },
  { name: "Professor Putricide",  slug: "professor-putricide",  raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36678, sortOrder: 412 },
  { name: "Blood Prince Council", slug: "blood-prince-council", raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37958, sortOrder: 420, aliases: ["Prince Valanar", "Prince Keleseth", "Prince Taldaram"] },
  { name: "Blood-Queen Lana'thel",slug: "blood-queen-lanathel", raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 37955, sortOrder: 421 },
  { name: "Valithria Dreamwalker",slug: "valithria-dreamwalker",raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36789, sortOrder: 422 },
  { name: "Sindragosa",           slug: "sindragosa",           raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36853, sortOrder: 423 },
  { name: "The Lich King",        slug: "the-lich-king",        raid: "Icecrown Citadel",           raidSlug: "icecrown-citadel",           wowBossId: 36597, sortOrder: 430, aliases: ["Lich King", "Arthas"] },

  // ─── RUBY SANCTUM ────────────────────────────────────────────
  { name: "Halion",               slug: "halion",               raid: "Ruby Sanctum",               raidSlug: "ruby-sanctum",               wowBossId: 39863, sortOrder: 500 },
];

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
