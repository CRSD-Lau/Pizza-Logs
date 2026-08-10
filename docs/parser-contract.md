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
- Browser formats: `.txt`, `.log`, and `.zip` (case-insensitive)
- Primary compressed upload limit: 100 MiB; selected/total uncompressed limit: 1 GiB
- ZIP members are streamed without filesystem extraction

---

## Encounter Segmentation

### Primary path: ENCOUNTER_START / ENCOUNTER_END

If the file contains `ENCOUNTER_START` events, the parser uses them as authoritative
encounter boundaries. Every parsed combat event between START and END is retained
so aura/cast difficulty evidence is available alongside damage, healing, and death.

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

Difficulty is classified independently for each already-segmented attempt by
`pizza-difficulty-v2`. The detector aggregates every relevant boss-specific
spell ID, returns `UNKNOWN` for conflicts or unsupported evidence, and never
defaults an unmapped boss to Normal. Valid `ENCOUNTER_START` modes are a fallback
only for boss/mode pairs represented by the supported mapping. Gunship and other
attempts do not inherit difficulty from another pull or session.

The auditable result schema, full spell-map structure, Ulduar special rules,
unsupported Hodir/Sartharion cases, ranking protection, and tests are documented
in `docs/difficulty-detector.md`.

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
Headline encounter and full-session Total Damage = `max(0, amount)`.
Useful/effective damage remains a separate formula: `max(0, amount - overkill - absorbed)`.

**SWING_DAMAGE** (no spell fields — indices shift by 3):
```
parts[7] = amount
parts[8] = overkill
parts[12] = absorbed
```
Headline encounter and full-session Total Damage = `max(0, amount)`.
Useful/effective damage remains a separate formula: `max(0, amount - overkill - absorbed)`.

### Pull totals and target breakdowns

Encounter damage includes every matched target inside the bounded boss pull,
including Lady Deathwhisper adds and Blood Prince Council mechanics. This
matches the headline UwU report total. Boss-only and per-target damage remain
available as analytical breakdowns and must not silently replace the encounter
total.

Damage taken intentionally uses the raw incoming `amount` field. It does not
subtract overkill or absorbs because UwU's headline taken metric records the
reported incoming amount.

### Full-session Custom Slice

Each session persists one report grain from its first parsed log event to its
last. It includes boss pulls, wipes, trash, between-pull events, and downtime.
The stored `sessionAnalytics` object contains raw Total Damage, effective
healing, attributed absorbs, combined Heal, raw Damage Taken, exact millisecond
duration, and the same columns per player. Pets with evidence-based ownership
are credited to their owner; unresolved non-player actors are excluded, as in
UwU's `add_pets` report pass. Legacy `sessionDamage` remains as a compatibility
alias for the session Total Damage value.

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

Absorbs are tracked separately from healing, matching Skada's `actor.absorb`
concept. For damage events landing on a player, the parser reads the event's
numeric `absorbed` field and looks for active supported shield auras on that
target.

- One active shield: attribute the absorb to that shield's player source.
- Multiple active shields: attribute to the newest active shield and increment
  `ambiguousHits` so the uncertainty is visible.
- A shield removed no more than 0.5 seconds before the damage event remains
  eligible, covering combat-log ordering around shield consumption.
- Critical Discipline heals and Penance can establish a Divine Aegis source;
  the absorbed amount still comes only from the damage event.
- No supported active shield or non-player shield source: add the amount to the
  encounter's `unattributedAbsorbs`; do not guess a player.
- `SPELL_HEAL_ABSORBED` remains excluded from healing and absorb-shield totals.
- Fully absorbed `*_MISSED` events without a numeric amount cannot be quantified.

Per-participant output includes `totalAbsorbs`, `aps`, and
`absorbBreakdown`. Encounter output includes `totalAbsorbs` and
`unattributedAbsorbs`.

The UI presents effective healing, absorbs, and their rates independently. It
also provides an explicitly labeled `healing + absorbs` / `H+A PS` view for
direct UwU report comparison; the combined view does not mutate stored healing.

---

## Analytical Enrichment

- `spec` is inferred only from observed WotLK spell signatures. Tied or absent
  evidence returns no spec.
- `role` combines inferred spec, healing share, damage output, and damage taken.
  Healer/tank labels require positive supporting combat evidence.
- `auraBreakdown` records application count, observed uptime seconds, and uptime
  percentage. Open auras close at the encounter end.
- `consumableBreakdown` is the curated flask/elixir/food/potion subset of aura
  uptime.
- `powerBreakdown` records `SPELL_ENERGIZE` and
  `SPELL_PERIODIC_ENERGIZE` gains by recipient, spell, event count, and power type.
- `deathEvents` records the encounter offset and up to the prior 15 seconds of
  observed incoming damage. Damage/healing totals are not changed by these
  enrichment paths.

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
   treated as pets. Vehicle damage is excluded from player/session totals.

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
| SPELL_AURA_APPLIED/REFRESH/REMOVED | Analytical aura/absorb evidence only; never damage or healing |
| SPELL_CAST_START/SUCCESS | Not damage or healing |
| Vehicle damage (0xF15* src GUID) | Excluded from player/session totals |

---

## Known Limitations

1. **Difficulty evidence on Warmane**: encounter IDs may be misleading. Boss-scoped
   spell ranks override marker fallback; absent or conflicting evidence is `UNKNOWN`.
2. **Gunship Battle**: Warmane always emits success=0 for Gunship; crew death override
   is required.
3. **Difficulty undetectable cases**: unsupported or ambiguous attempts remain
   `UNKNOWN`; Hodir Hard Mode and Sartharion drake modes are explicitly unsupported.
4. **Absorb attribution**: Numeric absorbed damage is tracked, but fully absorbed
   missed events without an amount remain unmeasurable. Concurrent shields are
   marked ambiguous rather than presented as exact.
5. **Post-death events**: Some servers log damage/heal events after player/boss death;
   not explicitly filtered (negligible impact on totals).
6. **Spec/role evidence**: Classification is signature-based and deliberately
   conservative. Unobserved cooldowns or hybrid off-role play can remain unknown.
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
- `difficultyRaw` / `difficultyFinal` — encounter marker fallback and final mode
- `difficultyConfidence`, `difficultyEvidence`, `difficultyReason`, `detectorVersion`
  — the auditable v2 detector result
- `heroicMarkersFound` — legacy-compatible evidence list
- `outcomeMethod` / `outcomeEvidence` — how KILL/WIPE was determined
- `actorCount`, `bossGuidCount` — aggregation stats
- `parserWarnings` — any low-confidence warnings

Not exposed in the public UI. For developer/admin use via direct API call.
