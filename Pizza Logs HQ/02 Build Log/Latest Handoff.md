# Latest Handoff

## Date
2026-04-19

## Last Completed
- All parser accuracy + class color + boss order fixes
- Speed pass: csv_split → C csv module, boss name caching, batched DB writes
- **SSE real progress streaming (shipped):**
  - Python `/parse-stream` endpoint streams progress every 50k lines
  - Next.js upload route forwards SSE, does DB writes on `done` event, sends `complete`
  - Browser reads streaming response directly — progress bar shows real parser %
  - Eliminated fake time-estimate bar entirely

## Current State
- App live: https://pizza-logs-production.up.railway.app
- DB has data from latest upload
- Temporary reset-db endpoint still exists — DELETE when done testing
- All changes on main branch, pushed to GitHub

## Known Issues / Investigating
- Marrowgar: app shows 9.45k, reference shows 9.3k — under investigation

## Known Limitations
- Heroic difficulty undetectable (no ENCOUNTER_START on Warmane)
- Gunship Battle undetectable (timing overlap with Saurfang)

## Exact Next Step
1. Test SSE upload end-to-end (re-upload log, verify real progress bar)
2. Delete app/api/admin/reset-db/route.ts
3. Investigate Marrowgar DPS discrepancy

## Key Files
- parser/parser_core.py — progress_cb in _iter_lines
- parser/main.py — /parse-stream SSE endpoint
- app/api/upload/route.ts — streams SSE from parser to browser, does DB on done
- components/upload/UploadZone.tsx — reads streaming response, real progress bar
