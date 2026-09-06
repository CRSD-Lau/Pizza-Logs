# Parser Contract

This document is the authoritative behavioral contract for Pizza Logs parsing. Tests and fixtures enforce it; presentation code must not silently redefine these metrics.

## Authority and Scope

- Primary input: Warmane/WotLK 3.3.5a `WoWCombatLog.txt` data.
- Skada-WoTLK defines the supported damage/healing event sets and effective-healing primitive.
- UwU-style views may be adopted as explicit analytical layers; they do not replace stored primitives.
- Missing, contradictory, or unsupported evidence remains `UNKNOWN`, ambiguous, or unattributed.

## Input and Identity

Combat lines are parsed as bounded CSV-like records. Malformed lines are counted/skipped and surfaced as aggregate warnings rather than crashing the upload.

Calendar month/day and clock ranges are validated. Explicit dates determine
elapsed time and session boundaries, so equal clock times on successive dates
cannot merge separate raids. December-to-January advances the configured file
year; other backwards dates or timestamps are counted as out-of-order input
instead of inventing a day or year. Encounter and session ISO timestamps retain
the inferred UTC year across that rollover.

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

Public reporting applies a separate, reversible short-pull counting policy to
stored encounters: a `WIPE` strictly under 60,000 ms with zero recorded participant
deaths is excluded by default. Kills, death-bearing wipes and `UNKNOWN` outcomes
remain included. Missing evidence is not assumed to be zero. The include-all view
restores the original attempts. This policy does not change parser segmentation,
stored outcomes, fingerprints, encounter primitives or full-session analytics; see
[reading reports](guides/reading-reports.md#short-pulls-and-wipe-counts).

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

`ENVIRONMENTAL_DAMAGE` does contribute incoming damage and death context for
player targets. Its shifted fields are environmental type at `parts[7]`, raw
amount at `parts[8]`, overkill at `parts[9]`, school at `parts[10]`, absorbed
metadata at `parts[13]`, and critical evidence at `parts[14]`. Raw incoming
amounts include overkill; numeric absorbs remain separate and use the existing
shield-evidence rules. Environmental events never add outgoing player damage.

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

Player and known-owned-pet healing counts regardless of recipient type, including
Valithria Dreamwalker, other NPCs, pets and totems. The recipient being a non-player
must not remove effective healing from encounter, actor or spell totals. Source
eligibility and pet-ownership evidence still apply; accepting an NPC recipient
does not assign that NPC to the healer as a pet.

## Absorbs

Absorbs remain separate from effective healing. Numeric absorbed amounts come from incoming damage events and are attributed only when supported shield-aura/source evidence exists.

- One supported active shield: attribute to its player source.
- Multiple supported shields: choose the newest eligible evidence and mark the hit ambiguous.
- A just-removed shield remains eligible for 0.5 seconds to cover combat-log ordering.
- Discipline critical-heal/Penance evidence may identify Divine Aegis ownership.
- Missing/non-player evidence remains in `unattributedAbsorbs`.
- Fully absorbed missed events without a numeric amount cannot be measured.

Participant output keeps `totalHealing`, `totalAbsorbs`, HPS, and APS separate. The `Heal`/`H+A PS` view equals effective healing plus attributed absorbs. This definition alone does not prove UwU attribution or display parity; see the [measured parity contract](uwu-analytics-parity.md).

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

Fel Synergy (`54181`) is accepted only as `SPELL_HEAL` from a player to a
controlled permanent pet. Its owner-specific target is supported by the
[pinned WotLK spell implementation](https://github.com/azerothcore/azerothcore-wotlk/blob/d7189cf87e130ec8590d39376137dd315f0c1c45/src/server/scripts/Spells/spell_warlock.cpp#L1029-L1064).
An unverified spell ID or ordinary heal does not establish ownership.

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

The report's main summary is a presentation rollup of selected stored encounters,
including their adds and mechanics. All Boss Attempts includes every recorded
`KILL`, `WIPE` and `UNKNOWN` attempt, including short pulls. Successful Boss Fights
selects `KILL` only. Its player rates divide summed primitives by the summed
duration of the same selected attempts, with valid legacy seconds used when precise
milliseconds are absent. Missing duration leaves rates unavailable. No kills means
an empty successful-fights view, not a fallback to wipes or full-session totals.
The short-pull control changes list visibility and counts without changing either
summary's totals or rates. No player or owned-pet primitives are counted twice. Original
first-to-last-event analytics remain available in a separate full-session section;
this reporting choice does not change parsing or stored data.

## Deduplication

- File duplicate: SHA-256 of the complete received bytes.
- Encounter duplicate: SHA-256 over boss, difficulty, exact normalized pull start, and sorted participant names.

Exact starts prevent same-roster back-to-back pulls from colliding while remaining deterministic across copies of one pull.

## Parser HTTP Surface

The production web path uses `POST /uploads/{uuid}/stream`, with archive/resource validation and a bounded worker pool. The final payload includes the parser-observed byte count and is Zod-validated by the web service.

Legacy `/parse`, `/parse-debug`, and `/parse-stream` routes are disabled by default and are not used by public uploads. Arbitrary filesystem parsing is not supported.

## Regression Gates

- `parser/tests/test_parser_core.py` - focused behavioral rules
- `parser/tests/test_fixtures.py` - canonical fixture expectations
- `parser/tests/test_difficulty_detector.py` - detector matrix and conflicts
- `parser/tests/test_archive_upload.py` - archive/resource safety
- `parser/tests/test_parser_service.py` - HTTP/default-off legacy boundary
- `parser/tests/baselines/` - frozen analytical output
- `parser/tests/test_uwu_parity_baseline.py` - historical external-oracle integrity check (no paired source input)

Any behavior change needs focused evidence or a fixture plus the full parser suite. Historic database rows are not reparsed automatically.
