# Latest Handoff

## Date
2026-04-19

## Last Completed
- All parser accuracy fixes (SPELL_HEAL, Valithria, false positives, class detection, KILL duration)
- Class colors wired in UI
- Boss order flipped (ICC first, Naxx last)
- Browser notification on upload complete
- **Speed pass 1 of 2 committed:**
  - `csv_split` replaced with Python's C csv module (~20x faster line parsing)
  - `_boss_names` cached as instance var (was re-imported every event — millions of times)
  - DB writes batched: pre-fetch bosses + fingerprints in 2 queries, parallel player upserts (chunks of 20), `createMany` for participants — cut ~950 sequential queries to ~15

## Remaining Speed Work
- SSE streaming: parser emits real progress events → Next.js forwards → browser shows real % 
  - Plan: `/parse-stream` FastAPI SSE endpoint, Next.js streams response, browser uses EventSource
  - This is Phase 2 of speed work

## Current State
- App live: https://pizza-logs-production.up.railway.app
- DB has data from latest upload
- Temporary reset-db endpoint still exists — DELETE when done testing
- All changes on main branch, pushed to GitHub

## Known Issues / Investigating
- Marrowgar: app shows 9.45k, reference shows 9.3k — under investigation
- Deathbringer Saurfang accuracy TBD

## Known Limitations
- Heroic difficulty undetectable (no ENCOUNTER_START on Warmane)
- Gunship Battle undetectable (timing overlap with Saurfang)
- Progress bar is still fake (time estimate) — SSE is next

## Exact Next Step
1. Verify speed improvement after Railway deploy
2. Implement SSE progress streaming (Phase 2)
3. Investigate Marrowgar DPS discrepancy
4. Delete app/api/admin/reset-db/route.ts

## Key Files
- parser/parser_core.py — core parsing logic
- parser/main.py — FastAPI app (will add /parse-stream here)
- app/api/upload/route.ts — upload handler + batched DB writes
- components/upload/UploadZone.tsx — upload UI + notifications
- lib/constants/bosses.ts — boss order + definitions
