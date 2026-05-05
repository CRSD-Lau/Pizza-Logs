# Now

## Active Focus

Parser reliability for uploaded `WoWCombatLog.txt` files, with Skada-aligned metric documentation, better malformed-line handling, and evidence-first difficulty segmentation.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. Codex does not push or merge `main` directly.

## This Session

- Created `docs/parser-audit.md` before changing parser behavior.
- Audited parser and upload code paths, including `/parse-stream`, parser core, persistence contracts, docs, and current tests.
- Studied local checkouts of `Ridepad/uwu-logs` and `bkader/Skada-WoTLK`; audit notes cite the relevant files/functions.
- Split combat-log tokenization into `parser/combat_log_events.py`.
- Split damage/healing extraction formulas into `parser/combat_metrics.py`.
- Refactored `parser/parser_core.py` to use those helpers while preserving existing result shapes.
- Added skipped-line accounting and aggregate parser warnings for malformed/truncated combat-log lines.
- Added `/parse-stream` filename validation for `.txt` and `.log` uploads.
- Preserved short explicit marker encounters that previously could be discarded by heuristic minimum-event filtering.
- Narrowed session difficulty normalization so heroic wipes do not promote a later normal kill unless there is direct evidence.
- Added focused parser tests for tokenization, damage, healing, malformed lines, explicit markers, heroic-to-normal fallback, and stream upload validation.
- Updated README, parser contract docs, parser architecture notes, security checklist, decision log, and known issues.
- Validation passed: full parser pytest suite, TypeScript type-check, ESLint, Next production build, and `git diff --check`.

## Next Actions

| Task | Status | Notes |
|---|---|---|
| Parser audit doc | DONE | `docs/parser-audit.md` |
| Tokenizer module | DONE | `parser/combat_log_events.py` |
| Metric extraction module | DONE | `parser/combat_metrics.py` |
| Parser core refactor | DONE | Existing response shape preserved |
| Malformed-line reporting | DONE | Parser warning plus skipped-line counters |
| Stream upload validation | DONE | `/parse-stream` now validates filename extension |
| Explicit marker regression | DONE | Marker encounters bypass heuristic minimum-event floor |
| Heroic-to-normal regression | DONE | Later normal kills stay normal without direct heroic evidence |
| Documentation update | DONE | README, parser contract, vault parser docs, security, decision log, known issues |
| Validation | DONE | Parser tests, type-check, lint, build, diff check |
| Branch publication | NEXT | Commit and push `codex-dev` |
| PR update | NEXT | Open or update PR into `main` after push |

## Open Follow-Ups

- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- Continue using browser-assisted Warmane imports until a local automated sync agent is built.
- Absorbs remain future parser work.
- Add more encounter-specific useful-damage exclusions as real Skada comparison data becomes available.
- Add anonymized larger upload fixtures if Neil can provide safe samples.
- If the laptop port changes from `3001`, add matching local roster/gear userscript variants or update the local constants.
- If the Desktop launcher copies drift, update `scripts/desktop/*.cmd` and copy them back to `C:\Users\neil_\OneDrive\Desktop`.

## Reference

- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Parser contract: `docs/parser-contract.md`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Item metadata table: `wow_items`
