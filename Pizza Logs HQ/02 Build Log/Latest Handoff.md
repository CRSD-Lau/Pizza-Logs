# Latest Handoff

## Date

2026-08-11

## Branch

`codex-dev`

## Current State

- Pizza Logs is Codex-first: work happens on `codex-dev`, then PRs go into `main`.
- Railway production deploys from `main` after Neil merges a PR.
- Live app: https://pizza-logs-production.up.railway.app
- Canonical local checkout on Neil's desktop: `C:\Projects\PizzaLogs`
- Local app target on Neil's desktop: http://127.0.0.1:3001
- Local Git executable fallback: `C:\Program Files\Git\cmd\git.exe`
- GitHub CLI executable: `C:\Program Files\GitHub CLI\gh.exe`
- Parser correctness remains the highest-risk area.
- The frontend now uses a shared page/header/section/data-panel contract, readable metadata colors, 44px controls, asymmetric metric summaries, responsive analytical rows, and progressive disclosure for long directories and reports.
- The cinematic intro is homepage-only and runs once per browser session; hard-loaded report and profile routes are never blocked by it.
- Difficulty now uses per-attempt `pizza-difficulty-v2` boss/mode spell sets, explicit Ulduar rules, conflict-to-`UNKNOWN`, and auditable evidence.
- Browser uploads now use one raw UUID-keyed request for `.txt`, `.log`, or `.zip`; the parser atomically finalizes, validates, emits quick modes, then runs full parsing on bounded workers.
- A 31,621,979-byte ZIP benchmark reached quick classification 1,926.60 ms after the final byte and completed full parsing in 5,158.69 ms.
- A full production route, mobile, accessibility, ticket, source, and dependency audit is recorded in `02 Build Log/2026-08-10 Site and Ticket Audit.md`.
- PR #29 merged into `main` as `55d931c`; its clean Linux `test-build` passed,
  but the first Railway deployment failed at runtime because the final image
  omitted `prisma.config.ts`.
- The supported workflow is now explicitly one desktop checkout -> `origin/codex-dev` -> PR -> `origin/main` -> Railway. Active docs no longer point to the retired OneDrive/laptop checkout.
- GitHub's renamed `Production main` ruleset now requires a PR and passing `test-build`, and blocks branch deletion and non-fast-forward updates.
- Removed unused standalone `sync-agent` TypeScript/build exclusions and replaced its named env ignore with a safer generic `.env.*` rule; current browser-sync launcher logs remain ignored.
- Production is broadly functional; the audit found and locally fixed a timezone-dependent React hydration error on leaderboard rows.
- The platform upgrade candidate now uses Node 24, Next.js 16.3, React 19.2, Prisma 7.9, Tailwind 4.3, Recharts 3.10, Zod 4.4, Dropzone 20.1, and current compatible supporting dependencies. `npm audit` is zero.
- TypeScript 7.0 is the explicit native type-checker; TypeScript 6 supplies the JavaScript API still consumed by Next.js and ESLint. Both gates pass.
- Parser analytical output is frozen by exact fixture hashes. Headline damage now follows UwU's raw damage-event amount while useful/effective damage remains a separate primitive; absorbs/APS, spec/role, aura uptime, consumables, power gains, and death context remain persisted and displayed.
- The linked Lausudo UwU report is now a separate five-pull acceptance baseline. Parser repairs bound pull ends to boss-destination events, includes all matched targets in encounter totals, uses raw incoming damage for headline taken, requires defensible pet-owner evidence, and improves consumed-shield/Divine Aegis attribution.
- New uploads persist an UwU-compatible whole-session Custom Slice from the first to last log event. Session cards and the per-player table use one shared duration for raw Total Damage, effective healing plus attributed absorbs, and raw Damage Taken; wipes, trash, and downtime remain included.
- Admin diagnostics include Railway deployment identity, and a Node 24 production smoke workflow runs after successful production deployments plus weekly.
- PR #29 initially produced Railway 502 responses because the Prisma 7 runtime
  image omitted `prisma.config.ts`; the final image could not resolve
  `datasource.url` during `migrate deploy`. The Docker hotfix copies the config
  beside `start.sh` and is validated by running the real image startup path.
- ICC heroic difficulty detection now uses boss-scoped markers. `Rune of Blood`
  no longer promotes Deathbringer Saurfang; Saurfang heroic uses `Scent of Blood`
  spell IDs, and Valithria heroic uses `Twisted Nightmares`.
- Session player comparison charts now graph kills only, so wipe pulls no longer
  clutter the DPS/HPS by encounter trend.
- Gear quick looks now refresh individual known characters on demand through the
  Pizza Logs server, with a five-minute cache and last-healthy-snapshot fallback.
- Guild roster refresh is an authenticated first-party control on `/admin`; no
  browser helper or open Warmane tab participates in the current data path.
- README now includes a high-resolution app preview captured from a fresh local Next server on `http://127.0.0.1:3004`.
- README now links to the GitHub wiki, and the wiki has been refreshed for current upload, roster, gear, parser, roadmap, and branch workflow details.
- Local repo-root launchers:
  - `C:\Projects\PizzaLogs\Start Pizza Logs Local.cmd`
  - `C:\Projects\PizzaLogs\Stop Pizza Logs Local.cmd`
- Imported local Codex discussion history lives under `Pizza Logs HQ/08 AI Control Center/Imported Codex Chats/`.

## Frontend Polish Session

- Raised `text-dim` to `#918772` and `text-secondary` to `#b3a68c`; meaningful metadata no longer uses the previous 2.3-2.6:1 microtext treatment.
- Added `PageShell`, `PageHeader`, `PageSection`, and `DataPanel`, plus a documented frontend contract in `DESIGN.md`.
- Standardized public/admin page rhythm, reduced equal-card treatment, and introduced a dominant metric on homepage, weekly, session, and encounter summaries.
- Paginated the player directory at 30 profiles per page, collapsed empty boss raids, and changed leaderboards to one accessible boss disclosure at a time.
- Converted damage and target meter rows to native buttons with focus and expanded-state semantics. Mobile meters and encounter aura, consumable, and power rows now collapse to intentional two-column summaries.
- Enlarged navigation, search, upload, filter, pagination, and disclosure controls to a 44px minimum interaction box.
- Replaced component-level school/gold literals with shared tokens where equivalents exist.
- Local browser verification passed at 1440x1000 and 375x812 with no document overflow, no console warnings/errors, 44px visible form controls, and no intro on a hard-loaded `/players` route.
- Verification passed: TypeScript 7, all 38 web tests, zero-warning ESLint, and the Next.js 16 production build.
- No parser, Prisma schema, migration, API, or persisted analytical behavior changed.

## Current Implementation Snapshot

- Next.js app has public pages for upload, raids, sessions, encounters, bosses, leaderboards, players, guild roster, and weekly stats.
- Next.js 16 uses `proxy.ts` for the protected admin matcher; no synchronous request API or legacy `middleware.ts` remains.
- Prisma 7 uses `prisma.config.ts`, the generated client under ignored `generated/prisma`, and `@prisma/adapter-pg`; the final Docker image retains the ESM Prisma CLI needed by `start.sh`.
- Encounter reports now expose total absorbs/APS, shield attribution details, spec/role, aura uptime, consumables, power gains, target damage, and deaths with the prior 15 seconds of incoming damage.
- `/guild-roster` now keeps the roster table contained to 20 members per page, with URL-backed page navigation in the table footer.
- GitHub Actions posts new, reopened, and ready-for-review PR summaries to Slack when `PR_SLACK_WEBHOOK_URL` is configured; if the secret is missing, the workflow warns and exits successfully.
- `/uploads` and `/uploads/[id]` redirect to admin upload history; public raid/session pages use `/raids/...`.
- `/admin`, `/admin/uploads`, cleanup actions, and first-party refresh actions are protected by `ADMIN_SECRET`.
- Upload flow streams raw bytes from `app/api/upload/route.ts` to parser `/uploads/{uuid}/stream`, then uses the existing database and milestone path after full parsing. Legacy `/parse-stream` remains for plain multipart clients.
- Parser supports both encounter marker and heuristic segmentation paths, with Skada-aligned damage/healing formulas documented in `docs/parser-contract.md`.
- Parser heroic upgrade markers are boss-scoped to reduce mixed-raid false positives:
  Saurfang `Rune of Blood` is normal-capable, Saurfang `Scent of Blood`
  IDs `72769`/`72771` are heroic evidence, and Valithria `Twisted Nightmares`
  IDs `71940`/`71941` or name are heroic evidence.
- `/raids/[id]/sessions/[sessionIdx]/players/[playerName]` still lists all pulls
  in Encounter Breakdown, but its line chart now builds from kill encounters only.
- Gear pages read cached Warmane snapshots, enrich from local AzerothCore `wow_items`, and refresh known characters directly through Pizza Logs on a five-minute window.
- The supported roster path is the authenticated **Refresh from Warmane** admin action; the public roster reads its durable database snapshot.
- Player avatars intentionally use class icons, with initials fallback when class data or icon loading is unavailable.
- Class avatars are now first-party gear quick-look controls. Hover, focus, or tap lazily loads current Warmane equipment, Armory class/race/guild identity, GearScoreLite, average item level, and freshness without Tampermonkey or an admin secret.
- `GET /api/players/[name]/gear` is limited to known combat-log players or guild-roster members, refreshes on a five-minute window, and falls back to the last healthy gear snapshot when Warmane is unavailable.
- Active gear/roster browser import APIs, admin install controls, bookmarklet code,
  scheduled-task installers, and tab-opening launchers are removed.
- Legacy gear/roster userscript update URLs serve inert version `2.0.0` cleanup
  code so existing installs stop syncing and clear saved Pizza Logs secrets.
- Only the two Windows uninstall scripts and npm cleanup commands remain for
  removing previously installed scheduled tasks or Startup launchers; see
  `docs/userscript-retirement.md`.

## First-Party Armory Retirement Session

- Removed Tampermonkey/userscript install links and browser-import instructions from `/admin`.
- Connected the existing protected `syncGuildRosterFromAdmin` server action to a 44px **Refresh from Warmane** control with pending, success, and error states.
- Verified the direct Warmane roster fetch live with 163 Pizza Warriors members, including class and rank data.
- Kept gear fully on demand through the class-avatar quick look; no bulk browser refresh is required.
- Removed the gear/roster browser import APIs, queue helper, task installers, tab launchers, related tests, and obsolete setup docs.
- Retained exact legacy update URLs as inert version `2.0.0` retirement scripts and retained uninstall-only Windows cleanup commands.
- `npm run check:pr` passed: zero-warning ESLint, both TypeScript gates, all 35 web tests, and the Next.js 16 production build.
- Authenticated local admin verification showed the new refresh control at exactly 44px high, no install/userscript language, no horizontal overflow, and no console warnings or errors.
- No parser, Prisma schema, migration, or combat-log behavior changed.

## Live Gear Cache Validation Session

- Expanded the class-avatar gear quick look from 30rem/two columns to a viewport-safe 46rem/three-column desktop layout, with two columns on narrow screens, and removed the 24rem clipping cap so every equipped slot renders.
- Replaced the misleading **Server Refresh Errors** total with **Latest Live Refresh**, sourced from the newest non-null `lastSuccessAt` and rendered explicitly in UTC.
- Renamed **Cached Characters** to **Cached Snapshots** so the count is not confused with roster size.
- Added an authenticated, confirmation-gated **Clear Gear Cache** control that deletes only `armory_gear_cache`; players, roster, item metadata, uploads, and reports are untouched.
- Production live probes proved both paths: Maximusboom returned a new non-stale 19-item snapshot at `2026-08-12T01:46:44Z` with GearScore 6,245, while Azyia safely returned a stale July 27 snapshot when that request could not refresh.
- Railway CLI authentication is expired on the workstation, so no direct production database deletion was attempted. The protected admin control is the credential-safe reset path after deployment.
- `npm run check:pr` passed: zero-warning ESLint, both TypeScript gates, all 36 web tests, and the Next.js 16 production build.
- No parser, Prisma schema, migration, or combat-log behavior changed.

## Quiet Warmane Sync Launch Session

- Investigated Neil's report that hourly sync was opening too many browser tabs
  and flashing command prompts during gaming.
- Root cause: the Windows tasks launched `powershell.exe` directly every hour,
  and Startup used visible `.cmd` launchers; each browser URL launch could create
  a fresh tab.
- Moved hourly repeat ownership into the Gear and Guild Roster userscripts so an
  already-open Warmane tab keeps syncing.
- Bumped Gear Sync to `1.8.1` and Guild Roster Sync to `1.1.1`.
- Updated both Windows installers to remove the old hourly scheduled task and
  replace the visible `.cmd` Startup launcher with a hidden `.vbs` wrapper using
  `WScript.Shell`.
- Reinstalled the local launchers on Neil's machine.
- Removed the local `PizzaLogsGearSync` and `PizzaLogsGuildRosterSync` scheduled
  tasks.
- Removed the old Startup `.cmd` launchers and created:
  - `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGearSyncAtLogon.vbs`
  - `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGuildRosterSyncAtLogon.vbs`

## Warmane Auto-Open Removal Session

- Investigated Neil's follow-up that Chrome was still silently opening tabs and
  using too much memory.
- Confirmed no Pizza Logs scheduled tasks remained and no active Pizza
  Logs/Warmane PowerShell, WScript, or Chrome command line was running.
- Confirmed the remaining auto-open source was the two Startup `.vbs` launchers.
- Removed both local Startup launchers:
  - `PizzaLogsGearSyncAtLogon.vbs`
  - `PizzaLogsGuildRosterSyncAtLogon.vbs`
- Updated both installer scripts so the default behavior removes old scheduled
  tasks and old `.cmd`/`.vbs` Startup launchers, but creates no Windows
  auto-open launcher.
- Kept `-RunNow` as an optional one-time open and `-CreateStartupLauncher` as an
  explicit opt-in only.
- The cinematic intro now uses generated video assets from `animations/source/Veo.mp4` instead of the retired `public/intro` asset set.

## Tampermonkey Auth Session

- Investigated `Pizza Logs Gear Sync` showing `Sync failed: Unauthorized.` on Warmane.
- Root cause: the production and local Warmane userscripts both stored the admin secret under the same `armory.warmane.com` localStorage key, so switching between production and local scripts could reuse the wrong secret.
- Updated gear and roster userscripts to use target-specific keys:
  - `pizzaLogsAdminSecret:https://pizza-logs-production.up.railway.app`
  - `pizzaLogsAdminSecret:http://127.0.0.1:3001`
- Updated gear last-run storage to be target-specific as well.
- Unauthorized responses now clear both the new target key and the old shared legacy key, then tell the admin which target rejected the secret.
- Injected panels now show `Target: <host>` under the title.
- Bumped userscript versions:
  - Gear: `1.7.1`
  - Roster: `1.0.5`
- Local endpoints verified on `http://127.0.0.1:3001` after the local stack was started.

## Hourly Gear Refresh Session

- Investigated `Pizza Logs Gear Sync` reporting `No players need import or enrichment.`
  even though Neil wanted current gear refreshed for characters already in the DB.
- Root cause: `/api/admin/armory-gear/missing` only returned missing or
  enrichment-needed cache rows, so complete cached characters were skipped.
- Added a `refresh-all` mode to the existing admin gear queue endpoint.
- Added `getArmoryGearRefreshPlayers` to return all known combat-log players plus
  guild roster members, de-duped by character and realm.
- Updated the hosted gear userscript and bulk bookmarklet fallback to request
  `mode: "refresh-all"`.
- Bumped Gear Sync to `1.8.0`.
- Updated admin copy, README gear wording, and feature-status notes to describe
  hourly current-equipment refreshes.

## Windows Gear Sync Task Session

- Confirmed direct local CLI/API requests to Warmane character JSON return HTTP
  403, so the safe automation path still needs a real browser context.
- Added `scripts/gear-sync/open-warmane-gear-sync.ps1` to open a configurable
  Warmane character page with Chrome, Edge, or the Windows default browser.
- Added `scripts/gear-sync/install-windows-task.ps1` to register the hourly
  `PizzaLogsGearSync` task through `schtasks.exe` and create a Startup-folder
  `PizzaLogsGearSyncAtLogon.cmd` launcher.
- Added `scripts/gear-sync/uninstall-windows-task.ps1` for cleanup.
- Added npm shortcuts:
  - `npm run gear-sync:install-task`
  - `npm run gear-sync:uninstall-task`
- Added `docs/gear-sync-windows-task.md` with setup, limits, logs, Startup
  folder behavior, and uninstall instructions.
- The scheduled task stores no Pizza Logs admin secret; the userscript secret
  remains in the browser profile on `armory.warmane.com`.
- Installed the current-user hourly scheduled task on Neil's Windows machine.
- Created the Startup-folder launcher at
  `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGearSyncAtLogon.cmd`.

## Windows Guild Roster Sync Task Session

- Extended the roster userscript so saved-secret Warmane guild page visits
  auto-sync at most once per hour.
- Bumped Guild Roster Sync to `1.1.0`.
- Added `scripts/guild-roster-sync/open-warmane-guild-roster-sync.ps1` to open
  the Pizza Warriors Warmane guild summary page through Chrome, Edge, or the
  Windows default browser.
- Added `scripts/guild-roster-sync/install-windows-task.ps1` to register the
  hourly `PizzaLogsGuildRosterSync` task through `schtasks.exe` and create a
  Startup-folder `PizzaLogsGuildRosterSyncAtLogon.cmd` launcher.
- Added `scripts/guild-roster-sync/uninstall-windows-task.ps1` for cleanup.
- Added npm shortcuts:
  - `npm run guild-roster-sync:install-task`
  - `npm run guild-roster-sync:uninstall-task`
- Added `docs/guild-roster-sync-windows-task.md` with setup, limits, logs,
  Startup folder behavior, and uninstall instructions.
- Hardened both gear and roster uninstall scripts so missing tasks/startup
  launchers are clean no-ops.
- Installed the current-user hourly scheduled task on Neil's Windows machine.
- Created the Startup-folder launcher at
  `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGuildRosterSyncAtLogon.cmd`.

## Cinematic Intro Session

- Moved the new root `Veo.mp4` into `animations/source/Veo.mp4`.
- Added generated intro assets under:
  - `animations/desktop/`
  - `animations/mobile/`
  - `animations/posters/`
  - mirrored web-served copies in `public/animations/`
- Rendered desktop 16:9 WebM and MP4 variants at 1080p, 1440p, and 4K.
- Rendered mobile 9:16 WebM and MP4 variants at 720x1280, 1080x1920, and 1440x2560.
- Generated `desktop-poster.jpg` and `mobile-poster.jpg`.
- Added reusable render scripts:
  - `scripts/render-intro-videos.ps1`
  - `scripts/render-intro-videos.sh`
- The FFmpeg pipeline removes the bottom-right Veo watermark by cropping only; no AI watermark removal is used.
- Replaced old `/intro/pizza-logs-cinematic-*` references with responsive `/animations/...` assets.
- Intro runtime now selects one responsive variant, prefers WebM/VP9, falls back to H.264 MP4, uses posters, and preloads the selected video.
- Intro videos now preserve audio tracks: Opus for WebM and AAC for MP4.
- Intro now respects `prefers-reduced-motion`, supports skip and sound toggling, plays on full page load or browser refresh, and stays dismissed during normal in-app link navigation.
- Intro brand text is larger and positioned about 15% down from the top while remaining horizontally centered.
- Removed obsolete `public/intro/` generated assets.
- Updated README, `docs/intro-animation.md`, `AGENTS.md`, `.gitignore`, source tests, and vault notes.

## ICC Difficulty Marker Session

- Investigated latest mixed ICC raid labels where Deathbringer Saurfang was shown
  heroic despite being normal, and Valithria Dreamwalker was shown normal despite
  being heroic.
- Root cause: `Rune of Blood` was treated as a Saurfang heroic-only marker, but it
  appears in normal Saurfang. Valithria had no `Twisted Nightmares` heroic marker.
- Replaced the global heroic marker set with boss-scoped marker matching.
- Removed Saurfang `Rune of Blood` from heroic evidence.
- Added Saurfang heroic `Scent of Blood` spell ID markers `72769` and `72771`.
- Added Valithria heroic `Twisted Nightmares` spell ID markers `71940` and `71941`,
  plus name matching.
- Added focused parser regression tests for Saurfang `Rune of Blood`, Saurfang
  `Scent of Blood`, and Valithria `Twisted Nightmares`.
- Updated `docs/parser-contract.md` and known-issues notes.

## Session Player Chart Session

- Updated the session player comparison line chart to exclude wipe pulls.
- Added `lib/session-player-chart.ts` as the chart-data builder so kill-only
  filtering is covered outside the page component.
- Added `tests/session-player-chart.test.ts` proving wipe-only bosses do not
  appear in chart data and missing classmates remain `null` on kill pulls.
- The Encounter Breakdown list remains unchanged and still shows wipes.

## Guild Roster Pagination Session

- Updated the public guild roster page to read `?page=` and pass the current page into the roster table.
- Limited the roster table to 20 visible members per page.
- Kept the table inside a bordered panel with a footer navigator in the bottom-right area.
- Added previous/next icon navigation with accessible labels and stable `/guild-roster?page=N` links.
- Updated the guild roster render test to prove page 1 shows rows 1-20 and page 2 shows rows 21-25 for a 25-member roster.

## Windows Tooling Session

- Audited Neil's local Windows development tooling from `C:\Projects\PizzaLogs`.
- Confirmed GitHub CLI auth succeeds for `CRSD-Lau`; `origin` points to `https://github.com/CRSD-Lau/Pizza-Logs.git`; `codex-dev` tracks `origin/codex-dev`.
- Confirmed the repo uses `package-lock.json`; clean installs should use `npm ci --legacy-peer-deps`.
- Installed PowerShell 7.6.1 with WinGet.
- Installed standalone `ripgrep`, `fd`, and `jq` with WinGet.
- Prioritized WinGet package directories in User PATH so `rg` no longer resolves to the Codex app bundle that failed with `Access is denied`.
- Added repeatable tooling scripts:
  - `scripts/dev/setup-tooling.ps1`
  - `scripts/dev/verify-tooling.ps1`
- Added `docs/dev/TOOLING.md` and linked it from the README Local Development section.
- Railway CLI is present, but this checkout is not linked; no Railway deploy or link was performed.
- Added a tiny docs-only PR notification test note to `docs/dev/TOOLING.md` after Neil configured `PR_SLACK_WEBHOOK_URL`, so a fresh pull request can trigger the Slack workflow.
- Cleaned up `.github/workflows/pr-slack-notify.yml` Slack blocks after the test message proved too raw: compact header/context, metadata fields, trimmed description, shorter changed-file list, and ASCII-safe separators.
- Normalized GitHub PR description markdown for Slack by converting markdown headings to bold labels and collapsing noisy whitespace.

## Verification This Session

### Full site and ticket audit

- Verified all primary public routes, protected admin redirects, deep session/encounter/player pages, player search, roster pagination, client navigation, and the mobile menu against Railway production.
- Verified 375x812 layouts have no document-level horizontal overflow; the roster table scrolls only inside its container.
- Verified basic accessible naming and heading/image coverage on eight primary routes.
- Confirmed ticket #1 is addressed by the per-attempt detector and its heroic-wipe/normal-kill regression, but should remain open until deployment and re-upload verification.
- Confirmed tickets #2 and #3 behavior on production; ticket #3 has a stale copied closure comment.
- Fixed React hydration error #418 by formatting leaderboard dates in UTC on both server and browser.
- Updated Next.js and `eslint-config-next` from 15.5.15/15.0.3 to 15.5.23.
- Reconciled stale lockfile-only `cross-env`/`vitest` entries; a clean `npm ci --legacy-peer-deps` succeeded.
- Focused date and archive tests, TypeScript, ESLint, production build, Python `pip check`, and all 280 parser tests passed.

### Difficulty and archive upload

- Added the complete reference spell-rank families as canonical boss/mode sets, including every Faction Champions alternative.
- Added per-attempt conflict handling, Ulduar hard-mode rules, `UNKNOWN` ranking protection, and detector metadata.
- Added raw UUID upload states, safe ZIP member streaming, hard resource limits, bounded worker queues, and status inspection.
- Parser suite passed with 280 tests and one existing Pydantic deprecation warning.
- TypeScript type-check, ESLint, focused archive source test, and Next.js production build passed.
- The 30 MiB-class benchmark passed the two-second quick-result target at 1,926.60 ms after the final byte.
- Actual browser-facing flow passed through Next.js, parser, and local PostgreSQL: quick `25H`, final `DONE`, one encounter inserted. The exact local test upload was deleted and verified absent afterward.

| Check | Result |
|---|---|
| README and wiki wording scan | Passed for updated public docs; no em dashes or AI-obvious wording patterns found |
| Local README screenshot capture | Passed from fresh Next dev server on `http://127.0.0.1:3004`; parser service was listening on `127.0.0.1:8000` |
| FFmpeg render script | Passed; all root and public animation variants generated |
| Rendered frame inspection | Passed; watermark absent in desktop and mobile preview frames |
| FFprobe audio stream inspection | Passed; generated WebM and MP4 variants include audio streams |
| In-app browser preview | Passed; video paints, skip fades out, and the audio toggle changes from play to mute |
| Intro replay behavior | Passed; initial load shows intro, site link navigation does not replay it, browser refresh replays it |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\frozen-intro-source.test.ts` | Passed |
| `node node_modules\typescript\bin\tsc --noEmit` | Passed |
| `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | Passed |
| `npm run build` from clean `.next` | Passed |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\verify-tooling.ps1` after workflow cleanup | Passed with 0 failures; canonical checkout, remote, branch, upstream, and local branch parity all passed; 1 intentional Railway-unlinked warning |
| `npm run check:pr` after workflow cleanup | Passed: ESLint, TypeScript, and Next.js 15.5.23 production build |
| Active stale-path and retired-sync exclusion scan | Passed; no active laptop, OneDrive checkout, `.env.sync-agent`, `.sync-agent-dist`, or standalone `sync-agent` references remain outside historical archives/user-owned instructions |
| GitHub `Production main` ruleset inspection | Passed; PR, `test-build`, deletion, and non-fast-forward rules are active on the default branch |
| Railway production route probe after cleanup push | `/`, `/raids`, `/leaderboards`, `/players`, `/guild-roster`, and `/weekly` returned 200; `/admin` and `/uploads` returned protected 307 redirects; no public `/api/health` route is defined |
| `git diff --check` after Slack workflow formatting cleanup | Passed |
| Guild roster render test with JSX-aware `ts-node` registration | Passed |
| `node node_modules\typescript\bin\tsc --noEmit` | Passed |
| `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | Passed |
| `npm run build` | Passed |
| Local Warmane API probe from PowerShell | Returned expected HTTP 403, confirming browser-assisted automation is still needed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\gear-sync-windows-task-source.test.ts` | Passed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -WhatIf` | Passed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1` | Passed; registered `PizzaLogsGearSync` and created Startup launcher |
| `schtasks.exe /Query /TN PizzaLogsGearSync /FO LIST /V` | Passed; task is ready and repeats every 1 hour |
| Startup launcher content check | Passed; points at `scripts\gear-sync\open-warmane-gear-sync.ps1` |
| `npx ts-node --project tsconfig.seed.json tests\guild-roster-client-scripts.test.ts` | Passed |
| `npx ts-node --project tsconfig.seed.json tests\guild-roster-sync-windows-task-source.test.ts` | Passed |
| `npx ts-node --project tsconfig.seed.json tests\gear-sync-windows-task-source.test.ts` | Passed |
| `npx ts-node --project tsconfig.seed.json tests\local-userscript-routes.test.ts` | Passed |
| JSX-aware `tests\guild-roster-admin-panel.test.ts` | Passed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\guild-roster-sync\install-windows-task.ps1 -WhatIf` | Passed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\guild-roster-sync\uninstall-windows-task.ps1 -WhatIf` | Passed; missing task/startup launcher is a clean no-op |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\uninstall-windows-task.ps1 -WhatIf` | Passed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\guild-roster-sync\install-windows-task.ps1` | Passed; registered `PizzaLogsGuildRosterSync` and created Startup launcher |
| `schtasks.exe /Query /TN PizzaLogsGuildRosterSync /FO LIST /V` | Passed; task is ready and repeats every 1 hour |
| Guild roster startup launcher content check | Passed; points at `scripts\guild-roster-sync\open-warmane-guild-roster-sync.ps1` |
| `npx ts-node --project tsconfig.seed.json tests\armory-gear-client-scripts.test.ts` | Passed for Gear Sync `1.8.1` in-tab hourly timer |
| `npx ts-node --project tsconfig.seed.json tests\guild-roster-client-scripts.test.ts` | Passed for Guild Roster Sync `1.1.1` in-tab hourly timer |
| `npx ts-node --project tsconfig.seed.json tests\gear-sync-windows-task-source.test.ts` | Passed for hidden VBS startup launcher behavior |
| `npx ts-node --project tsconfig.seed.json tests\guild-roster-sync-windows-task-source.test.ts` | Passed for hidden VBS startup launcher behavior |
| `npx ts-node --project tsconfig.seed.json tests\local-userscript-routes.test.ts` | Passed for local userscript versions |
| JSX-aware `tests\gear-import-bookmarklet.test.ts` | Passed |
| JSX-aware `tests\guild-roster-admin-panel.test.ts` | Passed |
| Quiet gear launcher install | Passed; removed `PizzaLogsGearSync`, removed `.cmd`, created `.vbs` |
| Quiet guild roster launcher install | Passed; removed `PizzaLogsGuildRosterSync`, removed `.cmd`, created `.vbs` |
| `schtasks.exe /Query /TN PizzaLogsGearSync` | Passed; task is absent |
| `schtasks.exe /Query /TN PizzaLogsGuildRosterSync` | Passed; task is absent |
| Startup VBS content checks | Passed; both use `powershell.exe -WindowStyle Hidden` with escaped script and target URL arguments |
| Startup folder inspection after auto-open removal | Passed; no Pizza Logs startup files remain |
| Scheduled task search after auto-open removal | Passed; no Pizza Logs/Warmane scheduled tasks remain |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -WhatIf` | Passed; default cleanup creates no launcher |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\guild-roster-sync\install-windows-task.ps1 -WhatIf` | Passed; default cleanup creates no launcher |
| Default gear cleanup script run | Passed; no Windows auto-open launcher created |
| Default guild roster cleanup script run | Passed; no Windows auto-open launcher created |
| Local `GET http://127.0.0.1:3001/guild-roster?page=2` | Passed with HTTP 200 after dev server compile |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\armory-gear-client-scripts.test.ts` | Passed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\guild-roster-client-scripts.test.ts` | Passed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\local-userscript-routes.test.ts` | Passed |
| Gear/admin panel JSX-aware `ts-node` test | Passed |
| Guild roster/admin panel JSX-aware `ts-node` test | Passed |
| Local userscript endpoint version/key check | Passed for gear `1.7.1` and roster `1.0.5` |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\armory-gear-queue.test.ts` | Passed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\armory-gear-missing-route.test.ts` | Passed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\armory-gear-client-scripts.test.ts` | Passed |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\local-userscript-routes.test.ts` | Passed |
| JSX-aware `tests\gear-import-bookmarklet.test.ts` | Passed |
| `node node_modules\typescript\bin\tsc --noEmit` | Passed |
| `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | Passed |
| `npm run build` | Passed |
| `node node_modules\typescript\bin\tsc --noEmit` | Passed |
| `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | Passed |
| `npm run build` | Passed |
| `python -m pytest tests/test_parser_core.py -k "saurfang_rune_of_blood or saurfang_scent_of_blood or valithria_twisted_nightmares" -v` | Failed before fix with the expected three difficulty assertions |
| `python -m pytest tests/test_parser_core.py -k "saurfang_rune_of_blood or saurfang_scent_of_blood or valithria_twisted_nightmares or heroic_detected_with_encounter_start" -v` | Passed |
| `python -m pytest tests/ -v` from `parser/` | Passed: 136 passed, 1 existing Pydantic deprecation warning |
| `node node_modules\ts-node\dist\bin.js --project tsconfig.seed.json tests\session-player-chart.test.ts` | Failed before helper existed, then passed after implementation |
| `node node_modules\typescript\bin\tsc --noEmit` | Passed |
| `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | Passed |
| `npm run build` | Passed |
| Local `GET http://127.0.0.1:3001/raids/chart-fixture-upload/sessions/0/players/Lausudo` | Passed with HTTP 200 against a local-only chart fixture |
| In-app browser route load for local chart fixture | Passed page identity and console checks; screenshot capture timed out in the browser runtime |

## Remaining Risks

- Source `Veo.mp4` is 1280x720, so 1440p/4K variants are upscale derivatives rather than native high-resolution renders.
- Local visual validation covered desktop in the in-app browser plus extracted mobile frames; test devices should still smoke-check iPhone Safari and Android Chrome after deployment.
- Upload concurrency limits are process-local; multiple Railway parser replicas would need a shared limiter if production traffic warrants it.
- Archive upload accepts ZIP plus raw text/log files; 7z/RAR/tar remain unsupported.
- The two-second benchmark uses explicit encounter markers. Privacy-safe real Warmane heuristic-log timing still needs observation and may be slower.
- PR Slack notifications still require `PR_SLACK_WEBHOOK_URL` in GitHub repository secrets, but missing configuration no longer fails PR checks.
- `pull_request_target` runs the Slack workflow from `main`, so Slack formatting changes only affect fresh PR events after the workflow update is merged.
- Absorbs are implemented conservatively, but real overlapping-shield logs are still needed to calibrate attribution coverage.
- Railway CLI is installed locally but this checkout remains unlinked until Neil intentionally runs `railway link`.
- Hourly full gear and roster refreshes depend on a local Windows user/browser
  profile with the production userscripts installed and the correct admin secret
  saved.
- Hourly browser timers need the Warmane gear/roster tabs to remain open. If a
  tab is closed, refresh resumes after Neil opens it again.
- Browser background-tab throttling can delay a sync while the browser or PC is
  suspended.

## Platform And Analytics Release Gate

- Clean `npm ci --legacy-peer-deps` completed with 0 vulnerabilities.
- `npm run check:pr` passed: zero-warning ESLint, TypeScript 7 native check,
  TypeScript 6 ecosystem check, all 37 TypeScript tests, and the Next.js 16
  production build.
- All 293 parser tests passed and `pip check` found no broken requirements.
- Prisma 7.9 client generation and schema validation passed.
- CI now generates the ignored Prisma 7 client before type-checking, matching a
  fresh checkout instead of relying on a developer's existing generated output.
- PR #29's replacement clean Linux job passed Prisma generation, lint, both
  TypeScript gates, all web tests, all parser tests, and the Next production
  build.
- The final Node 24 Docker image built successfully and contains the Prisma 7
  CLI plus the Linux schema engine required by production migration startup.
- The actual local web -> parser -> PostgreSQL upload flow completed, persisted
  the new analytics, rendered the stored encounter, and cleaned its exact test
  row afterward.
- The current Railway production site passed the public-route/API/protected-
  redirect smoke suite. The upgraded release remains undeployed until Neil
  merges the PR into `main`.
- The UwU parity repair passed TypeScript 7, the TypeScript 6 ecosystem gate,
  zero-warning ESLint, all 37 web tests, the Next.js 16 production build, and
  all 293 parser tests. A local production-mode browser walkthrough passed for
  `/raids`, `/leaderboards`, and `/guild-roster`; the local database contains no
  copy of the linked historical report.
- The follow-up whole-slice repair passes all 295 parser tests and all 37 web
  tests. A localhost raw upload persisted `sessionAnalytics`, rendered the
  Custom Slice table and exact `0:00:29.100` duration without runtime errors,
  and the exact temporary upload and browser artifacts were removed afterward.
- Production migration risk is additive and low: one nullable
  `uploads.sessionAnalytics JSONB` column. Existing reports are untouched and
  continue to use the legacy fallback until their source log is re-uploaded.

## Exact Next Step

Review the frontend audit remediation PR from `codex-dev` into `main`. Railway
will deploy only after Neil merges it. After deployment, smoke-check one
populated session and encounter on a real mobile browser, then continue the
existing UwU re-upload acceptance step for historical parser data. Codex does
not merge or push `main` directly.
