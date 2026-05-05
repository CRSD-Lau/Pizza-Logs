# Parser Audit

Date: 2026-05-05

Scope: `parser/parser_core.py`, `parser/main.py`, `app/api/upload/route.ts`, parser tests, parser-facing Zod schemas, Prisma upload/encounter/participant persistence, and UI paths that read saved parser metrics.

## Current Parser Flow

1. Browser uploads `WoWCombatLog.txt` to `POST /api/upload`.
2. Next.js streams the multipart body to `PARSER_SERVICE_URL/parse-stream`.
3. `parser/main.py` writes the upload to a temp file, hashes it, counts lines, then runs `CombatLogParser.parse_file`.
4. `CombatLogParser._iter_lines` tokenizes timestamped lines into `(ts_str, parts, ts)`.
5. `CombatLogParser._segment_encounters` chooses one of two paths:
   - `ENCOUNTER_START` / `ENCOUNTER_END` markers if any marker is found.
   - Boss-name heuristic windows when no markers are present.
6. The same pass builds global pet-owner hints from `SPELL_SUMMON` and player-to-pet healing.
7. `CombatLogParser._aggregate_segment` infers boss, difficulty, outcome, actor totals, spell breakdowns, target breakdowns, duration, and fingerprint.
8. `app/api/upload/route.ts` validates the parser payload, deduplicates by file hash and encounter fingerprint, writes uploads, encounters, participants, and milestones, then marks the upload `DONE`.

Current storage keeps one encounter damage field: `totalDamage`. In practice it is the parser's useful/effective encounter damage convention, not a separate raw damage field.

## Reference Findings

Skada-WoTLK is the primary source of truth for in-game totals:

- `Skada/Modules/Damage.lua:54` (`log_damage`) records actor and set damage, tracks absorbed damage separately, and records overkill as a separate value.
- `Skada/Modules/Damage.lua:680` (`RegisterForCL`) registers `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `RANGE_DAMAGE`, `SPELL_BUILDING_DAMAGE`, `SPELL_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, and `SWING_DAMAGE`.
- `Skada/Core/Prototypes.lua:98` / `:109` define damage and DPS; useful damage subtracts recorded overkill.
- `Skada/Modules/Damage.lua:1010` defines the "Useful Damage" mode as a separate view.
- `Skada/Modules/Healing.lua:45` (`log_heal`) records effective healing as `max(0, amount - overheal)` and stores overheal separately.
- `Skada/Modules/Healing.lua:397` registers only `SPELL_HEAL` and `SPELL_PERIODIC_HEAL` for healing done.
- `Skada/Core/Tables.lua:61` shows the healing ignore table is commented out, including `Judgement of Light`.
- `Skada/Core/Prototypes.lua:204` / `:209` define healing and HPS from the set duration.

uwu-logs is useful for upload-oriented architecture and WotLK segmentation:

- `logs_fight_separator.py:111` / `:225` separates boss-line collection from pull slicing.
- `logs_fight_separator.py:151` refines fight endings using boss death, overkill, and aura removal evidence.
- `logs_fight_separator.py:277` uses boss-specific idle windows instead of one universal timeout.
- `logs_fight_separator.py:371` dumps boss lines by GUID before computing encounter windows.
- `logs_check_difficulty.py:244` / `:258` detects difficulty from boss spell IDs.
- `logs_check_difficulty.py:278` / `:287` uses overkill and boss death evidence for kill detection.
- `logs_dmg_useful.py:31` keeps encounter-specific useful-target tables.
- `logs_dmg_heals.py:98` parses damage, healing, damage taken, and total healing in one aggregate pass, then `:138` / `:162` remap pets to owners.

## Known Weaknesses

- `parser_core.py` is one large module; line tokenizing, event math, pet ownership, segmentation, difficulty, outcome, aggregation, and serialization-facing model construction are tightly coupled.
- Explicit `ENCOUNTER_START` / `ENCOUNTER_END` segments currently pass through the same minimum event floor as heuristic segments. Explicit marker windows should be trusted even for short wipes or partial logs.
- Once any encounter marker appears, the file uses marker mode globally. Mixed marker/no-marker logs can miss later heuristic-only encounters.
- Session difficulty normalization promotes every `25N` encounter in a session to `25H` after any confirmed `25H` encounter. That can incorrectly bucket a later normal attempt after heroic wipes.
- The parser silently skips malformed lines. Unsupported combat events are still intentionally ignored, but malformed input should be counted and surfaced as parser warnings so upload results are explainable.
- `totalDamage` and "useful damage" are not modeled separately in the app schema. A schema migration may be warranted later, but changing leaderboard semantics in this refactor would be high risk.
- Useful target filtering is only a boolean boss-level `filter_add_damage` rule. uwu-logs has richer encounter-specific useful-target tables.
- Absorbs remain intentionally separate from healing done, but the app does not yet expose a separate absorbs metric.
- `/parse-stream` does not currently repeat the filename extension validation that `/parse` and `/parse-debug` perform.
- `/api/upload` documents a 1 GB client limit but still lacks a hard web-route byte limit before forwarding.

## Target Architecture

Keep the public parser response shape stable unless tests justify a schema migration. Split testable responsibilities without rewriting the product surface:

- `combat_log_events.py`: raw line tokenizer and event normalization helpers.
- `parser_core.py`: encounter segmentation, attempt/session grouping, boss/difficulty/outcome policy, and aggregation orchestration.
- `bosses.py`: canonical boss aliases, IDs, and useful-target policy.
- `main.py`: upload receiving, temp-file handling, parser invocation, and SSE serialization.
- Next.js upload route: streaming proxy, parser response validation, duplicate detection, and persistence adapter.

Longer-term candidates:

- `encounter_segments.py`: marker and heuristic segmenters, including mixed marker/no-marker fallback and boss-specific idle windows.
- `metrics.py`: raw damage, useful damage, effective healing, overheal, overkill, absorbs, DPS/HPS.
- `upload_result.py`: parser warning and skipped-line summary model shared by `/parse`, `/parse-stream`, and `/parse-debug`.

## TDD Plan

Add failing tests before production changes:

1. Explicit marker segments with fewer than 10 events still produce an encounter.
2. A heroic wipe followed by a normal kill in the same session remains `25H` then `25N`, not two `25H` rows.
3. Malformed lines are counted and surfaced without crashing.
4. Raw tokenizer and metric tests cover valid lines, bad timestamp separators, malformed CSV, shifted `SWING_DAMAGE` fields, and heal/damage formulas.
5. Upload parser endpoints reject unsupported filenames consistently.

Then refactor behind the tests:

1. Extract line tokenizing and skipped-line accounting.
2. Preserve current Skada-aligned event sets and existing field indexes.
3. Relax the event floor only for explicit marker windows.
4. Replace broad session promotion with evidence-first difficulty normalization.
5. Add parser warnings for skipped/malformed lines without changing persisted database schema.
6. Keep `totalDamage`, `dps`, `totalHealing`, and `hps` behavior stable unless a focused failing test proves a current value is wrong.

## Risk Areas

- Parser math affects leaderboards, milestones, weekly rankings, and player profiles.
- Difficulty changes affect encounter fingerprints and duplicate detection.
- Changing `totalDamage` semantics would alter historical leaderboard comparability; avoid without a dedicated migration plan.
- Mixed marker/no-marker handling can accidentally double-count if marker and heuristic windows overlap.
- Upload route changes can break long-running SSE streams if the parser response contract drifts.
- Any schema change would require Prisma migration review and Railway production risk notes.

## Assumptions

- Skada-WoTLK "Damage Done" and "Useful Damage" are separate in-game modes; Pizza Logs currently stores one damage value and uses it for DPS leaderboards.
- Until the database has separate raw/useful fields, Pizza Logs should keep current `totalDamage` leaderboard semantics stable and document the limitation.
- Difficulty should come from direct encounter marker IDs or in-segment evidence first. Session promotion is allowed only when the rule cannot cross-contaminate a normal fallback attempt.
- Synthetic fixtures are acceptable for edge cases that cannot be sourced from private user uploads.
- Real combat logs must not be committed unless trimmed and anonymized.

## Validation Baseline

Baseline before logic edits:

```powershell
& 'C:\Users\neil_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest tests/ -v
```

Result: `123 passed`.

## Implemented In This Refactor

- Added `parser/combat_log_events.py` for raw line tokenizing and malformed-line classification.
- Added `parser/combat_metrics.py` for Skada-aligned damage/healing field extraction and explicit encounter/session damage formulas.
- `CombatLogParser._iter_lines` now counts malformed non-blank lines and returns an aggregate parser warning.
- Explicit `ENCOUNTER_START` / `ENCOUNTER_END` windows are no longer discarded by the heuristic minimum-event floor.
- Difficulty normalization no longer promotes non-Gunship `25N` pulls to `25H` solely because another pull in the same session was heroic.
- Added focused tests for short marker windows, heroic-wipe-to-normal-kill fallback, tokenizer behavior, metric field extraction, malformed-line warnings, and `/parse-stream` file extension validation.
- `/parse-stream` now rejects unsupported filename extensions before writing temp files, matching `/parse` and `/parse-debug`.
