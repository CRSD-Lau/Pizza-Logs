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
- Parser correctness remains the highest-risk area.

## Current Implementation Snapshot

- Next.js app has public pages for upload, raids, sessions, encounters, bosses, leaderboards, players, guild roster, and weekly stats.
- `/uploads` and `/uploads/[id]` redirect to admin upload history; public raid/session pages use `/raids/...`.
- `/admin`, `/admin/uploads`, cleanup actions, and admin import APIs are protected by `ADMIN_SECRET`.
- Upload flow streams multipart data from `app/api/upload/route.ts` to parser `/parse-stream`, then writes database rows and milestones.
- Parser supports both encounter marker and heuristic segmentation paths.
- Warmane heroic/Gunship behavior is handled with marker/session/crew-death evidence where available, but some cases remain impossible to prove from logs alone.
- Gear pages read cached Warmane snapshots, enrich from local AzerothCore `wow_items`, and attempt Warmane live fetches only as best effort.
- Supported roster/gear/portrait refresh path is browser-assisted userscripts from `/admin`.
- Production userscripts still post to Railway production; local userscripts post to `http://127.0.0.1:3001`.

## Local Userscript Changes This Session

- Added local install endpoints:
  - `http://127.0.0.1:3001/api/admin/armory-gear/userscript.local.user.js`
  - `http://127.0.0.1:3001/api/admin/guild-roster/userscript.local.user.js`
  - `http://127.0.0.1:3001/api/player-portraits/userscript.local.user.js`
- Added local install buttons and URL fields on the admin gear/portrait and guild roster panels.
- Local gear and roster scripts still run on Warmane Armory pages, but they post imports into the laptop dev server instead of production.
- Local portrait script also matches `localhost:3001` and `127.0.0.1:3001` Pizza Logs pages.

## Recent Documentation Audit Changes

- Rewrote root README, contributor workflow, security policy, branch workflow docs, and review checklist around the current `codex-dev -> PR -> main` process.
- Removed duplicate or historical-only docs:
  - blank vault inbox capture note;
  - completed cinematic Superpowers spec and plan;
  - duplicate AI prompt/skill reference notes;
  - old growth/business note;
  - separate backlog and technical-debt docs now consolidated into `Feature Status`.
- Updated vault architecture, deployment, security, parser, current-focus, and known-issues notes to match current code.
- Corrected stale direct-`main` deploy language.
- Corrected stale claims that heroic and Gunship behavior are completely undetectable.
- Documented open repo issues found during audit: upload lacks hard server-side size enforcement, and some env/example variables had drifted from actual code usage.

## Verification This Session

PowerShell/npm shims in `node_modules/.bin` hit OneDrive reparse-point `Access is denied`, so equivalent bundled Node entry points were used for the same tools.

| Check | Result |
|---|---|
| `tests/armory-gear-client-scripts.test.ts` | Passed |
| `tests/guild-roster-client-scripts.test.ts` | Passed |
| `tests/player-portrait-client-scripts.test.ts` | Passed |
| `tests/gear-import-bookmarklet.test.ts` | Passed |
| `tests/guild-roster-admin-panel.test.ts` | Passed |
| `tests/local-userscript-routes.test.ts` | Passed |
| ESLint via bundled Node | Passed |
| TypeScript `tsc --noEmit` via bundled Node | Passed |
| Next production build via bundled Node | Passed |
| Local `3001` gear userscript endpoint | 200, contained local origin and local script name |
| Local `3001` roster userscript endpoint | 200, contained local origin and local script name |
| Local `3001` portrait userscript endpoint | 200, contained local origin and local script name |

## Local Server Recovery

- A runtime error appeared on `http://127.0.0.1:3001`: `Cannot find module './5611.js'`.
- Root cause was a mixed `.next` cache: the running dev server loaded a webpack runtime expecting chunks at `.next\server\5611.js`, while the actual chunks were under `.next\server\chunks\5611.js`.
- Likely trigger: running a production `next build` while the long-running local dev server was still active.
- Recovery performed: stopped the stale Next process, removed only the generated `.next` folder, restarted the existing `PizzaLogsLocalTestServer` scheduled task, and verified `/` plus the local gear userscript endpoint returned 200.

## Exact Next Step

`codex-dev` is pushed to GitHub. Open the PR manually because the GitHub connector returned 403 when Codex tried to create it:

https://github.com/CRSD-Lau/Pizza-Logs/compare/main...codex-dev?expand=1

After the PR is open, use the local install links from `/admin` when importing into the laptop database.
