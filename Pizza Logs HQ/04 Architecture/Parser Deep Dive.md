# Parser Deep Dive

Formal contract: `docs/parser-contract.md`.

Implementation: `parser/parser_core.py`.

## Goal

Match Skada-WoTLK for WotLK combat-log totals. Do not chase uwu-logs behavior unless the task is specifically to explain differences.

## Inputs

WotLK combat-log lines look like:

```text
M/D HH:MM:SS.mmm  EVENT,field1,field2,...fieldN
```

Timestamps have no year. The parser uses a file-year hint when provided, otherwise current year.

## Segmentation Paths

The parser supports two paths:

1. `ENCOUNTER_START` / `ENCOUNTER_END` when useful markers exist.
2. Heuristic Warmane path based on known boss names, combat events, and 30 seconds without boss activity.

Warmane logs often have missing or misleading encounter markers, so the heuristic path is still required.

## Difficulty

- Encounter marker difficulty IDs map to `10N`, `25N`, `10H`, or `25H` when present.
- Warmane may report heroic pulls as normal, so heroic marker spells are checked even when `ENCOUNTER_START` exists.
- Session normalization is intentionally narrow: Gunship can inherit heroic evidence, but normal-looking non-Gunship attempts are not promoted just because another pull in the session was heroic.
- Some encounters do not expose enough evidence and remain normal rather than guessing from unrelated pulls.

## Damage Events

Skada damage events:

```python
SPELL_DAMAGE
SWING_DAMAGE
RANGE_DAMAGE
SPELL_PERIODIC_DAMAGE
DAMAGE_SHIELD
DAMAGE_SPLIT
SPELL_BUILDING_DAMAGE
```

Damage suffix for spell/range/periodic/shield/split/building events:

```text
parts[10] amount
parts[11] overkill
parts[15] absorbed
```

`SWING_DAMAGE` has no spell fields:

```text
parts[7]  amount
parts[8]  overkill
parts[12] absorbed
parts[13] critical
```

Stored encounter damage subtracts overkill and absorbed amounts. Full-session
`sessionDamage` counts `amount + absorbed` as total player output across the log.

## Healing Events

Skada healing events:

```python
SPELL_HEAL
SPELL_PERIODIC_HEAL
```

Field layout:

```text
parts[10] gross heal
parts[11] overheal
parts[12] absorbed
parts[13] critical
```

Effective healing is:

```python
max(0, gross - overheal)
```

Skada has no `ignored_spells.heal`; every `SPELL_HEAL` and `SPELL_PERIODIC_HEAL` counts. `SPELL_HEAL_ABSORBED` is not healing done.

## Outcome And Duration

- Boss `UNIT_DIED` means `KILL`.
- Valithria uses Green Dragon Combat Trigger death evidence.
- Gunship uses Warmane crew-death evidence because Warmane can emit `ENCOUNTER_END success=0` even on real kills.
- KILL duration uses boss death time, not post-fight tail.
- WIPE duration uses the segment end.

## Pet And Vehicle Handling

- `SPELL_SUMMON` builds pet-owner mappings.
- Pet damage is attributed to the owner when owner evidence exists.
- Vehicle GUIDs such as `0xF15*` are excluded so Gunship cannons are not treated as player pets.
- Pets already active before the log starts can remain orphaned; this is a known residual mismatch source.

## Performance

- Lines are parsed with Python's CSV module.
- Raw line tokenizing lives in `parser/combat_log_events.py`.
- Damage/healing field extraction lives in `parser/combat_metrics.py`.
- Malformed non-blank lines are counted and returned as aggregate parser warnings.
- Boss-name sets are cached on parser initialization.
- `/parse-stream` emits SSE progress while parsing and while Next.js writes DB rows.
- `/parse-stream` rejects unsupported filename extensions before writing temp files.
- Parser tests live under `parser/tests/`.
