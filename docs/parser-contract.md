# Pizza Logs Parser Contract

This document defines exactly how Pizza Logs parses WoW combat logs. Every
decision in this document is grounded in Skada-WoTLK source code or directly
observed Warmane server behavior.

**Skada-WoTLK source:** https://github.com/bkader/Skada-WoTLK  
**Key Skada files:**
- `Skada/Modules/Damage.lua` — damage events tracked
- `Skada/Modules/Healing.lua` — healing events tracked, effective heal formula
- `Skada/Core/Tables.lua` — spell exclusion lists (none for healing)
- `Skada/Core/Functions.lua` — event suffix/field index definitions

---

## Accepted File Format

- File: `WoWCombatLog.txt`  
- Encoding: UTF-8 (or ASCII)  
- Line format: `M/D HH:MM:SS.mmm  EVENT_TYPE,field1,field2,...`  
  (two spaces between timestamp and event type)  
- Supported server: Warmane (WotLK 3.3.5a private server)
- Supported expansion: Wrath of the Lich King 3.3.5a
- Max file size: no hard limit; parser streams line-by-line

---

## Encounter Segmentation

### Primary path: ENCOUNTER_START / ENCOUNTER_END

If the file contains `ENCOUNTER_START` events, the parser uses them as authoritative
encounter boundaries. All `DMG_EVENTS`, `HEAL_EVENTS`, and `UNIT_DIED` events
between START and END are collected for the encounter.

ENCOUNTER_START fields: `[0]=ENCOUNTER_START [1]=bossId [2]=bossName [3]=difficultyID [4]=groupSize`  
ENCOUNTER_END fields: `[0]=ENCOUNTER_END [1]=bossId [2]=bossName [3]=difficultyID [4]=groupSize [5]=success`

### Fallback path: heuristic name detection

If no ENCOUNTER_START is present, the parser anchors on boss-name events: any
event where `src_name` or `dst_name` matches a known boss or alias. A 30-second
inactivity window closes the encounter.

### Minimum event floor

Heuristic segments with fewer than 10 events are discarded as noise (trash,
pre-pull). Explicit `ENCOUNTER_START` / `ENCOUNTER_END` marker windows are
trusted even when short, so partial logs and very quick wipes can still produce
an encounter.

---

## Boss Pull Start

- ENCOUNTER_START path: timestamp of the ENCOUNTER_START line
- Heuristic path: timestamp of the first boss-name event

---

## Boss End

- ENCOUNTER_END path: timestamp of the ENCOUNTER_END line
- Heuristic path: timestamp of the last event within the 30s window

---

## Wipe Rules

- ENCOUNTER_END with `success=0` → WIPE
- Heuristic path: no boss UNIT_DIED event found → WIPE
- **Exception: Gunship Battle** — see below

## Kill Rules

- ENCOUNTER_END with `success=1` → KILL
- Heuristic path: boss UNIT_DIED event found → KILL
- **Exception: Gunship Battle** — ENCOUNTER_END always emits success=0 on Warmane.
  KILL override: any `GUNSHIP_CREW_NAMES` member dies inside the encounter window.
  See `parser_core.py::GUNSHIP_CREW_NAMES` for the full crew list.
- **Exception: Valithria Dreamwalker** (healing encounter):
  - KILL: "Green Dragon Combat Trigger" or "Combat Trigger" dies
  - WIPE: "Valithria Dreamwalker" dies

---

## Difficulty Detection

### Step 1: ENCOUNTER_START difficultyID

| difficultyID | Result |
|---|---|
| 3 | 10N |
| 4 | 25N |
| 5 | 10H |
| 6 | 25H |

Warmane may emit difficultyID=4 (25N) for heroic runs. Proceed to Step 2.

### Step 2: Heroic spell markers (applied even when ENCOUNTER_START present)

If any of the following spell names appear in the segment AND difficulty is currently
`10N` or `25N`, upgrade to `10H` or `25H`:

| Spell | Boss | Source |
|---|---|---|
| Bone Slice | Lord Marrowgar (ICC) | Skada — heroic-only multi-target cleave |
| Rune of Blood | Deathbringer Saurfang (ICC) | Skada — heroic-only debuff |
| Pact of the Darkfallen | Blood-Queen Lana'thel (ICC) | Skada — heroic-only group link |
| Unbound Plague | Professor Putricide (ICC) | Skada — heroic-only spreading debuff |

**Excluded markers** (appear in 10N on Warmane, cannot be used as heroic indicators):
- Backlash (Sindragosa)
- Empowered Shock Vortex / Empowered Shadow Lance / Empowered Blood (Blood Prince Council)

### Step 3: Session normalization

- Gunship Battle: can inherit session heroic difficulty because Warmane provides
  no reliable Gunship-only heroic marker.
- Non-Gunship `25N` attempts are not promoted solely because another pull in the
  same session was heroic. This prevents heroic wipes followed by a normal kill
  from being bucketed under heroic.
- Sindragosa and Blood Prince Council without direct heroic evidence remain
  normal because their ambiguous Warmane spells also appear in 10N.

---

## Damage Rules

### Tracked events (per Skada `Damage.lua` RegisterForCL)

```
SPELL_DAMAGE
SWING_DAMAGE
RANGE_DAMAGE
SPELL_PERIODIC_DAMAGE
DAMAGE_SHIELD          # Thorns / Retribution Aura reflect
DAMAGE_SPLIT           # Shared-damage mechanics
SPELL_BUILDING_DAMAGE  # Gunship cannons
```

### Field layout

**SPELL_DAMAGE / RANGE_DAMAGE / SPELL_PERIODIC_DAMAGE / DAMAGE_SHIELD / DAMAGE_SPLIT:**
```
parts[10] = amount
parts[11] = overkill
parts[15] = absorbed
```
Stored encounter damage = `max(0, amount - overkill - absorbed)`.
Full-session `sessionDamage` uses `amount + absorbed`.

**SWING_DAMAGE** (no spell fields — indices shift by 3):
```
parts[7] = amount
parts[8] = overkill
parts[12] = absorbed
```
Stored encounter damage = `max(0, amount - overkill - absorbed)`.
Full-session `sessionDamage` uses `amount + absorbed`.

### Add-wave filtering

Bosses with `filter_add_damage=True` in `bosses.py`:
- **Lady Deathwhisper**: only damage to boss GUID counted (not Adherents/Fanatics)
- **Blood Prince Council**: only damage to boss GUID counted (not Kinetic Bombs)

All other bosses: all damage counts (Marrowgar Bone Spikes, Saurfang Blood Beasts, etc.)

---

## Healing Rules

### Tracked events (per Skada `Healing.lua` RegisterForCL)

```
SPELL_HEAL
SPELL_PERIODIC_HEAL
```
`SPELL_HEAL_ABSORBED` is NOT tracked (Skada does not register it for healing done).

### Field layout (per Skada: `HEAL = "amount, overheal, absorbed, critical"`)

```
parts[10] = gross heal   (total cast amount)
parts[11] = overheal     (wasted — target near full HP)
parts[12] = absorbed     (absorbed by shields — NOT added to healing total)
parts[13] = critical     ("1" or "nil")
```
Effective heal = `max(0, parts[10] - parts[11])`

### Exclusions

None. `Tables.lua` has no `ignored_spells.heal` entry. Every SPELL_HEAL counts:
- Judgement of Light: INCLUDED
- Vampiric Embrace: INCLUDED
- Improved Leader of the Pack: INCLUDED

---

## Overheal Rules

Overhealing = `parts[11]` from SPELL_HEAL / SPELL_PERIODIC_HEAL.  
Currently tracked per-spell in `spellBreakdown` but not separately surfaced in the UI.

---

## Absorbs Rules

**Not currently tracked.** Skada tracks `Power Word: Shield` and other absorbs in a
separate module (`actor.absorb`) distinct from healing. This is a known gap.  
Affected events: `SPELL_AURA_APPLIED` (shield application) + tracking absorbed amounts
from `parts[12]` of SPELL_HEAL events.

---

## Pet Merge Rules

1. **SPELL_SUMMON tracking**: global map `pet_guid → (owner_guid, owner_name)` built
   during segmentation. Covers pets summoned during the fight.

2. **Pre-summoned pet detection**: scans `SPELL_HEAL` / `SPELL_PERIODIC_HEAL` events
   where `src = player` and `dst_guid` has prefix `0xF14*` with flags `0x1100`
   (TYPE_PET | CONTROL_PLAYER). Covers pets summoned before the first logged event.

3. **Remapping**: if `src_guid` is not a player but exists in the pet_owner map,
   all damage/healing from that GUID is attributed to the owner.

4. **Vehicles excluded**: GUIDs with prefix `0xF15*` (Gunship Cannons) are never
   treated as pets. Vehicle damage is tracked separately in `sessionDamage`.

---

## Player Identity Rules

A GUID is considered a player if it matches any of:
- Retail format: starts with `"Player-"`
- Warmane 3.3.5: starts with `"0x06"`
- Standard WotLK: `guid[4]` nibble = `4` (TYPE_PLAYER)

---

## Duration Rules

- **KILL**: duration = `boss_died_ts - first_boss_event_ts`
  (uses `UNIT_DIED` timestamp of boss, not last event in segment — excludes post-kill tail)
- **WIPE/UNKNOWN**: duration = last event timestamp - first event timestamp

---

## DPS / HPS Calculation

- `dps = total_damage / duration_seconds`
- `hps = total_healing / duration_seconds`
- Duration source: see Duration Rules above

---

## Ignored / Excluded Events

| Event type | Reason |
|---|---|
| SWING_MISSED, SPELL_MISSED, etc. | Contribute 0 damage; tracked by Skada for miss-rate only |
| ENVIRONMENTAL_DAMAGE | Not registered by Skada for damage done |
| SPELL_AURA_APPLIED/REMOVED | Not damage or healing |
| SPELL_CAST_START/SUCCESS | Not damage or healing |
| Vehicle damage (0xF15* src GUID) | Tracked in sessionDamage only, not per-player |

---

## Known Limitations

1. **Heroic difficulty on Warmane**: Warmane emits difficultyID=4 (25N) for heroic runs;
   the heroic spell marker approach is the only reliable upgrade path.
2. **Gunship Battle**: Warmane always emits success=0 for Gunship; crew death override
   is required.
3. **Difficulty undetectable cases**: Sindragosa, Blood Prince Council (heroic markers
   removed due to Warmane 10N false positives); absent direct evidence they stay
   normal rather than inheriting heroic from another pull.
4. **Absorbs not tracked**: PW:S and other absorb shields not yet implemented.
5. **Post-death events**: Some servers log damage/heal events after player/boss death;
   not explicitly filtered (negligible impact on totals).
6. **Role detection**: Simplified heuristic (healing ratio > 60% = HEALER). Not spec-based.
7. **Overkill not surfaced**: Tracked internally but not displayed separately in UI.
8. **No ENCOUNTER_START on all Warmane bosses**: Not all Warmane bosses emit these;
   heuristic path is used as fallback throughout.
9. **Malformed-line reporting is aggregate only**: uploads surface counts of malformed
   lines as warnings, not every skipped line.

---

## Values Expected to Match Skada Closely

- Total healing (effective heal = gross - overheal, no spell exclusions)
- Stored encounter damage uses the Skada damage event set, then excludes overkill
  and absorbed shield damage for Pizza Logs leaderboard stability.
- DPS (same encounter duration rule: boss death timestamp for kills)
- HPS (same rule)
- Pet attribution (owner gets credit)

## Values That May Differ from uwu-logs

- **Total damage**: uwu-logs may not subtract overkill; encounter boundaries may differ
- **Encounter duration**: uwu-logs window algorithm differs from our 30s heuristic
- **DPS**: derived from duration, so inherits boundary differences

---

## Debug Mode

POST to `/parse-debug` on the parser service to get per-encounter debug metadata
alongside normal parse results. Returns `DebugInfo` per encounter with:
- `difficultyMethod` — "encounter_start" or "heuristic"
- `difficultyRaw` / `difficultyFinal` — before and after heroic upgrade
- `heroicMarkersFound` — which spell names triggered the upgrade
- `outcomeMethod` / `outcomeEvidence` — how KILL/WIPE was determined
- `actorCount`, `bossGuidCount` — aggregation stats
- `parserWarnings` — any low-confidence warnings

Not exposed in the public UI. For developer/admin use via direct API call.
