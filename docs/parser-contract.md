# Parser Contract

This document is the authoritative behavioral contract for Pizza Logs parsing. Tests and fixtures enforce it; presentation code must not silently redefine these metrics.

## Authority and Scope

- Primary input: Warmane/WotLK 3.3.5a `WoWCombatLog.txt` data.
- Skada-WoTLK defines the supported damage/healing event sets and effective-healing primitive.
- UwU-style views may be adopted as explicit analytical layers; they do not replace stored primitives.
- Missing, contradictory, or unsupported evidence remains `UNKNOWN`, ambiguous, or unattributed.

## Input and Identity

Combat lines are parsed as bounded CSV-like records. Malformed lines are counted/skipped and surfaced as aggregate warnings rather than crashing the upload.

Player GUIDs include:

- Warmane values beginning `0x06`;
- retail-style `Player-` values;
- compatible WotLK player-flag GUIDs.

Vehicle sources such as Gunship cannon GUIDs are not credited as player pets.

## Encounter Segmentation

Useful `ENCOUNTER_START`/`ENCOUNTER_END` markers are consumed when present, but Warmane frequently omits or misreports them. Heuristic segmentation therefore remains required.

- Boss aliases/GUIDs identify relevant activity.
- A pull begins from normalized boss engagement evidence.
- The encounter window ends at the last boss-destination event, not a boss outgoing attack, stale marker, or unrelated post-fight trash.
- A kill ends at the boss `UNIT_DIED` timestamp.
- Lich King scripted finale/roleplay remains part of the same successful attempt.
- Gunship uses the fixture-protected Warmane crew-death success override.

## Damage

Tracked events match Skada `Damage.lua`:

```text
SPELL_DAMAGE
SWING_DAMAGE
RANGE_DAMAGE
SPELL_PERIODIC_DAMAGE
DAMAGE_SHIELD
DAMAGE_SPLIT
SPELL_BUILDING_DAMAGE
```

For spell/range events, the raw amount is the event damage field. `SWING_DAMAGE` has shifted indexes because it has no spell fields:

```text
parts[7]  amount
parts[8]  overkill
parts[12] absorbed
parts[13] critical
```

Headline encounter damage, participant damage, session Total Damage, and damage taken use the raw reported amount. Overkill and absorbed metadata may support separate useful/effective analysis but are not silently subtracted from the headline.

Damage includes every matched encounter destination, including adds/mechanics. Boss-only and target breakdowns are supplemental views.

Missed and environmental events do not add outgoing damage because they are outside the adopted Skada damage-done set or have no numeric damage amount.

## Healing

Tracked events match Skada `Healing.lua`:

```text
SPELL_HEAL
SPELL_PERIODIC_HEAL
```

Field layout:

```text
parts[10] gross amount
parts[11] overheal
parts[12] absorbed metadata
parts[13] critical
```

Effective healing is:

```text
max(0, gross - overheal)
```

Every tracked heal counts; there is no invented ignored-heal list. `SPELL_HEAL_ABSORBED` is not healing done.

## Absorbs

Absorbs remain separate from effective healing. Numeric absorbed amounts come from incoming damage events and are attributed only when supported shield-aura/source evidence exists.

- One supported active shield: attribute to its player source.
- Multiple supported shields: choose the newest eligible evidence and mark the hit ambiguous.
- A just-removed shield remains eligible for 0.5 seconds to cover combat-log ordering.
- Discipline critical-heal/Penance evidence may identify Divine Aegis ownership.
- Missing/non-player evidence remains in `unattributedAbsorbs`.
- Fully absorbed missed events without a numeric amount cannot be measured.

Participant output keeps `totalHealing`, `totalAbsorbs`, HPS, and APS separate. The explicitly labeled UwU-compatible `Heal`/`H+A PS` view equals effective healing plus attributed absorbs.

## Duration and Rates

- KILL: boss death minus pull start.
- WIPE/UNKNOWN: validated encounter end minus pull start.
- `dps = totalDamage / durationSeconds`
- `hps = totalHealing / durationSeconds`
- `aps = totalAbsorbs / durationSeconds`

Millisecond duration is preserved where available; display seconds are derived consistently.

## Difficulty and Outcome

Difficulty is classified independently per segmented attempt:

1. aggregate boss-specific spell-rank evidence;
2. accept one unambiguous mode;
3. return `UNKNOWN` on conflict;
4. apply explicit Ulduar encounter rules;
5. use valid marker mode only as a documented supported fallback;
6. otherwise remain `UNKNOWN`.

Raid size alone does not imply Normal. Unsupported Hodir Hard Mode and Sartharion drake modes remain `UNKNOWN`. See [difficulty-detector.md](difficulty-detector.md).

An apparent kill with unknown difficulty is retained as an attempt but not ranked as a valid kill.

## Pet Ownership

`SPELL_SUMMON` and owner-exclusive spell evidence establish ownership. Once proven, stable creature identity may propagate ownership across repeated Warmane GUID instances. Generic player-to-pet healing is insufficient and must never steal ownership. Vehicle sources are excluded.

## Analytical Enrichment

- Spec is inferred only from observed WotLK spell signatures; ties/absence remain unknown.
- Role uses spec, healing share, output, and damage-taken evidence; weak evidence is not upgraded to certainty.
- Aura uptime records applications, observed seconds, and encounter percentage.
- Consumables are a curated subset of aura data.
- Power gains record energize amount/events/type by recipient and spell.
- Death events record the death offset and up to 15 seconds of prior observed incoming damage.

These paths do not alter damage/healing primitives.

## Session Analytics

Each parsed raid session stores one first-to-last-log-event Custom Slice including wipes, trash, and downtime. Total Damage, Heal, Damage Taken, and every per-player rate in that slice use the same duration.

Session `Heal` is explicitly effective healing plus attributed absorbs. Encounter primitives remain separate.

## Deduplication

- File duplicate: SHA-256 of the complete received bytes.
- Encounter duplicate: SHA-256 over boss, difficulty, exact normalized pull start, and sorted participant names.

Exact starts prevent same-roster back-to-back pulls from colliding while remaining deterministic across copies of one pull.

## Parser HTTP Surface

The production web path uses `POST /uploads/{uuid}/stream`, with archive/resource validation and a bounded worker pool. The final payload includes the parser-observed byte count and is Zod-validated by the web service.

Legacy `/parse`, `/parse-debug`, and `/parse-stream` routes are disabled by default and are not used by public uploads. Arbitrary filesystem parsing is not supported.

## Regression Gates

- `parser/tests/test_parser_core.py` — focused behavioral rules
- `parser/tests/test_fixtures.py` — canonical fixture expectations
- `parser/tests/test_difficulty_detector.py` — detector matrix and conflicts
- `parser/tests/test_archive_upload.py` — archive/resource safety
- `parser/tests/test_parser_service.py` — HTTP/default-off legacy boundary
- `parser/tests/baselines/` — frozen analytical output
- `parser/tests/test_uwu_parity_baseline.py` — external acceptance baseline

Any behavior change needs focused evidence or a fixture plus the full parser suite. Historic database rows are not reparsed automatically.
