# Latest Handoff

## Date

2026-05-05

## Branch

`codex-dev`

## Current State

- Pizza Logs is Codex-first: work happens on `codex-dev`, then PRs go into `main`.
- Railway production deploys from `main` after Neil merges a PR.
- Live app: https://pizza-logs-production.up.railway.app
- Local app target for Neil's laptop: http://127.0.0.1:3001
- Local Git executable fallback: `C:\Program Files\Git\cmd\git.exe`
- GitHub CLI executable: `C:\Program Files\GitHub CLI\gh.exe`
- Parser correctness remains the highest-risk area.
- Local desktop launchers:
  - `C:\Users\neil_\OneDrive\Desktop\Start Pizza Logs Local.cmd`
  - `C:\Users\neil_\OneDrive\Desktop\Stop Pizza Logs Local.cmd`
- The repeating `PizzaLogsLocalTestServer` scheduled task is disabled; use the desktop launchers instead.

## Current Implementation Snapshot

- Next.js app has public pages for upload, raids, sessions, encounters, bosses, leaderboards, players, guild roster, and weekly stats.
- `/uploads` and `/uploads/[id]` redirect to admin upload history; public raid/session pages use `/raids/...`.
- `/admin`, `/admin/uploads`, cleanup actions, and admin import APIs are protected by `ADMIN_SECRET`.
- Upload flow streams multipart data from `app/api/upload/route.ts` to parser `/parse-stream`, then writes database rows and milestones.
- Parser supports both encounter marker and heuristic segmentation paths.
- Warmane heroic/Gunship behavior is handled with marker/session/crew-death evidence where available, but some cases remain impossible to prove from logs alone.
- Gear pages read cached Warmane snapshots, enrich from local AzerothCore `wow_items`, and attempt Warmane live fetches only as best effort.
- Supported roster/gear refresh path is browser-assisted userscripts from `/admin`.
- Player avatars intentionally use class icons, with initials fallback when class data or icon loading is unavailable.
- Production userscripts still post to Railway production; local userscripts post to `http://127.0.0.1:3001`.
- Parser tokenization and combat math are now split into small Python modules under `parser/` so line parsing and metric extraction can be tested independently.
- Parser warnings now report malformed combat-log lines instead of silently skipping them.
- `/parse`, `/parse-debug`, and `/parse-stream` reject unsupported upload filenames before parsing.
- Explicit `ENCOUNTER_START` / `ENCOUNTER_END` windows are preserved even when they are shorter than the heuristic minimum-event floor.
- Difficulty normalization is evidence-first: non-Gunship normal-looking pulls are not promoted to heroic solely because a nearby pull in the same upload was heroic.

## Parser Refactor This Session

- Added `docs/parser-audit.md` before changing parser behavior.
- Audited the current upload path from `app/api/upload/route.ts` through parser `/parse-stream`, database persistence, player/session stats, and existing parser tests.
- Studied local reference checkouts of `Ridepad/uwu-logs` and `bkader/Skada-WoTLK`; the audit cites the exact files/functions that influenced the refactor.
- Added `parser/combat_log_events.py` for timestamp parsing, CSV-safe combat-log tokenization, skipped-line classification, and normalized line objects.
- Added `parser/combat_metrics.py` for damage/healing field extraction and explicit encounter/session damage formulas.
- Refactored `parser/parser_core.py` to use those helpers while preserving existing production-facing result shapes.
- Kept stored encounter damage compatible with existing Pizza Logs behavior: `amount - overkill - absorbed`.
- Kept full-session actor `sessionDamage` compatible with existing behavior: `amount + absorbed`.
- Kept healing effective by default: gross heal minus overheal; absorbs remain separate future work.
- Added parser warnings for malformed/truncated combat-log lines.
- Fixed short explicit marker encounters being discarded by heuristic floors.
- Fixed heroic-session bleed where a later normal kill could be promoted to heroic without direct evidence.
- Added `/parse-stream` filename validation to match `/parse` and `/parse-debug`.
- Updated README, parser contract docs, parser architecture notes, security notes, decision log, current-focus, and known-issues docs.

## Verification This Session

PowerShell/npm shims in `node_modules/.bin` hit OneDrive reparse-point `Access is denied`, so equivalent bundled Node entry points were used for the same tools.

| Check | Result |
|---|---|
| `python -m pytest tests/ -v` from `parser/` | Passed, `133 passed, 1 warning` |
| ESLint via bundled Node | Passed |
| TypeScript `tsc --noEmit` via bundled Node | Passed |
| Next production build via bundled Node | Passed |
| `git diff --check` | Passed |

## Remaining Risks

- Absorbs are still not implemented as healing; Skada treats them separately.
- Some Warmane heroic/Gunship evidence is not present in every log, so ambiguous attempts stay conservative rather than guessed heroic.
- Useful damage is documented and test-covered through existing encounter rules, but needs more encounter-specific exclusions over time.
- Upload route still lacks hard server-side size enforcement; this remains the highest practical upload-flow follow-up.

## Exact Next Step

Push the parser refactor commit to `origin/codex-dev`, then open or update the PR into `main` for review. Do not merge or push `main` directly.
