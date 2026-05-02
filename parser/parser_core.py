"""
WoW combat log parser — stream-processes large files, extracts raid boss
encounters, aggregates DPS/HPS per player, produces encounter fingerprints.

Supports:
  - ENCOUNTER_START / ENCOUNTER_END events (modern WotLK private servers)
  - Heuristic name-based detection fallback
  - Both 3.3.5a and 3.x log formats
"""

from __future__ import annotations

import csv as _csv
import hashlib
import re
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Generator, Optional, TextIO

from bosses import BossDef, lookup_boss, lookup_boss_by_id, ALL_BOSS_NAMES

# ── Constants ─────────────────────────────────────────────────────

# Spell names that only appear in heroic difficulty encounters.
# Used to upgrade "25N"/"10N" to "25H"/"10H" — runs regardless of whether
# ENCOUNTER_START is present, because Warmane emits difficultyID=4 (25N) for heroic runs.
HEROIC_SPELL_MARKERS: frozenset[str] = frozenset({
    # Lord Marrowgar (ICC) — multi-target cleave only present in heroic
    "bone slice",
    # Deathbringer Saurfang (ICC) — heroic debuff DoT
    "rune of blood",
    # Blood-Queen Lana'thel (ICC) — heroic group link mechanic
    "pact of the darkfallen",
    # Professor Putricide (ICC) — spreads between players in heroic only
    "unbound plague",
    # NOTE: "backlash" (Sindragosa) and "empowered shock vortex" / "empowered shadow lance" /
    # "empowered blood" (Blood Prince Council) are intentionally EXCLUDED here.
    # On Warmane these spells also appear in 10N, so they cannot be used as heroic-exclusive
    # markers.  Sindragosa and BPC in a 25H session instead inherit the session's heroic
    # difficulty via _normalize_session_difficulty (25N → 25H promotion).
})

# Gunship Battle: Warmane emits ENCOUNTER_END success=0 even on a genuine kill
# (the fight ends via scripted ship destruction, not a boss UNIT_DIED).
# A KILL is detected by any crew member dying during the encounter window.
# Sources: Horde log = players board The Skybreaker (Alliance ship crew die).
#          Alliance log = players board Orgrim's Hammer (Kor'kron crew die).
GUNSHIP_CREW_NAMES: frozenset[str] = frozenset({
    # Skybreaker (Alliance ship) crew — appear in Horde-side logs
    "muradin bronzebeard",
    "high captain justin bartlett",
    "skybreaker sorcerer",
    "skybreaker rifleman",
    "skybreaker sergeant",
    "skybreaker mortar soldier",
    "skybreaker vindicator",
    "skybreaker marksman",
    # Kor'kron (Horde ship) crew — appear in Alliance-side logs
    "kor'kron battle-mage",
    "kor'kron primalist",
    "kor'kron defender",
    "kor'kron invoker",
    "kor'kron reaver",
    "kor'kron sergeant",
})

# Source: Skada-WoTLK Skada/Modules/Damage.lua — RegisterForCL call.
# We track exactly the same damage events Skada tracks.
DMG_EVENTS = {
    "SPELL_DAMAGE",
    "SWING_DAMAGE",
    "RANGE_DAMAGE",
    "SPELL_PERIODIC_DAMAGE",
    "DAMAGE_SHIELD",          # Thorns / Retribution Aura reflect — Skada includes
    "DAMAGE_SPLIT",           # Shared-damage mechanics — Skada includes
    "SPELL_BUILDING_DAMAGE",  # Gunship cannons etc. — Skada includes
    # Missed events (SWING_MISSED, SPELL_MISSED, etc.) are registered by Skada
    # for miss-rate stats only; they contribute 0 damage so we skip them.
}

# Source: Skada-WoTLK Skada/Modules/Healing.lua — RegisterForCL call.
# Skada registers exactly SPELL_HEAL and SPELL_PERIODIC_HEAL for healing done.
# SPELL_HEAL_ABSORBED is NOT registered by Skada — it has a different field
# structure (parts[10] = absorb amount, not a heal amount) and is not counted.
HEAL_EVENTS = {
    "SPELL_HEAL",
    "SPELL_PERIODIC_HEAL",
}

# Spells excluded from healing-done totals.
#
# Source: Skada-WoTLK Skada/Core/Tables.lua
# Tables.lua defines: ignored_spells.buff, .debuff, .firsthit, .time — there is
# NO ignored_spells.heal table. Skada excludes NO spells from healing-done totals
# by spell name/ID. Every SPELL_HEAL and SPELL_PERIODIC_HEAL event counts.
#
# Previously excluded (now confirmed included per Skada):
#   - Judgement of Light  — commented-out line in Tables.lua = NOT excluded
#   - Vampiric Embrace    — never in any exclusion list
#   - Improved Leader of the Pack — never in any exclusion list
PASSIVE_HEAL_EXCLUSIONS: frozenset[str] = frozenset()

UNIT_DIED_EVENT = "UNIT_DIED"
ENCOUNTER_START  = "ENCOUNTER_START"
ENCOUNTER_END    = "ENCOUNTER_END"

# GUID prefix for player characters (0x0000000000 prefix bits)
PLAYER_GUID_RE = re.compile(r"^Player-", re.I)

# Gap in seconds that signals a new encounter when no ENCOUNTER events present
ENCOUNTER_GAP_SECONDS = 30

# Minimum events to treat a fight segment as a real encounter
MIN_ENCOUNTER_EVENTS = 10

# Map common spell names → WoW class (used to detect player class from spellcasts)
SPELL_CLASS_MAP: dict[str, str] = {
    # Death Knight
    "Icy Touch": "Death Knight", "Plague Strike": "Death Knight",
    "Blood Strike": "Death Knight", "Heart Strike": "Death Knight",
    "Frost Strike": "Death Knight", "Scourge Strike": "Death Knight",
    "Obliterate": "Death Knight", "Death Coil": "Death Knight",
    "Death and Decay": "Death Knight", "Howling Blast": "Death Knight",
    "Blood Boil": "Death Knight", "Dark Command": "Death Knight",
    "Death Grip": "Death Knight", "Rune Strike": "Death Knight",
    "Ebon Plague": "Death Knight",
    # Druid
    "Moonfire": "Druid", "Starfire": "Druid", "Wrath": "Druid",
    "Insect Swarm": "Druid", "Starfall": "Druid", "Hurricane": "Druid",
    "Typhoon": "Druid", "Mangle": "Druid", "Shred": "Druid",
    "Rake": "Druid", "Rip": "Druid", "Ferocious Bite": "Druid",
    "Maul": "Druid", "Lacerate": "Druid", "Lifebloom": "Druid",
    "Rejuvenation": "Druid", "Regrowth": "Druid", "Nourish": "Druid",
    "Healing Touch": "Druid", "Wild Growth": "Druid", "Tranquility": "Druid",
    # Hunter
    "Arcane Shot": "Hunter", "Steady Shot": "Hunter", "Multi-Shot": "Hunter",
    "Chimera Shot": "Hunter", "Explosive Shot": "Hunter", "Aimed Shot": "Hunter",
    "Kill Shot": "Hunter", "Serpent Sting": "Hunter", "Black Arrow": "Hunter",
    "Hunter's Mark": "Hunter", "Silencing Shot": "Hunter", "Volley": "Hunter",
    "Scatter Shot": "Hunter",
    # Mage
    "Fireball": "Mage", "Frostbolt": "Mage", "Arcane Missiles": "Mage",
    "Arcane Blast": "Mage", "Arcane Barrage": "Mage", "Living Bomb": "Mage",
    "Scorch": "Mage", "Fire Blast": "Mage", "Pyroblast": "Mage",
    "Blizzard": "Mage", "Ice Lance": "Mage", "Deep Freeze": "Mage",
    "Frostfire Bolt": "Mage", "Flamestrike": "Mage",
    # Paladin
    "Crusader Strike": "Paladin", "Divine Storm": "Paladin",
    "Hammer of Wrath": "Paladin", "Judgement of Light": "Paladin",
    "Judgement of Wisdom": "Paladin", "Holy Light": "Paladin",
    "Flash of Light": "Paladin", "Beacon of Light": "Paladin",
    "Consecration": "Paladin", "Shield of Righteousness": "Paladin",
    "Hammer of the Righteous": "Paladin", "Avenger's Shield": "Paladin",
    "Exorcism": "Paladin", "Hand of Reckoning": "Paladin",
    # Priest
    "Mind Blast": "Priest", "Shadow Word: Pain": "Priest",
    "Mind Flay": "Priest", "Devouring Plague": "Priest",
    "Vampiric Touch": "Priest", "Holy Nova": "Priest",
    "Prayer of Mending": "Priest", "Prayer of Healing": "Priest",
    "Circle of Healing": "Priest", "Greater Heal": "Priest",
    "Flash Heal": "Priest", "Renew": "Priest", "Power Word: Shield": "Priest",
    "Penance": "Priest", "Shadowfiend": "Priest",
    # Rogue
    "Rupture": "Rogue", "Hemorrhage": "Rogue", "Mutilate": "Rogue",
    "Sinister Strike": "Rogue", "Eviscerate": "Rogue", "Expose Armor": "Rogue",
    "Fan of Knives": "Rogue", "Envenom": "Rogue", "Garrote": "Rogue",
    "Backstab": "Rogue", "Ambush": "Rogue",
    # Shaman
    "Lava Burst": "Shaman", "Earth Shock": "Shaman", "Flame Shock": "Shaman",
    "Frost Shock": "Shaman", "Chain Lightning": "Shaman",
    "Lightning Bolt": "Shaman", "Thunderstorm": "Shaman",
    "Stormstrike": "Shaman", "Lava Lash": "Shaman",
    "Chain Heal": "Shaman", "Riptide": "Shaman", "Earth Shield": "Shaman",
    "Healing Wave": "Shaman", "Lesser Healing Wave": "Shaman",
    # Warlock
    "Shadow Bolt": "Warlock", "Incinerate": "Warlock", "Corruption": "Warlock",
    "Unstable Affliction": "Warlock", "Haunt": "Warlock",
    "Curse of Agony": "Warlock", "Chaos Bolt": "Warlock",
    "Conflagrate": "Warlock", "Drain Soul": "Warlock", "Immolate": "Warlock",
    "Fel Armor": "Warlock", "Rain of Fire": "Warlock",
    "Seed of Corruption": "Warlock",
    # Warrior
    "Mortal Strike": "Warrior", "Execute": "Warrior", "Whirlwind": "Warrior",
    "Bladestorm": "Warrior", "Heroic Strike": "Warrior", "Cleave": "Warrior",
    "Sunder Armor": "Warrior", "Devastate": "Warrior", "Shield Slam": "Warrior",
    "Revenge": "Warrior", "Thunder Clap": "Warrior", "Deep Wounds": "Warrior",
    "Slam": "Warrior", "Overpower": "Warrior", "Intercept": "Warrior",
    "Rend": "Warrior", "Bloodthirst": "Warrior", "Victory Rush": "Warrior",
    "Concussion Blow": "Warrior", "Shockwave": "Warrior",
}

# Timestamp regex: "M/D HH:MM:SS.mmm"
TS_RE = re.compile(
    r"^(\d{1,2})/(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})"
)


# ── Data classes ──────────────────────────────────────────────────

@dataclass
class SpellStats:
    damage:  float = 0.0
    healing: float = 0.0
    hits:    int   = 0
    crits:   int   = 0
    school:  int   = 1


@dataclass
class TargetStats:
    """Damage dealt by one player to one specific mob/target."""
    damage: float = 0.0
    hits:   int   = 0
    crits:  int   = 0


@dataclass
class ActorStats:
    name:         str
    guids:        set[str]  = field(default_factory=set)
    wow_class:    Optional[str] = None
    total_damage: float = 0.0
    total_healing:float = 0.0
    damage_taken: float = 0.0
    deaths:       int   = 0
    hit_count:    int   = 0
    crit_count:   int   = 0
    spells:       dict[str, SpellStats]  = field(default_factory=dict)
    targets:      dict[str, TargetStats] = field(default_factory=dict)  # mob → stats


@dataclass
class RawEncounterEvent:
    ts:        float   # seconds since midnight
    event:     str
    src_name:  str
    src_guid:  str
    dst_name:  str
    dst_guid:  str
    spell_name:str
    school:    int
    amount:    float
    overkill:  float
    is_crit:   bool
    is_heal:   bool


@dataclass
class ParsedEncounter:
    boss_name:         str
    boss_def:          Optional[BossDef]
    boss_id:           Optional[int]
    difficulty:        str
    group_size:        int
    outcome:           str    # KILL | WIPE | UNKNOWN
    duration_seconds:  float
    started_at:        str    # ISO-8601 UTC
    ended_at:          str
    total_damage:      float
    total_healing:     float
    total_damage_taken:float
    fingerprint:       str
    participants:      list[dict]
    raw_event_count:   int
    session_index:     int = 0   # 0-based index; increments on >60 min gap


# ── CSV line splitter ──────────────────────────────────────────────

def csv_split(s: str) -> list[str]:
    """Split a WoW log CSV line, honouring quoted strings.
    Uses Python's C-implemented csv module — ~20x faster than a Python loop."""
    return next(_csv.reader((s,)))


# ── Timestamp parser ───────────────────────────────────────────────

def parse_ts(ts_str: str) -> float:
    """Return seconds-since-midnight float from 'M/D HH:MM:SS.mmm'."""
    m = TS_RE.match(ts_str.strip())
    if not m:
        return 0.0
    h, mn, s, ms = int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6))
    return h * 3600 + mn * 60 + s + ms / 1000.0


def parse_ts_to_iso(ts_str: str, year_hint: int = 2024) -> str:
    """Return an ISO timestamp string. Year is inferred from context (file mtime)."""
    m = TS_RE.match(ts_str.strip())
    if not m:
        return datetime.now(timezone.utc).isoformat()
    mo, day = int(m.group(1)), int(m.group(2))
    h, mn, s, ms = int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6))
    try:
        dt = datetime(year_hint, mo, day, h, mn, s, ms * 1000, tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


# ── Main parser class ──────────────────────────────────────────────

class CombatLogParser:
    def __init__(self, file_year: int = 2024):
        self.file_year    = file_year
        self.raw_count    = 0
        self.warnings: list[str] = []
        self.session_damage: dict[int, float] = {}
        # Cache boss name set once — this is hit millions of times during segmentation
        self._boss_name_set: set[str] = ALL_BOSS_NAMES

    def parse_file(
        self,
        fh: TextIO,
        total_lines: int = 0,
        progress_cb: Optional[object] = None,
    ) -> list[ParsedEncounter]:
        """Main entry point — returns list of raid boss encounters.

        Args:
            fh:           open file handle
            total_lines:  pre-counted line total (for progress %). 0 = unknown
            progress_cb:  callable(lines_done: int, total: int) — called every 50k lines
        """
        lines = self._iter_lines(fh, total_lines, progress_cb)
        segments, pet_owner = self._segment_encounters(lines)
        encounters: list[ParsedEncounter] = []
        for seg in segments:
            enc = self._aggregate_segment(seg, pet_owner)
            if enc:
                encounters.append(enc)
        self._assign_session_indices(encounters)
        self._normalize_session_difficulty(encounters)
        return encounters

    @staticmethod
    def _normalize_session_difficulty(encounters: list["ParsedEncounter"]) -> None:
        """Normalize encounter difficulties within a session.

        Two cases handled:

        1. Gunship Battle: Warmane emits difficultyID=4 (25N) even on heroic kills
           because the boss has no heroic-exclusive spells.  Always inherit from session.

        2. 25N encounters in a confirmed 25H session: some bosses (Sindragosa, Blood Prince
           Council) have spells that look heroic-exclusive but also appear in 10N on Warmane,
           so their markers were removed from HEROIC_SPELL_MARKERS.  In a 25H session (where
           other bosses confirmed heroic via reliable markers like Marrowgar "Bone Slice" or
           Saurfang "Rune of Blood") any remaining 25N encounter is promoted to 25H.
           10N encounters are never promoted — group-size detection is reliable.
        """
        by_session: dict[int, list["ParsedEncounter"]] = {}
        for enc in encounters:
            by_session.setdefault(enc.session_index, []).append(enc)
        for session_encs in by_session.values():
            heroic_diff = next(
                (e.difficulty for e in session_encs if e.difficulty in ("25H", "10H")),
                None,
            )
            if not heroic_diff:
                continue
            for enc in session_encs:
                if enc.difficulty in ("25H", "10H"):
                    continue  # already heroic — no change needed
                bn = (enc.boss_name or "").lower()
                if "gunship" in bn:
                    # Gunship: always inherit session difficulty
                    enc.difficulty = heroic_diff
                elif heroic_diff == "25H" and enc.difficulty == "25N":
                    # 25N encounter in a confirmed 25H session → promote to 25H.
                    # 10N encounters are intentionally left alone (10N and 10H can
                    # coexist across sessions; group-size detection is reliable for 10).
                    enc.difficulty = "25H"

    @staticmethod
    def _assign_session_indices(
        encounters: list["ParsedEncounter"],
        gap_seconds: int = 3600,   # >60 min gap → new raid session
    ) -> None:
        """Tag each encounter with a 0-based session_index.
        Encounters within the same raid night share an index;
        a gap larger than gap_seconds bumps the index."""
        if not encounters:
            return
        session_idx = 0
        prev_end_dt: Optional[datetime] = None
        for enc in encounters:
            try:
                start_dt = datetime.fromisoformat(enc.started_at.replace("Z", "+00:00"))
                end_dt   = datetime.fromisoformat(enc.ended_at.replace("Z", "+00:00"))
            except ValueError:
                enc.session_index = session_idx
                continue
            if prev_end_dt is not None:
                gap = (start_dt - prev_end_dt).total_seconds()
                if gap > gap_seconds:
                    session_idx += 1
            enc.session_index = session_idx
            prev_end_dt = end_dt

    # ── Internal: line iteration ─────────────────────────────────

    def _iter_lines(
        self,
        fh: TextIO,
        total_lines: int = 0,
        progress_cb=None,
    ) -> Generator[tuple[str, list[str], float], None, None]:
        """Yield (raw_ts_str, parts, ts_float) for every parseable line."""
        _REPORT_EVERY = 50_000
        for raw_line in fh:
            self.raw_count += 1
            if progress_cb and self.raw_count % _REPORT_EVERY == 0:
                progress_cb(self.raw_count, total_lines)
            line = raw_line.strip()
            if not line:
                continue
            # Split timestamp from the rest
            space_idx = line.find("  ")
            if space_idx == -1:
                continue
            ts_str = line[:space_idx].strip()
            rest   = line[space_idx + 2:]
            try:
                parts = csv_split(rest)
            except Exception:
                continue
            if len(parts) < 2:
                continue
            ts = parse_ts(ts_str)
            yield ts_str, parts, ts

    # ── Internal: segmentation ───────────────────────────────────

    def _segment_encounters(
        self, lines: Generator[tuple[str, list[str], float], None, None]
    ) -> tuple[list[list[tuple[str, list[str], float]]], dict[str, tuple[str, str]]]:
        """
        Group lines into encounter segments.

        Strategy (priority order):
          1. ENCOUNTER_START / ENCOUNTER_END events (modern private servers)
          2. Heuristic: anchor on boss-name events, then collect ALL events
             during the fight window (so healer/player events are included)

        Also builds a global pet_owner map (pet_guid → (owner_guid, owner_name))
        from SPELL_SUMMON events so pet/summon damage can be credited to owners.
        """
        segments: list[list[tuple[str, list[str], float]]] = []
        # pet_guid → (owner_guid, owner_name)
        pet_owner: dict[str, tuple[str, str]] = {}

        # ── Path A: ENCOUNTER_START/END ──────────────────────────
        current_segment: list[tuple[str, list[str], float]] = []
        in_encounter = False
        has_encounter_events = False

        # ── Path B: heuristic state ───────────────────────────────
        # We collect ALL events while a boss fight is active.
        # A fight starts when a boss-name event appears.
        # A fight ends when 30s pass with no boss-name event.
        heuristic_active = False
        last_boss_ts: float = 0.0
        heuristic_segment: list[tuple[str, list[str], float]] = []
        all_buffer: list[tuple[str, list[str], float]] = []  # rolling buffer of recent events

        # ── Full-session damage accumulator ──────────────────────
        # Counts ALL player/pet damage (boss + trash) to match UWU "Custom Slice".
        # Session boundaries use the same 3600s gap as _assign_session_indices.
        # Midnight rollover: when ts jumps backward >12 h we add a day offset so
        # the absolute timestamp increases monotonically.
        _full_dmg: dict[int, float] = {}
        _full_session_idx: int = 0
        _last_local_ts: float = 0.0
        _day_offset: float = 0.0
        _last_abs_ts: float = -1.0
        _SESSION_BREAK = 3600.0

        for ts_str, parts, ts in lines:
            event = parts[0]

            # ── Midnight-safe session boundary detection ──────────
            if ts < _last_local_ts - 43200.0:  # ts jumped back >12 h = new calendar day
                _day_offset += 86400.0
            abs_ts = _day_offset + ts
            if _last_abs_ts >= 0 and abs_ts - _last_abs_ts > _SESSION_BREAK:
                _full_session_idx += 1
            _last_local_ts = ts
            _last_abs_ts   = abs_ts

            # ── Accumulate full-session player/pet damage ─────────
            # Includes DAMAGE_SHIELD (Retribution Aura, thorns) in addition to
            # DMG_EVENTS — these are excluded from per-boss DPS but UWU counts
            # them in the full Custom Slice total.
            #
            # Uses amount + absorbed - overkill to match UWU / WarcraftLogs
            # "damage done" convention.  When a boss has a shield (Lady
            # Deathwhisper mana barrier, Saurfang Blood Barrier) part of each
            # hit is absorbed: the log records the HP-lost portion in `amount`
            # and the shield-absorbed portion in `absorbed`.  WCL/UWU count
            # both as player output.
            #
            # Field offsets:
            #   SWING_DAMAGE (14 fields): [7]=amount  [8]=overkill  [12]=absorbed
            #   All spell events  (18 f): [10]=amount [11]=overkill [15]=absorbed
            if event in DMG_EVENTS and len(parts) >= 5:
                src_guid  = parts[1]
                dst_guid  = parts[4]
                src_flags = parts[3] if len(parts) > 3 else "0"
                is_player = _is_player(src_guid)
                is_pet    = False
                if not is_player:
                    # Exclude vehicle GUIDs (0xF150* = Gunship Cannons).  They have
                    # TYPE_PET|CONTROL_PLAYER flags and pass the is_pet check, but
                    # UWU treats them as vehicle mechanics, not player damage.
                    if not src_guid.upper().startswith("0XF15"):
                        try:
                            flags = int(src_flags, 16)
                            # Accept TYPE_PET (0x1000) or TYPE_GUARDIAN (0x2000) when
                            # CONTROL_PLAYER (0x0100) is also set.  This covers:
                            #   • Regular pets (Hunter, Warlock, DK ghoul, Shadowfiend)
                            #   • Guardians (Mirror Images, Force of Nature Treants,
                            #     Army of the Dead ghouls, Shaman elementals/totems)
                            is_pet = bool(flags & 0x0100) and bool(flags & 0x3000)
                        except (ValueError, TypeError):
                            pass
                if (is_player or is_pet) and not _is_player(dst_guid):
                    try:
                        if event == "SWING_DAMAGE" and len(parts) >= 9:
                            absorbed = _safe_float(parts[12]) if len(parts) > 12 else 0.0
                            # Skada counts amount+absorbed without subtracting overkill
                            eff = max(0.0, float(parts[7]) + absorbed)
                        elif len(parts) >= 12:
                            absorbed = _safe_float(parts[15]) if len(parts) > 15 else 0.0
                            # Skada counts amount+absorbed without subtracting overkill
                            eff = max(0.0, float(parts[10]) + absorbed)
                        else:
                            eff = 0.0
                        _full_dmg[_full_session_idx] = _full_dmg.get(_full_session_idx, 0.0) + eff
                    except (ValueError, IndexError):
                        pass

            # ── SPELL_SUMMON: build pet→owner map (global, outside segments) ──
            if event == "SPELL_SUMMON" and len(parts) >= 5:
                owner_guid = parts[1]
                owner_name = parts[2].strip('"').strip()
                pet_guid   = parts[4]
                if _is_player(owner_guid) and pet_guid:
                    pet_owner[pet_guid] = (owner_guid, owner_name)
                continue

            # ── Global player→pet interaction scan ───────────────
            # Catches pre-summoned pets (no SPELL_SUMMON in log) via heal events.
            # Restricted to SPELL_HEAL / SPELL_PERIODIC_HEAL so we don't
            # mis-map AoE buffs (e.g. Blessing of Might hitting every pet in
            # the raid, assigning all pets to the Paladin) and don't mis-map
            # vehicle NPCs (Gunship Cannons with CONTROL_PLAYER flags).
            # Also restricted to 0xF14* GUID prefix (true WotLK pet GUIDs);
            # 0xF130 = NPC, 0xF150 = vehicle — these are never pre-summoned pets.
            if (event in ("SPELL_HEAL", "SPELL_PERIODIC_HEAL")
                and len(parts) >= 7
                and _is_player(parts[1])
                and not _is_player(parts[4])
                and parts[4].upper().startswith("0XF14")
                and parts[4] not in pet_owner
            ):
                try:
                    if (int(parts[6], 16) & 0x1100) == 0x1100:
                        pet_owner[parts[4]] = (parts[1], parts[2].strip('"').strip())
                except (ValueError, IndexError):
                    pass

            # ── ENCOUNTER_START ──────────────────────────────────
            if event == ENCOUNTER_START:
                has_encounter_events = True
                in_encounter = True
                current_segment = [(ts_str, parts, ts)]
                continue

            # ── ENCOUNTER_END ────────────────────────────────────
            if event == ENCOUNTER_END:
                has_encounter_events = True
                if current_segment:
                    current_segment.append((ts_str, parts, ts))
                    if len(current_segment) >= MIN_ENCOUNTER_EVENTS:
                        segments.append(current_segment)
                current_segment = []
                in_encounter = False
                continue

            # ── ENCOUNTER_START/END path: collect everything ──────
            if has_encounter_events:
                if in_encounter and (event in DMG_EVENTS or event in HEAL_EVENTS or event == UNIT_DIED_EVENT):
                    current_segment.append((ts_str, parts, ts))
                continue

            # ── Heuristic path (no ENCOUNTER_START in file) ───────
            if event not in DMG_EVENTS and event not in HEAL_EVENTS and event != UNIT_DIED_EVENT:
                continue

            is_boss = self._is_boss_event(parts)

            if heuristic_active:
                if is_boss:
                    # Extend active window
                    last_boss_ts = ts
                    heuristic_segment.append((ts_str, parts, ts))
                elif ts - last_boss_ts <= ENCOUNTER_GAP_SECONDS:
                    # Still within window — collect ALL events (heals, player dmg, deaths)
                    heuristic_segment.append((ts_str, parts, ts))
                else:
                    # Gap exceeded — close this encounter
                    if len(heuristic_segment) >= MIN_ENCOUNTER_EVENTS:
                        segments.append(heuristic_segment)
                    heuristic_segment = []
                    heuristic_active = False
                    # Check if this line itself starts a new boss fight
                    if is_boss:
                        heuristic_active = True
                        last_boss_ts = ts
                        heuristic_segment = [(ts_str, parts, ts)]
            else:
                if is_boss:
                    heuristic_active = True
                    last_boss_ts = ts
                    heuristic_segment = [(ts_str, parts, ts)]

        # Flush trailing segment
        if has_encounter_events:
            if current_segment and len(current_segment) >= MIN_ENCOUNTER_EVENTS:
                segments.append(current_segment)
        else:
            if heuristic_segment and len(heuristic_segment) >= MIN_ENCOUNTER_EVENTS:
                segments.append(heuristic_segment)

        self.session_damage = _full_dmg
        return segments, pet_owner

    def _is_boss_event(self, parts: list[str]) -> bool:
        """Quick check: does this event involve a known boss?"""
        if len(parts) < 6:
            return False
        # csv_split already strips quotes, but strip() is a no-op if already clean
        dst = parts[5].strip('"').strip()
        src = parts[2].strip('"').strip()
        bn = self._boss_name_set
        return dst.lower() in bn or src.lower() in bn

    def _detect_boss_from_parts(self, parts: list[str]) -> Optional[BossDef]:
        if len(parts) < 6:
            return None
        for name_field in (parts[5], parts[2]):
            name = name_field.strip('"').strip()
            boss = lookup_boss(name)
            if boss:
                return boss
        return None

    # ── Internal: aggregation ────────────────────────────────────

    def _aggregate_segment(
        self,
        segment: list[tuple[str, list[str], float]],
        pet_owner: Optional[dict[str, tuple[str, str]]] = None,
    ) -> Optional[ParsedEncounter]:
        """Turn a list of raw log lines into a ParsedEncounter."""
        if not segment:
            return None

        # Determine boss from ENCOUNTER_START if present
        boss_name: Optional[str] = None
        boss_id:   Optional[int] = None
        difficulty = "10N"
        group_size = 10
        outcome    = "UNKNOWN"
        first_ts_str = segment[0][0]
        last_ts_str  = segment[-1][0]

        # Check for ENCOUNTER_START / ENCOUNTER_END markers
        for ts_str, parts, ts in segment:
            if parts[0] == ENCOUNTER_START and len(parts) >= 5:
                boss_id   = _safe_int(parts[1])
                boss_name = parts[2].strip('"').strip()
                diff_id   = _safe_int(parts[3])
                group_size = _safe_int(parts[4]) or 10
                difficulty = _decode_difficulty(diff_id, group_size)
                first_ts_str = ts_str
            elif parts[0] == ENCOUNTER_END and len(parts) >= 6:
                success   = _safe_int(parts[5])
                outcome   = "KILL" if success == 1 else "WIPE"
                last_ts_str = ts_str

        # Gunship Battle: ENCOUNTER_END emits success=0 on Warmane even on a genuine
        # kill (the fight ends via scripted ship destruction, not a boss death event).
        # Override WIPE → KILL if any crew member died during the segment.
        # Horde-side kill (players board The Skybreaker): Skybreaker crew die.
        # Alliance-side kill (players board Orgrim's Hammer): Kor'kron crew die.
        if outcome in ("WIPE", "UNKNOWN") and boss_name and "gunship" in boss_name.lower():
            for _, gparts, _ in segment:
                if gparts[0] == UNIT_DIED_EVENT and len(gparts) >= 6:
                    if gparts[5].strip('"').strip().lower() in GUNSHIP_CREW_NAMES:
                        outcome = "KILL"
                        break

        # Heuristic boss detection if no ENCOUNTER_START
        if not boss_name:
            boss_name, boss_id = self._infer_boss(segment)
            group_size, difficulty = self._infer_difficulty(segment)
            outcome = self._infer_outcome(segment, boss_name)

        # Heroic upgrade: run even when ENCOUNTER_START was present, because Warmane
        # (and many WotLK private servers) emit difficultyID=4 (25N) for heroic runs.
        # HEROIC_SPELL_MARKERS contains spells that only appear in heroic difficulty.
        # If the difficulty was correctly set to H via difficultyID, the replace() is a no-op.
        if difficulty in ("10N", "25N") and self._detect_heroic(segment):
            difficulty = difficulty.replace("N", "H")

        if not boss_name:
            return None  # Cannot identify boss — skip

        boss_def = (lookup_boss_by_id(boss_id) if boss_id else None) or lookup_boss(boss_name)

        # Aggregate actors
        actors: dict[str, ActorStats] = {}
        targets_hit: set[str] = set()
        boss_died_ts: Optional[float] = None  # for accurate KILL duration
        boss_mechanic_healing = 0.0            # heals from non-player → player (boss mechanics)

        boss_name_lower = boss_name.lower() if boss_name else ""
        boss_alias_set  = {a.lower() for a in boss_def.aliases} if boss_def else set()

        # Pre-pass A: discover boss GUIDs from damage/death events where the target
        # name matches the boss. Used later to exclude add damage from per-encounter
        # totals (e.g. Lady Deathwhisper Adherents/Fanatics, BPC Kinetic Bombs).
        boss_guids: set[str] = set()
        for _, _bp, _ in segment:
            ev = _bp[0]
            if ev in DMG_EVENTS or ev == UNIT_DIED_EVENT:
                if len(_bp) >= 6:
                    _dst_guid = _bp[4]
                    _dst_name = _bp[5].strip('"').strip().lower()
                    if _dst_name and (_dst_name == boss_name_lower or _dst_name in boss_alias_set):
                        if _dst_guid and _dst_guid not in ("0x0000000000000000", "0xNIL"):
                            boss_guids.add(_dst_guid)

        # Pre-pass B: resolve pre-summoned pets that have no SPELL_SUMMON entry.
        # Scan every event for player→pet interactions (Mend Pet ticks, buffs,
        # Feed Pet, etc.) — dst_flags TYPE_PET(0x1000)|CONTROL_PLAYER(0x0100)
        # identifies player-owned pets. Running this before the main loop means
        # ordering doesn't matter: pet damage that lands before the first Mend
        # Pet tick is still attributed correctly.
        for _, _p, _ in segment:
            if (len(_p) >= 7
                and _is_player(_p[1])
                and not _is_player(_p[4])
                and _p[4] not in pet_owner
            ):
                try:
                    if (int(_p[6], 16) & 0x1100) == 0x1100:
                        pet_owner[_p[4]] = (_p[1], _p[2].strip('"').strip())
                except (ValueError, IndexError):
                    pass

        for ts_str, parts, ts in segment:
            event = parts[0]
            if event in (ENCOUNTER_START, ENCOUNTER_END):
                continue

            if event == UNIT_DIED_EVENT:
                if len(parts) >= 6:
                    dead_name = parts[5].strip('"').strip()
                    dead_lower = dead_name.lower()
                    # Track boss death for accurate KILL duration.
                    # Also check aliases — e.g. Blood Prince Council dies as "Prince Valanar".
                    if boss_died_ts is None and (
                        dead_lower == boss_name_lower
                        or dead_lower in boss_alias_set
                        or ("valithria" in boss_name_lower and (
                            "combat trigger" in dead_lower or "green dragon" in dead_lower))
                    ):
                        boss_died_ts = ts
                    if dead_name in actors:
                        actors[dead_name].deaths += 1
                continue

            is_heal = event in HEAL_EVENTS

            # Parse SWING_DAMAGE (no spell fields)
            # Fields: event,srcGUID,srcName,srcFlags,dstGUID,dstName,dstFlags,
            #   amount,overkill,school,resisted,blocked,absorbed,critical
            if event == "SWING_DAMAGE":
                if len(parts) < 14:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                amount   = _safe_float(parts[7])
                overkill = _safe_float(parts[8])
                absorbed = _safe_float(parts[12]) if len(parts) > 12 else 0.0
                school   = _safe_int(parts[9]) or 1
                is_crit  = parts[13] == "1"
                spell_name = "Auto Attack"
            elif is_heal:
                # SPELL_HEAL / SPELL_PERIODIC_HEAL field layout (Warmane WotLK 3.3.5a):
                #   event,srcGUID,srcName,srcFlags,dstGUID,dstName,dstFlags,
                #   spellID,spellName,spellSchool, amount, overheal, absorbed, critical
                # → 14 fields (indices 0-13); critical at index 13
                #
                # parts[10] = amount   — gross heal (total cast, incl. overheal portion)
                # parts[11] = overheal — portion wasted because target was near/at full HP
                # parts[12] = absorbed — portion absorbed by absorb shields
                # parts[13] = critical — "1" or nil
                #
                # Effective heal (HP actually restored) = amount - overheal - absorbed
                # ≈ parts[10] - parts[11]  (parts[12] is 0 for player→player heals in practice)
                if len(parts) < 11:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                spell_name = parts[8].strip('"').strip()
                school     = _safe_int(parts[9]) or 2
                gross      = _safe_float(parts[10])
                overheal   = _safe_float(parts[11]) if len(parts) > 11 else 0.0
                amount     = max(0.0, gross - overheal)   # effective HP restored
                overkill   = 0.0
                absorbed   = 0.0
                is_crit    = len(parts) > 13 and parts[13] == "1"
            else:
                # All remaining events must be in DMG_EVENTS — defence-in-depth
                # guard against any unrecognised events slipping through.
                if event not in DMG_EVENTS:
                    continue
                # SPELL_DAMAGE / SPELL_PERIODIC_DAMAGE / RANGE_DAMAGE etc.
                # Fields: event,srcGUID,srcName,srcFlags,dstGUID,dstName,dstFlags,
                #   spellID,spellName,spellSchool,amount,overkill,school,resisted,blocked,absorbed,??,critical
                if len(parts) < 15:
                    continue
                src_guid, src_name = parts[1], parts[2].strip('"').strip()
                dst_guid, dst_name = parts[4], parts[5].strip('"').strip()
                spell_name = parts[8].strip('"').strip()
                school     = _safe_int(parts[9]) or 1
                amount     = _safe_float(parts[10])
                overkill   = _safe_float(parts[11])
                absorbed   = _safe_float(parts[15]) if len(parts) > 15 else 0.0
                is_crit    = len(parts) > 17 and parts[17] == "1"

            if amount <= 0:
                continue

            # Only count player sources as DPS/HPS
            if not _is_player(src_guid):
                # Remap pet/summon damage to owner if known
                if pet_owner and src_guid in pet_owner:
                    owner_guid, owner_name = pet_owner[src_guid]
                    src_guid = owner_guid
                    src_name = owner_name
                    # fall through to player accounting below
                else:
                    # Track damage taken by players from boss
                    if _is_player(dst_guid) and dst_name:
                        a = _get_actor(actors, dst_name, dst_guid)
                        a.damage_taken += amount
                    # Boss-mechanic heals (e.g. Blood-Queen vampiric bites):
                    # src is a non-player NPC but dst is a player. Count in
                    # encounter total_healing without attributing to any actor.
                    if is_heal and _is_player(dst_guid) and amount > 0:
                        boss_mechanic_healing += amount
                    continue

            if not src_name:
                continue

            # Skip player-to-player damage (Blood-Queen vampires, Pact of the
            # Darkfallen, Blood Mirror, etc.). These are not DPS against the boss.
            if not is_heal and _is_player(dst_guid):
                continue

            # Skip heals landing on non-player targets (pets, totems, etc.)
            # Skada uses flags_src (source filter only), but player-to-pet heals
            # are a negligible fraction of total and keeping the dst filter avoids
            # inflating totals with totem/pet heals most raiders don't expect to see.
            if is_heal and not _is_player(dst_guid):
                continue

            # Effective damage = amount - overkill - absorbed.
            # Overkill: damage past the target's remaining HP (wasted).
            # Absorbed: damage eaten by a boss shield (Lady DW mana barrier,
            # Saurfang blood barrier) — never reaches HP. UWU excludes both.
            # For heals, `amount` is already the effective value (gross - overheal),
            # computed above from parts[10] - parts[11].
            eff_amount = max(0.0, amount - overkill - absorbed) if not is_heal else amount

            a = _get_actor(actors, src_name, src_guid)
            ss = a.spells.setdefault(spell_name, SpellStats(school=school))

            # Detect class from spell name if not yet known
            if a.wow_class is None and spell_name in SPELL_CLASS_MAP:
                a.wow_class = SPELL_CLASS_MAP[spell_name]

            if is_heal:
                # Skip spells in Skada's ignored_spells.heal (Tables.lua).
                if spell_name in PASSIVE_HEAL_EXCLUSIONS:
                    continue
                a.total_healing += eff_amount
                ss.healing += eff_amount
            else:
                # For bosses with independent add waves (Lady Deathwhisper, BPC),
                # only count damage directed at the boss unit(s) — not adds.
                # For bosses where mechanic-unit damage counts (Marrowgar Bone
                # Spikes, Saurfang Blood Beasts), filter_add_damage=False so we
                # accumulate all damage regardless of target GUID.
                apply_boss_filter = bool(
                    boss_def and boss_def.filter_add_damage and boss_guids
                )
                if not apply_boss_filter or dst_guid in boss_guids:
                    a.total_damage += eff_amount
                    ss.damage += eff_amount
                targets_hit.add(dst_name)
                # Track damage by target mob for drill-down
                if dst_name:
                    ts = a.targets.setdefault(dst_name, TargetStats())
                    ts.damage += eff_amount
                    ts.hits   += 1
                    ts.crits  += int(is_crit)

            ss.hits  += 1
            ss.crits += int(is_crit)
            a.hit_count  += 1
            a.crit_count += int(is_crit)

        # Duration: for KILL use boss death time to avoid counting post-fight tail
        start_ts = parse_ts(first_ts_str)
        end_ts   = parse_ts(last_ts_str)
        if end_ts < start_ts:
            end_ts += 86400
        if outcome == "KILL" and boss_died_ts is not None:
            kill_ts = boss_died_ts
            if kill_ts < start_ts:
                kill_ts += 86400
            end_ts = kill_ts
        duration = max(1.0, end_ts - start_ts)

        # Build participant list
        participants = []
        for actor in actors.values():
            dps = actor.total_damage / duration
            hps = actor.total_healing / duration
            crit_pct = (actor.crit_count / actor.hit_count * 100) if actor.hit_count else 0.0
            spell_breakdown = {
                name: {
                    "damage":  s.damage,
                    "healing": s.healing,
                    "hits":    s.hits,
                    "crits":   s.crits,
                    "school":  s.school,
                }
                for name, s in actor.spells.items()
            }
            target_breakdown = {
                name: {"damage": t.damage, "hits": t.hits, "crits": t.crits}
                for name, t in actor.targets.items()
                if t.damage > 0
            }
            participants.append({
                "name":            actor.name,
                "class":           actor.wow_class,
                "totalDamage":     actor.total_damage,
                "totalHealing":    actor.total_healing,
                "damageTaken":     actor.damage_taken,
                "dps":             round(dps, 2),
                "hps":             round(hps, 2),
                "deaths":          actor.deaths,
                "critPct":         round(crit_pct, 1),
                "spellBreakdown":  spell_breakdown,
                "targetBreakdown": target_breakdown,
            })

        total_damage  = sum(a.total_damage  for a in actors.values())
        # Add boss-mechanic heals (e.g. vampiric bites sourced from Blood-Queen)
        # to the encounter healing total. These are not attributed to any actor.
        total_healing = sum(a.total_healing for a in actors.values()) + boss_mechanic_healing
        total_taken   = sum(a.damage_taken  for a in actors.values())

        # Discard false-positive segments: no player output AND very short
        # (pre-pull buffs / noise captured before first real pull)
        if total_damage == 0 and duration < 60:
            return None

        started_at = parse_ts_to_iso(first_ts_str, self.file_year)
        ended_at   = parse_ts_to_iso(last_ts_str,  self.file_year)

        fingerprint = _fingerprint(
            boss_name    = boss_def.name if boss_def else boss_name,
            difficulty   = difficulty,
            started_at   = started_at,
            participants = [p["name"] for p in participants],
        )

        return ParsedEncounter(
            boss_name         = boss_def.name if boss_def else boss_name,
            boss_def          = boss_def,
            boss_id           = boss_id,
            difficulty        = difficulty,
            group_size        = group_size,
            outcome           = outcome,
            duration_seconds  = duration,
            started_at        = started_at,
            ended_at          = ended_at,
            total_damage      = total_damage,
            total_healing     = total_healing,
            total_damage_taken= total_taken,
            fingerprint       = fingerprint,
            participants      = participants,
            raw_event_count   = len(segment),
        )

    def _infer_boss(
        self, segment: list[tuple[str, list[str], float]]
    ) -> tuple[Optional[str], Optional[int]]:
        """Count boss name occurrences in dst_name / src_name fields."""
        counts: dict[str, int] = {}
        bn = self._boss_name_set
        for _, parts, _ in segment:
            if parts[0] in (UNIT_DIED_EVENT,):
                continue
            for idx in (2, 5):
                if len(parts) > idx:
                    name = parts[idx].strip('"').strip()
                    if name.lower() in bn:
                        counts[name] = counts.get(name, 0) + 1
        if not counts:
            return None, None
        boss_name = max(counts, key=lambda k: counts[k])
        boss_def  = lookup_boss(boss_name)
        return (boss_def.name if boss_def else boss_name), (boss_def.wow_boss_id if boss_def else None)

    def _infer_difficulty(
        self, segment: list[tuple[str, list[str], float]]
    ) -> tuple[int, str]:
        """Estimate group size from unique player GUIDs."""
        players: set[str] = set()
        for _, parts, _ in segment:
            if len(parts) > 1 and _is_player(parts[1]):
                players.add(parts[1])
        n = len(players)
        if n <= 12:
            return 10, "10N"
        return 25, "25N"

    def _detect_heroic(self, segment: list[tuple[str, list[str], float]]) -> bool:
        """Return True if any heroic-only spell marker appears in the segment."""
        for _, parts, _ in segment:
            if parts[0] == "SWING_DAMAGE" or parts[0] == UNIT_DIED_EVENT:
                continue
            if len(parts) > 8:
                spell = parts[8].strip('"').strip().lower()
                if spell in HEROIC_SPELL_MARKERS:
                    return True
        return False

    def _infer_outcome(
        self, segment: list[tuple[str, list[str], float]], boss_name: Optional[str]
    ) -> str:
        """Heuristic: boss died = KILL, else WIPE.
        Special case: Valithria Dreamwalker is a healing encounter — she never
        dies on a successful attempt. A KILL is signalled by the combat trigger
        NPC dying when she reaches 100% HP."""
        if not boss_name:
            return "UNKNOWN"
        bn = boss_name.lower()

        # Valithria: "Green Dragon Combat Trigger" dying = KILL; Valithria dying = WIPE
        if "valithria" in bn:
            for _, parts, _ in segment:
                if parts[0] == UNIT_DIED_EVENT and len(parts) >= 6:
                    name = parts[5].strip('"').strip().lower()
                    if name == "valithria dreamwalker":
                        return "WIPE"
                    if "combat trigger" in name or "green dragon" in name:
                        return "KILL"
            return "WIPE"

        # Gunship Battle: ends via scripted ship destruction — no single boss UNIT_DIED.
        # KILL = any crew member died. Horde log: Skybreaker crew. Alliance log: Kor'kron crew.
        if "gunship" in bn:
            for _, parts, _ in segment:
                if parts[0] == UNIT_DIED_EVENT and len(parts) >= 6:
                    name = parts[5].strip('"').strip().lower()
                    if name in GUNSHIP_CREW_NAMES:
                        return "KILL"
            return "WIPE"

        for _, parts, _ in segment:
            if parts[0] == UNIT_DIED_EVENT and len(parts) >= 6:
                name = parts[5].strip('"').strip().lower()
                if name == bn or name in self._boss_name_set:
                    return "KILL"
        return "WIPE"


# ── Helpers ────────────────────────────────────────────────────────

def _safe_int(s: str) -> int:
    try:
        return int(s.strip(), 0)
    except (ValueError, TypeError):
        return 0


def _safe_float(s: str) -> float:
    try:
        v = float(s.strip())
        return max(0.0, v)
    except (ValueError, TypeError):
        return 0.0


def _is_player(guid: str) -> bool:
    """Return True if GUID belongs to a player character."""
    if not guid:
        return False
    g = guid.upper()
    # Null / empty GUIDs
    if g in ("0X0000000000000000", "0XNIL", "NIL"):
        return False
    # Retail/modern format: "Player-NNNN-XXXXXXXX"
    if g.startswith("PLAYER-"):
        return True
    if not g.startswith("0X"):
        return False
    hex_part = g[2:]  # up to 16 hex chars
    if len(hex_part) < 2:
        return False
    high_byte = hex_part[:2]  # first two hex chars = highest byte
    # Warmane/private-server WotLK: player GUIDs start with 0x06
    if high_byte == "06":
        return True
    # Standard WotLK: type nibble at hex_part[3]; Player = 4
    if len(hex_part) >= 4:
        nibble = hex_part[3]
        if nibble in "0123456789ABCDEF":
            return int(nibble, 16) == 4
    return False


def _get_actor(actors: dict[str, ActorStats], name: str, guid: str) -> ActorStats:
    if name not in actors:
        actors[name] = ActorStats(name=name, guids={guid})
    else:
        actors[name].guids.add(guid)
    return actors[name]


def _decode_difficulty(diff_id: int, group_size: int) -> str:
    """Map WoW difficultyID to our label."""
    # WotLK: 3=10N, 4=25N, 5=10H, 6=25H
    mapping = {3: "10N", 4: "25N", 5: "10H", 6: "25H"}
    if diff_id in mapping:
        return mapping[diff_id]
    # Fallback by group size
    return "25N" if group_size >= 20 else "10N"


def _fingerprint(
    boss_name: str, difficulty: str, started_at: str, participants: list[str]
) -> str:
    """
    Deterministic SHA-256 fingerprint for deduplication.
    Uses boss name + difficulty + ISO week + sorted participant names.
    """
    # Round to nearest minute to tolerate small time offsets
    try:
        dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        # Truncate to nearest 5 minutes
        minute_block = (dt.hour * 60 + dt.minute) // 5
        week = dt.isocalendar()
        time_key = f"{week[0]}-W{week[1]}-{week[2]}-{minute_block}"
    except Exception:
        time_key = started_at[:16]

    sorted_names = "|".join(sorted(participants[:25]))  # top 25 is enough
    raw = f"{boss_name.lower()}|{difficulty}|{time_key}|{sorted_names}"
    return hashlib.sha256(raw.encode()).hexdigest()
