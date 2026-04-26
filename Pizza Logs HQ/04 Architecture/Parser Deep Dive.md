# Parser Deep Dive

> Source of truth for how parser_core.py interprets WoW combat logs.
> All field layouts verified against **Skada-WoTLK** source (https://github.com/bkader/Skada-WoTLK).

---

## WoW Combat Log Format (WotLK / Warmane 3.3.5a)

### Line Structure
```
M/D HH:MM:SS.mmm  EVENT,field1,field2,...fieldN
```
Double-space separates timestamp from CSV payload. No year in timestamp — inferred from file mtime or current year.

### Common Events and Field Layouts

**SPELL_DAMAGE / RANGE_DAMAGE / SPELL_PERIODIC_DAMAGE / DAMAGE_SHIELD / DAMAGE_SPLIT / SPELL_BUILDING_DAMAGE**

Skada suffix: `"amount, overkill, school, resisted, blocked, absorbed, critical, glancing, crushing"`

```
[0]  event
[1]  srcGUID   [2]  srcName   [3]  srcFlags
[4]  dstGUID   [5]  dstName   [6]  dstFlags
[7]  spellID   [8]  spellName [9]  spellSchool
[10] amount    [11] overkill  [12] school
[13] resisted  [14] blocked   [15] absorbed
[16] critical  [17] glancing  [18] crushing
Effective damage = max(0, amount - overkill - absorbed)
```

**SWING_DAMAGE** (no spell fields — indices shift by 3)

Skada suffix: same damage suffix, no spell prefix
```
[0]  event
[1]  srcGUID   [2]  srcName   [3]  srcFlags
[4]  dstGUID   [5]  dstName   [6]  dstFlags
[7]  amount    [8]  overkill  [9]  school
[10] resisted  [11] blocked   [12] absorbed
[13] critical  [14] glancing  [15] crushing
spell_name hardcoded to "Auto Attack"
```

**SPELL_HEAL / SPELL_PERIODIC_HEAL**

Skada suffix: `"amount, overheal, absorbed, critical"`
```
[0]  event
[1]  srcGUID   [2]  srcName   [3]  srcFlags
[4]  dstGUID   [5]  dstName   [6]  dstFlags
[7]  spellID   [8]  spellName [9]  spellSchool
[10] amount    — gross heal (total cast, including overheal portion)
[11] overheal  — wasted portion (target near/at full HP)
[12] absorbed  — absorbed by shields (usually 0 for player→player)
[13] critical  — "1" or "nil"
Effective heal = max(0, parts[10] - parts[11])
```

**UNIT_DIED**
```
[0] event
[1] srcGUID  [2] srcName  [3] srcFlags
[4] dstGUID  [5] dstName  [6] dstFlags
```

**ENCOUNTER_START** (NOT present on Warmane — only appears on retail/some servers)
```
[0] event  [1] bossId  [2] bossName  [3] difficultyId  [4] groupSize
```

### GUID Formats
- **Player (Warmane)**: `0x0600000000XXXXXX` — high byte `0x06`
- **Player (retail/modern)**: `Player-NNNN-XXXXXXXX`
- **NPC/Boss**: `0x0300000000XXXXXX` — high byte `0x03`
- **Pet/Guardian**: has `TYPE_PET (0x1000)` or `TYPE_GUARDIAN (0x2000)` + `CONTROL_PLAYER (0x0100)` flags
- **Vehicle (Gunship cannons)**: `0xF150*` — excluded from `is_pet` check
- **Null**: `0x0000000000000000`

### Difficulty IDs (ENCOUNTER_START only)
```
3 = 10N,  4 = 25N,  5 = 10H,  6 = 25H
```
Without ENCOUNTER_START: estimate from unique player GUID count (≤12 = 10N, >12 = 25N).
**Heroic detection is impossible** without ENCOUNTER_START on Warmane.

---

## Event Sets

### DMG_EVENTS (source: Skada `Damage.lua` RegisterForCL)
```python
DMG_EVENTS = {
    "SPELL_DAMAGE",
    "SWING_DAMAGE",
    "RANGE_DAMAGE",
    "SPELL_PERIODIC_DAMAGE",
    "DAMAGE_SHIELD",          # Thorns / Retribution Aura reflect
    "DAMAGE_SPLIT",           # Shared-damage mechanics
    "SPELL_BUILDING_DAMAGE",  # Gunship cannons, building fire
}
# MISSED events (SWING_MISSED, SPELL_MISSED etc.) = 0 damage, not tracked for DPS
```

### HEAL_EVENTS (source: Skada `Healing.lua` RegisterForCL)
```python
HEAL_EVENTS = {
    "SPELL_HEAL",
    "SPELL_PERIODIC_HEAL",
}
# SPELL_HEAL_ABSORBED is NOT registered by Skada and has different field structure
```

### Heal Exclusions (source: Skada `Tables.lua`)
`Tables.lua` has **no `ignored_spells.heal` table** — Skada excludes nothing from healing done.
`PASSIVE_HEAL_EXCLUSIONS = frozenset()` — every SPELL_HEAL / SPELL_PERIODIC_HEAL counts.

---

## Segmentation Logic (heuristic path)

```python
ENCOUNTER_GAP_SECONDS = 30   # gap with no boss events = fight over
MIN_ENCOUNTER_EVENTS  = 10   # below this = discard (noise)
```

For each line in the log:
1. If event not in DMG/HEAL/UNIT_DIED → skip
2. Check if src or dst name is in `ALL_BOSS_NAMES` (set lookup, cached at init)
3. If boss event and not currently in fight → start new segment
4. If in fight: any event within 30s of last boss event → append to segment
5. If >30s gap → close segment, check min size, start new if this line is boss

Post-fight tail: up to 30s of heals/buffs/deaths get included. For KILLs, duration uses boss death timestamp, not tail end.

---

## Aggregation Logic

### Boss Detection
Count occurrences of known boss names in src/dst fields → most frequent = boss.

### Outcome Detection
- Scan UNIT_DIED events
- If `dst_name.lower() == boss_name.lower()` → KILL
- Valithria special case: KILL if "Green Dragon Combat Trigger" or "combat trigger" dies
- No UNIT_DIED on boss → WIPE

### Duration
```python
# For KILL: use boss death timestamp (UNIT_DIED on boss)
# For WIPE: use last event in segment
duration = boss_died_ts - seg_start   # float seconds
```

### Fingerprint
```python
SHA-256(f"{boss_name}|{difficulty}|{week}-{day}-{5min_block}|{sorted_player_names}")
```
5-minute block tolerates small clock differences between uploads.

### Session Splitting
Encounters with >60 min gap = new sessionIndex (`_assign_session_indices(gap_seconds=3600)`).

---

## Pet / Owner Attribution

- `SPELL_SUMMON` events → build `pet_guid → (owner_guid, owner_name)` map
- At aggregation time, pet damage is attributed to owner
- Vehicle GUIDs (`0xF15*`) are excluded — Gunship cannons look like player-controlled pets but aren't

---

## Known Edge Cases

| Boss | Issue | Fix |
|---|---|---|
| Valithria Dreamwalker | Never UNIT_DIED on kill | Detect "Green Dragon Combat Trigger" death |
| Gunship Battle | Cannot separate from Saurfang pre-pull | Undetectable without ENCOUNTER_START — accepted |
| Four Horsemen | 4 boss entities | All 4 names in aliases list |
| Assembly of Iron | 3 bosses (Steelbreaker/Molgeim/Brundir) | All in aliases |
| Blood Prince Council | 3 princes | All in aliases |
| Northrend Beasts | 4 entities (Gormok/Icehowl/Acidmaw/Dreadscale) | All in aliases |
| Lady Deathwhisper P1 | Mana barrier absorbs all damage | `filter_add_damage=True` + `absorbed` subtracted |
| Pre-pull noise | 0 damage, very short | Filter: `total_damage == 0 and duration < 60` |

---

## Performance Notes

| Optimization | What changed | Impact |
|---|---|---|
| `csv_split` | Python char loop → C csv module | ~20x faster line parsing |
| `_boss_names` | Property re-import → cached instance var | Eliminates millions of redundant calls |
| DB writes | 950 sequential queries → ~15 batched/parallel | Major DB write speedup |
| SSE progress | Reports every 50k lines during parse | Real progress bar in browser |
| KILL duration | Boss death timestamp vs last event | Eliminates 30s post-fight DPS penalty |
