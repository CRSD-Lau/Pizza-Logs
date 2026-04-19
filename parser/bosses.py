"""
WotLK boss definitions — mirrors lib/constants/bosses.ts.
Used by the parser to detect raid encounters.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class BossDef:
    name: str
    slug: str
    raid: str
    wow_boss_id: Optional[int] = None
    aliases: list[str] = field(default_factory=list)


BOSSES: list[BossDef] = [
    # Naxxramas
    BossDef("Anub'Rekhan",           "anub-rekhan",          "Naxxramas",               15956),
    BossDef("Grand Widow Faerlina",  "grand-widow-faerlina", "Naxxramas",               15953),
    BossDef("Maexxna",               "maexxna",              "Naxxramas",               15952),
    BossDef("Noth the Plaguebringer","noth-the-plaguebringer","Naxxramas",              15954),
    BossDef("Heigan the Unclean",    "heigan-the-unclean",   "Naxxramas",               15936),
    BossDef("Loatheb",               "loatheb",              "Naxxramas",               16011),
    BossDef("Instructor Razuvious",  "instructor-razuvious", "Naxxramas",               16061),
    BossDef("Gothik the Harvester",  "gothik-the-harvester", "Naxxramas",               16060),
    BossDef("The Four Horsemen",     "the-four-horsemen",    "Naxxramas",               16062,
            ["Baron Rivendare", "Highlord Mograine", "Lady Blaumeux", "Thane Kor'thazz"]),
    BossDef("Patchwerk",             "patchwerk",            "Naxxramas",               16028),
    BossDef("Grobbulus",             "grobbulus",            "Naxxramas",               15931),
    BossDef("Gluth",                 "gluth",                "Naxxramas",               15932),
    BossDef("Thaddius",              "thaddius",             "Naxxramas",               15928),
    BossDef("Sapphiron",             "sapphiron",            "Naxxramas",               15989),
    BossDef("Kel'Thuzad",            "kelthuzad",            "Naxxramas",               15990),

    # Eye of Eternity
    BossDef("Malygos",               "malygos",              "Eye of Eternity",         28859),

    # Obsidian Sanctum
    BossDef("Sartharion",            "sartharion",           "The Obsidian Sanctum",    28860),

    # Vault of Archavon
    BossDef("Archavon the Stone Watcher","archavon",         "Vault of Archavon",       31125),
    BossDef("Emalon the Storm Watcher",  "emalon",           "Vault of Archavon",       33993),
    BossDef("Koralon the Flame Watcher", "koralon",          "Vault of Archavon",       35013),
    BossDef("Toravon the Ice Watcher",   "toravon",          "Vault of Archavon",       38433),

    # Ulduar
    BossDef("Flame Leviathan",       "flame-leviathan",      "Ulduar",                  33113),
    BossDef("Ignis the Furnace Master","ignis",              "Ulduar",                  33118),
    BossDef("Razorscale",            "razorscale",           "Ulduar",                  33186),
    BossDef("XT-002 Deconstructor",  "xt-002",               "Ulduar",                  33293),
    BossDef("Assembly of Iron",      "assembly-of-iron",     "Ulduar",                  33271,
            ["Steelbreaker", "Molgeim", "Brundir"]),
    BossDef("Kologarn",              "kologarn",             "Ulduar",                  32930),
    BossDef("Auriaya",               "auriaya",              "Ulduar",                  33515),
    BossDef("Hodir",                 "hodir",                "Ulduar",                  32845),
    BossDef("Thorim",                "thorim",               "Ulduar",                  32865),
    BossDef("Freya",                 "freya",                "Ulduar",                  32906),
    BossDef("Mimiron",               "mimiron",              "Ulduar",                  33350),
    BossDef("General Vezax",         "general-vezax",        "Ulduar",                  33271),
    BossDef("Yogg-Saron",            "yogg-saron",           "Ulduar",                  33288),
    BossDef("Algalon the Observer",  "algalon",              "Ulduar",                  32871),

    # Trial of the Crusader
    BossDef("Northrend Beasts",      "northrend-beasts",     "Trial of the Crusader",   34796,
            ["Gormok the Impaler", "Icehowl", "Acidmaw", "Dreadscale"]),
    BossDef("Lord Jaraxxus",         "lord-jaraxxus",        "Trial of the Crusader",   34780),
    BossDef("Faction Champions",     "faction-champions",    "Trial of the Crusader",   34968),
    BossDef("Twin Val'kyr",          "twin-valkyr",          "Trial of the Crusader",   34497,
            ["Fjola Lightbane", "Eydis Darkbane"]),
    BossDef("Anub'arak",             "anubarak",             "Trial of the Crusader",   34564),

    # Icecrown Citadel
    BossDef("Lord Marrowgar",        "lord-marrowgar",       "Icecrown Citadel",        36612),
    BossDef("Lady Deathwhisper",     "lady-deathwhisper",    "Icecrown Citadel",        36855),
    BossDef("Gunship Battle",        "gunship-battle",       "Icecrown Citadel",        37813,
            ["Skybreaker", "Orgrim's Hammer"]),
    BossDef("Deathbringer Saurfang", "deathbringer-saurfang","Icecrown Citadel",        37813),
    BossDef("Festergut",             "festergut",            "Icecrown Citadel",        36626),
    BossDef("Rotface",               "rotface",              "Icecrown Citadel",        36627),
    BossDef("Professor Putricide",   "professor-putricide",  "Icecrown Citadel",        36678),
    BossDef("Blood Prince Council",  "blood-prince-council", "Icecrown Citadel",        37958,
            ["Prince Valanar", "Prince Keleseth", "Prince Taldaram"]),
    BossDef("Blood-Queen Lana'thel", "blood-queen-lanathel", "Icecrown Citadel",        37955),
    BossDef("Valithria Dreamwalker", "valithria-dreamwalker","Icecrown Citadel",        36789),
    BossDef("Sindragosa",            "sindragosa",           "Icecrown Citadel",        36853),
    BossDef("The Lich King",         "the-lich-king",        "Icecrown Citadel",        36597,
            ["Lich King", "Arthas"]),

    # Ruby Sanctum
    BossDef("Halion",                "halion",               "Ruby Sanctum",            39863),
]

# ── Lookup maps ──────────────────────────────────────────────────

# name (lower) → BossDef
BOSS_BY_NAME: dict[str, BossDef] = {}
for _b in BOSSES:
    BOSS_BY_NAME[_b.name.lower()] = _b
    for _alias in _b.aliases:
        BOSS_BY_NAME[_alias.lower()] = _b

# wow_boss_id → BossDef
BOSS_BY_ID: dict[int, BossDef] = {
    b.wow_boss_id: b for b in BOSSES if b.wow_boss_id
}

# flat set of all known boss/alias names
ALL_BOSS_NAMES: set[str] = set(BOSS_BY_NAME.keys())


def lookup_boss(name: str) -> Optional[BossDef]:
    return BOSS_BY_NAME.get(name.lower())


def lookup_boss_by_id(boss_id: int) -> Optional[BossDef]:
    return BOSS_BY_ID.get(boss_id)
