# Now

## Active Focus

The current `codex-dev` candidate completes the first-party Warmane data path. Class avatars are 44px controls with a gear badge; hover, keyboard focus, or tap lazily loads current equipment, class/race/guild identity, GearScoreLite, average item level, freshness, and an isolated dressed 3D model on desktop through Pizza Logs. The public route only accepts known players/roster members, uses a five-minute cache, and falls back to the last healthy snapshot. Guild roster refresh is now an authenticated `/admin` action. Tampermonkey, bookmarklets, open Warmane tabs, and browser-stored admin secrets are not part of the active architecture.

The current `codex-dev` candidate also completes the frontend audit remediation: readable metadata, shared page and surface contracts, asymmetric result hierarchy, paginated/progressively disclosed long reports, accessible 44px interactions, responsive analytics rows, and a homepage-only once-per-session cinematic intro. `DESIGN.md` is the implementation contract for follow-up UI work.

The current release candidate completes the ordered platform modernization: analytical regression baselines, Node 24 everywhere, current Actions/dependencies, Next.js 16 + React 19, Prisma 5 -> 6 -> 7, Tailwind/Recharts/Zod/Dropzone majors, and a gated TypeScript 7 native CLI. Parser reliability remains the highest-risk product area, so frozen Skada totals and the complete parser suite remain mandatory.

UwU analytical feature parity now includes the default whole-log Custom Slice. New uploads store raw Total Damage, effective healing plus attributed absorbs, raw Damage Taken, exact first-to-last-event duration, and the same per-player columns/rates. Wipes, trash, between-pull activity, and downtime stay in the slice. Useful/effective damage remains a separate analytical primitive.

The linked 2026-07-31 Lausudo report now has a frozen five-pull acceptance baseline. The follow-up repair removes the mixed-grain session cards entirely, fixes the raw damage formula, adds full-log healing/absorbs/taken and exact duration, and tightens pull ends to boss-destination events. Historical rows require re-upload and are not rewritten.

Workflow cleanup established one supported path: the desktop checkout at `C:\Projects\PizzaLogs` on `codex-dev` -> `origin/codex-dev` -> PR -> `origin/main` -> Railway. No laptop, OneDrive clone, Claude worktree, or direct Railway deployment is part of the active development workflow.

README visual refresh: added a high-resolution `docs/assets/readme-screenshot.png` preview to the public README. The screenshot was captured from a fresh local Next dev server on `http://127.0.0.1:3004` while the parser service was listening on `127.0.0.1:8000`.

Documentation metadata refresh: the README now links to the GitHub wiki, and the wiki has been rewritten with current upload, roster, gear, parser, roadmap, and branch workflow details.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. When every required CI check passes and no conflict or explicit blocker remains, Codex merges the PR through GitHub without waiting for manual review. Codex never commits or pushes `main` directly and never bypasses required checks.

## This Session

- Merged PR #39 after its required CI passed, then changed the standing release rule so Codex automatically merges future green PRs without waiting for Neil's review.
- Kept `main` protected: work still originates on `codex-dev`, every change still goes through a PR, and failing or pending required checks still block the merge.
- Found that Railway reports the production environment as `Pizza Logs / production`, causing the exact-name Production Smoke condition to skip; changed it to a suffix match and added a source regression test.
- The newly active smoke run exposed Railway's dashboard URL being mistaken for the app URL; pinned deployment-triggered checks to the canonical Pizza Logs production address and retained the manual-dispatch override.
- Replaced the desktop gear list with a WoW-style equipment paper doll: armor slots on both sides, weapons below, and a central class/race/GearScore panel; mobile keeps the full two-column list.
- Verified Warmane exposes character customization as a WebGL recipe rather than a portrait image, parsed its bounded appearance/display fields, and rendered the dressed model in a script-only sandbox with a class-icon fallback.
- Confirmed the local Lausudo quick look visibly renders the Human female model with armor, weapon, and shield; mobile does not load the model viewer.
- Fixed the gear quick-look overlay so complete 18-19 slot loadouts fit instead of clipping the weapon rows; it now uses two columns on narrow screens and three across a wider desktop panel.
- Replaced the ambiguous gear-cache error total with the latest successful live-refresh timestamp in UTC and renamed the total to Cached Snapshots.
- Added a protected, confirmation-gated Clear Gear Cache control that deletes only Armory gear snapshots.
- Live-tested production: Maximusboom refreshed non-stale with 19 items and GearScore 6,245; Azyia demonstrated the intended stale-snapshot fallback during an individual Warmane failure.
- Kept production data intact because the local Railway CLI login is expired; the new admin control is the safe reset mechanism after deployment.
- Passed 36 web tests, both TypeScript gates, zero-warning ESLint, and the Next.js 16 production build.

- Added `GET /api/players/[name]/gear` as the bounded public read path for known Pizza Logs characters.
- Extended Armory snapshots with optional class, race, and guild identity returned by Warmane.
- Turned class avatars into accessible live-gear quick-look controls and added class icons to encounter meters.
- Added quick looks to player profiles, the player directory, session raid rosters, encounter rosters, and guild roster rows.
- Removed gear/roster userscript controls and import APIs from admin; the roster now has a first-party authenticated refresh button.
- Removed scheduled-task installers and Warmane tab launchers while retaining uninstall-only cleanup commands for previously configured machines.
- Converted the old gear/roster userscript update URLs to inert version `2.0.0` retirement scripts that make no network calls and clear browser-stored Pizza Logs secrets.
- Live-verified the direct Pizza Warriors roster fetch with 163 members and class/rank data.
- Passed `npm run check:pr` with 35 tests, both TypeScript gates, zero-warning ESLint, and the Next.js 16 production build; authenticated local admin rendering also passed with a 44px refresh control, no overflow, and no console errors.
- Verified a live local Lausudo response with 18 items, Paladin/Human/Pizza Warriors identity, GearScore 6,267, average item level 270, and a fresh snapshot.
- Passed 40 web tests, TypeScript 7, TypeScript 6 ecosystem checking, zero-warning ESLint, and the Next.js 16 production build. No parser, Prisma schema, or migration changed.

- Completed the full frontend audit remediation without changing parser or persistence behavior.
- Added shared `PageShell`, `PageHeader`, `PageSection`, and `DataPanel` primitives and standardized page rhythm across the app.
- Raised metadata contrast, removed meaningful 9-11px microtext, and replaced component-level school/gold literals with design tokens where equivalents exist.
- Reworked metric hierarchy on home, weekly, session, and encounter views; secondary data now uses quieter surfaces and closed disclosures.
- Paginated `/players` at 30 profiles, collapsed bosses without activity, and made leaderboards one-boss-at-a-time disclosures.
- Converted damage/target rows to keyboard-operable buttons with `aria-expanded`; mobile analytics use compact two-column summaries.
- Enforced 44px controls and corrected the upload form to a deliberate one-column mobile layout.
- Changed the cinematic intro to homepage-only, once per browser session, with deep routes bypassing it.
- Added `DESIGN.md` and `tests/frontend-foundations-source.test.ts`; TypeScript, all 38 web tests, ESLint, production build, and desktop/mobile browser checks pass.

- Confirmed from UwU revision `f32f00e917ad6baba9012704dc9e41afe578426d` that its default report is one first-to-last-event Custom Slice, not a sum of boss pulls and not a kill-only view.
- Corrected headline damage to raw event `amount`: no overkill subtraction and no absorbed-field addition. Kept useful/effective damage as a separate formula.
- Added streaming whole-session analytics for Total Damage, effective healing, attributed absorbs, Heal, Damage Taken, exact duration, pet-owner attribution, and per-player rows.
- Added the nullable `uploads.sessionAnalytics` JSONB migration and wired parser response, Zod validation, upload persistence, and the public session report.
- Replaced the six mixed-grain session cards with UwU-style Kills/Wipes, Total Damage, Heal, Damage Taken, and exact Duration; added the per-player Custom Slice table and fixed floating-point duration rendering.
- Passed 295 parser tests, 37 web tests, Prisma generation/validation, TypeScript, and a localhost upload/persistence/render walkthrough. The browser screenshot showed the complete table with no runtime error signatures; exact test data and artifacts were removed.

- Inspected UwU revision `f32f00e917ad6baba9012704dc9e41afe578426d` and the linked public report, then recorded its five pull totals and three Saurfang player acceptance checks without copying UwU source.
- Added focused regressions for post-boss trash, multi-hour stale wipe markers, Lady adds, raw damage taken, generic-heal pet theft, permanent-pet propagation, just-removed shields, and critical-Penance Divine Aegis evidence.
- Updated encounter/session/player analytical UI so encounter versus full-log damage is explicit and healing, absorbs, and H+A are comparable without redefining effective healing.
- Passed all 293 parser tests, all 37 web tests, both TypeScript gates, ESLint, the Next.js 16 production build, and a local production-mode public-route walkthrough.
- Reproduced the post-PR #29 Railway 502 in the final Docker image: Prisma 7
  `migrate deploy` could not find `datasource.url` because `prisma.config.ts`
  was absent from the runtime stage.
- Added `prisma.config.ts` to the runtime image and required an actual container
  migration/startup probe before the production hotfix is merged.
- Captured exact pre-upgrade analytical fixture hashes and added a permanent regression gate.
- Standardized Node 24 across `.nvmrc`, package engines, GitHub Actions, Docker, and the Railway web image.
- Upgraded Next.js 16.3/React 19.2 and migrated `middleware.ts` to `proxy.ts` with focused source/admin validation.
- Gated Prisma 6 before migrating to Prisma 7.9, `prisma.config.ts`, generated-client output, and the PostgreSQL driver adapter.
- Upgraded Tailwind 4, Recharts 3, Zod 4, Dropzone 20, tailwind-merge 3, and Lucide; removed unused date-fns.
- Established the TypeScript 7 native CLI plus TypeScript 6 ecosystem API contract; both checks pass.
- Updated FastAPI/Uvicorn/multipart/Pydantic/pytest and removed the Pydantic deprecation warning.
- Added separate absorb/APS, spec/role, aura, consumable, power, and death analytics with focused parser coverage and an additive Prisma migration.
- Added Railway deployment identity to protected Admin diagnostics.
- Added post-deployment and weekly production smoke automation; the current production routes pass the same smoke script.
- Completed the final clean release gate: 37 TypeScript tests, 284 parser tests,
  both TypeScript compiler contracts, zero-warning lint, Next.js production
  build, Prisma generation/validation, Python dependency integrity, npm audit,
  Docker image build, local persisted upload E2E, and live production smoke all
  pass.
- Closed the clean-runner gap found by PR CI: the workflow now generates the
  Prisma 7 client immediately after dependency installation and before lint or
  type-checking.
- Opened draft PR #29 from `codex-dev` to `main`; its replacement clean Linux
  `test-build` job passes after the Prisma generation fix.
- Ran the actual local Next.js -> parser -> PostgreSQL upload flow against the upgraded stack, loaded the stored encounter page, verified protected redirects, and removed the exact temporary upload afterward.
- Audited local worktrees, branches, remotes, ignored legacy artifacts, running processes, scheduled tasks, GitHub branches/rules, PR #28, CI, and Railway deployment boundaries.
- Confirmed there is one worktree, one canonical remote, and only `main` plus `codex-dev` on GitHub; no Claude or laptop development branch remains.
- Preserved current roster/gear browser-sync utilities because they are active product operations, not a retired cross-machine development agent.
- Updated active docs from retired laptop/OneDrive paths to `C:\Projects\PizzaLogs` and made the tooling verifier enforce the canonical checkout, remote, branch, upstream, and branch parity.
- Renamed the GitHub ruleset to `Production main` and made it require a pull request plus the passing `test-build` CI check; deletion and non-fast-forward protection remain active.
- Removed obsolete standalone `sync-agent` build/env exclusions while preserving the active roster/gear browser-sync launchers and their ignored logs.
- Rechecked Railway production after publication: primary public routes return 200 and protected admin/upload routes redirect; the parser's `/health` is internal and there is no public web `/api/health` route.
- Audited all primary Railway routes plus session, encounter, boss, player, protected admin, redirect, search, pagination, and mobile-menu paths.
- Verified 375x812 layouts, contained roster scrolling, accessible names, H1s, and image alternative text.
- Reviewed all three GitHub tickets: #1 remains open pending deployment verification; #2 and #3 behavior pass, though #3 has an incorrect copied closure comment.
- Fixed production React hydration error #418 by making leaderboard dates deterministic in UTC.
- Added `tests/utils-date.test.ts` for a midnight timezone boundary.
- Pinned Next.js and `eslint-config-next` to the patched 15.x backport, 15.5.23.
- Recorded the complete audit in `02 Build Log/2026-08-10 Site and Ticket Audit.md`.
- Re-ran the full validation gate: focused TypeScript tests, type-check, ESLint, production build, Python dependency check, and 280 parser tests all passed.
- Replaced first-match/Normal fallback difficulty logic with `pizza-difficulty-v2` boss/mode spell sets and conflict-to-`UNKNOWN` behavior.
- Added complete ICC, ToC, Ruby Sanctum, VoA/EoE, and supported Ulduar evidence tests, including all Faction Champions alternatives.
- Added Freya three-Elder and Yogg Keeper-count rules, Ulduar size fallback rules, and explicit unsupported Hodir/Sartharion handling.
- Added auditable mode/confidence/evidence/reason/version metadata and prevented `UNKNOWN` attempts from entering kill rankings or milestones.
- Added one-request UUID uploads, incremental SHA-256, atomic finalization, ZIP magic/member/security validation, timeouts, abandoned-file cleanup, and bounded quick/full worker pools.
- Added quick-result SSE and upload state inspection before full report/database processing.
- Added repeatable 30 MiB archive benchmark; final byte to quick result measured 1,926.60 ms and full processing 5,158.69 ms.
- Exercised the actual Next.js -> parser -> local PostgreSQL flow; it returned quick `25H` and final `DONE`, then the exact local test row and temporary files were removed.
- Investigated Neil's report that command prompts interrupted gaming and hourly sync opened too many Warmane tabs.
- Investigated Neil's follow-up that Chrome was still silently opening tabs and using too much memory.
- Confirmed no Pizza Logs scheduled tasks remain.
- Confirmed no Pizza Logs Startup `.cmd` or `.vbs` files remain.
- Updated gear and roster installer defaults to clean old scheduled tasks/startup launchers without creating any Windows auto-open launcher.
- Kept `-RunNow` as an optional one-time page open and `-CreateStartupLauncher` as explicit opt-in only.
- Confirmed the root cause was hourly `powershell.exe` scheduled tasks plus visible `.cmd` Startup launchers.
- Changed Gear Sync and Guild Roster Sync so the browser userscripts schedule the next hourly run inside the already-open Warmane tab.
- Bumped Gear Sync to `1.8.1` and Guild Roster Sync to `1.1.1`.
- Updated Windows installers to remove the old hourly scheduled tasks and create hidden `.vbs` Startup launchers.
- Reinstalled the local quiet launchers; `PizzaLogsGearSync` and `PizzaLogsGuildRosterSync` scheduled tasks are now absent.
- Removed the old Startup `.cmd` files and created `PizzaLogsGearSyncAtLogon.vbs` plus `PizzaLogsGuildRosterSyncAtLogon.vbs`.
- Verified both VBS launchers call `powershell.exe -WindowStyle Hidden`.
- Extended the Guild Roster Sync userscript so saved-secret Warmane guild page visits auto-sync at most once per hour.
- Bumped Guild Roster Sync to `1.1.0`.
- Added Windows guild roster automation scripts under `scripts/guild-roster-sync/`.
- Added `npm run guild-roster-sync:install-task` and `npm run guild-roster-sync:uninstall-task`.
- Added `docs/guild-roster-sync-windows-task.md`.
- Added `tests/guild-roster-sync-windows-task-source.test.ts` and expanded roster userscript/admin/local route coverage.
- Hardened both gear and roster uninstall scripts so missing scheduled tasks/startup launchers are clean no-ops.
- Installed the actual `PizzaLogsGuildRosterSync` hourly task on Neil's Windows machine.
- Created `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGuildRosterSyncAtLogon.cmd`.
- Queried the scheduled task and startup launcher; both point at `scripts\guild-roster-sync\open-warmane-guild-roster-sync.ps1`.
- Investigated the Gear Sync status `No players need import or enrichment.` after Neil clarified that existing DB players should be updated to their current Warmane gear.
- Confirmed the existing queue only returned missing or enrichment-needed cached gear rows.
- Added a refresh-all queue helper that returns all known combat-log players plus PizzaWarriors/Lordaeron roster members, de-duped by character and realm.
- Added `mode: "refresh-all"` support to `/api/admin/armory-gear/missing`; missing-only behavior remains the default for compatibility.
- Updated the Gear Sync userscript hourly path and the bulk bookmarklet fallback to request refresh-all mode.
- Bumped the Gear Sync userscript to `1.8.0`.
- Updated admin copy, README gear wording, feature status, and known-issues notes for hourly current-equipment refreshes.
- Added focused tests for the refresh-all queue, route behavior, userscript request body, bookmarklet fallback, and admin panel copy.
- Ran the focused gear sync tests and local userscript route test; they passed after the implementation.
- Ran `node node_modules\typescript\bin\tsc --noEmit`; it passed.
- Ran `node node_modules\eslint\bin\eslint.js . --max-warnings=0`; it passed.
- Ran `npm run build`; it passed.
- Probed Warmane character JSON with local PowerShell and confirmed it returns HTTP 403 outside a browser context.
- Added Windows Gear Sync automation scripts under `scripts/gear-sync/`.
- Added `npm run gear-sync:install-task` and `npm run gear-sync:uninstall-task`.
- Added `docs/gear-sync-windows-task.md`.
- Added `tests/gear-sync-windows-task-source.test.ts` to verify the task scripts, docs, npm commands, and no scheduled-task secret storage.
- Ran the new source test; it failed before the scripts existed and passed after implementation.
- Ran the install script with `-WhatIf`; the PowerShell ScheduledTasks API path hit access issues, so the installer now uses `schtasks.exe` for the hourly task and a Startup-folder command file for logon.
- Installed the actual `PizzaLogsGearSync` hourly task on Neil's Windows machine.
- Created `C:\Users\neil_\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PizzaLogsGearSyncAtLogon.cmd`.
- Queried the scheduled task and startup launcher; both point at `scripts\gear-sync\open-warmane-gear-sync.ps1`.
- Investigated the latest raid report where Deathbringer Saurfang was normal but displayed heroic, and Valithria Dreamwalker was heroic but displayed normal.
- Confirmed the parser treated `Rune of Blood` as heroic evidence even though it appears in normal Saurfang.
- Confirmed Valithria had no heroic marker for `Twisted Nightmares`.
- Added failing parser tests for Saurfang `Rune of Blood`, Saurfang `Scent of Blood`, and Valithria `Twisted Nightmares`.
- Replaced global heroic marker matching with boss-scoped marker matching.
- Removed Saurfang `Rune of Blood` from heroic evidence.
- Added Saurfang heroic `Scent of Blood` spell IDs `72769` and `72771`.
- Added Valithria heroic `Twisted Nightmares` spell IDs `71940` and `71941`, plus name matching.
- Updated `docs/parser-contract.md`, `Latest Handoff.md`, and `Known Issues.md`.
- Ran focused parser difficulty tests; they failed before the fix and passed after the fix.
- Ran `python -m pytest tests/ -v` from `parser/`; it passed with 136 tests and 1 existing Pydantic deprecation warning.
- Updated the session player comparison chart to build from kill encounters only.
- Added `lib/session-player-chart.ts` and `tests/session-player-chart.test.ts`.
- Confirmed the chart-data test failed before the helper existed and passed after implementation.
- Ran `node node_modules\typescript\bin\tsc --noEmit`; it passed.
- Ran `node node_modules\eslint\bin\eslint.js . --max-warnings=0`; it passed.
- Ran `npm run build`; it passed.
- Created a local-only chart fixture in the local DB and loaded `/raids/chart-fixture-upload/sessions/0/players/Lausudo` with HTTP 200.
- Opened the local fixture route in the in-app browser; page identity and console checks passed, but screenshot capture timed out in the browser runtime.
- Investigated the Warmane userscript status `Sync failed: Unauthorized.`
- Confirmed this was a Pizza Logs admin-secret rejection, not a Warmane verification failure.
- Fixed gear and roster userscripts so production and local installs no longer share the same `pizzaLogsAdminSecret` localStorage key on `armory.warmane.com`.
- Added target-specific storage keys for production and local scripts.
- Added target labels to the injected Warmane panels.
- Changed unauthorized handling to clear the new target key plus the old legacy shared key and explain which target rejected the secret.
- Bumped gear userscript to `1.7.1`.
- Bumped roster userscript to `1.0.5`.
- Verified local userscript endpoints on `http://127.0.0.1:3001` serve the new versions and target-specific keys.
- Ran focused userscript tests; they passed.
- Ran JSX-aware admin panel tests for gear and roster; they passed.
- Ran `node node_modules\typescript\bin\tsc --noEmit`; it passed.
- Ran `node node_modules\eslint\bin\eslint.js . --max-warnings=0`; it passed.
- Ran `npm run build`; it passed.
- Added URL-backed `?page=` handling on `/guild-roster`.
- Updated `GuildRosterTable` to show 20 members per page.
- Added a contained table panel footer with bottom-right previous/next page navigation.
- Updated `tests/guild-roster-table-render.test.ts` to cover 25-member pagination across page 1 and page 2.
- Ran the focused guild roster render test with JSX-aware `ts-node` registration; it passed.
- Ran `node node_modules\typescript\bin\tsc --noEmit`; it passed.
- Ran `node node_modules\eslint\bin\eslint.js . --max-warnings=0`; it passed.
- Ran `npm run build`; it passed.
- Confirmed the existing local dev server at `http://127.0.0.1:3001` served `/guild-roster?page=2` with HTTP 200 after compiling.
- Added a tiny docs-only PR notification test note after Neil configured `PR_SLACK_WEBHOOK_URL`, so opening a fresh `codex-dev` to `main` PR can test the Slack webhook.
- Cleaned up the PR Slack message formatting after the test notification was too dense/raw.
- Adjusted PR description formatting for Slack so GitHub headings render as bold section labels instead of unsupported raw markdown.
- Audited local Windows tooling for PowerShell, WinGet, Git/GitHub, Node/npm/npx, pnpm/yarn, Python/pip, search/JSON tools, curl/tar/ssh, Railway, Vercel, Codex CLI, VS Code CLI, Windows Terminal, repo scripts, GitHub auth, and Railway link state.
- Installed PowerShell 7.6.1 with WinGet.
- Installed standalone `ripgrep`, `fd`, and `jq` with WinGet.
- Fixed User PATH ordering so standalone `rg` is found before the Codex app bundle that failed with `Access is denied`.
- Added `scripts/dev/setup-tooling.ps1` for idempotent local setup and User PATH repair.
- Added `scripts/dev/verify-tooling.ps1` for repeatable audit output, GitHub auth checks, repo health checks, npm script checks, and Railway presence checks without deploying.
- Added `docs/dev/TOOLING.md` and linked it from README Local Development.
- Ran `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\verify-tooling.ps1`; it passed with 0 failures and 1 expected warning that Railway is not linked.
- Moved `Veo.mp4` into `animations/source/Veo.mp4`.
- Added FFmpeg render scripts for PowerShell and bash.
- Rendered desktop intro assets at 1920x1080, 2560x1440, and 3840x2160 in WebM/VP9 and MP4/H.264.
- Rendered mobile intro assets at 720x1280, 1080x1920, and 1440x2560 in WebM/VP9 and MP4/H.264.
- Generated desktop and mobile posters.
- Mirrored generated assets into `public/animations/` for Next.js static delivery.
- Removed the obsolete `public/intro/` asset set.
- Updated the render pipeline to preserve audio tracks as WebM/Opus and MP4/AAC.
- Updated `FrozenLogbookIntro` to choose responsive video assets, preload the selected variant, prefer WebM, fall back to MP4, respect reduced motion, support skip and sound toggling, play on full load/browser refresh, and stay dismissed during normal in-app navigation.
- Adjusted the intro brand text to render larger and sit about 15% down from the top, centered horizontally.
- Removed the localStorage intro-viewed gate so refreshes can replay the intro while client-side navigation stays quiet.
- Fixed a visual QA bug where Tailwind purged a dynamically composed overlay phase class; the component now uses static class strings.
- Updated README, `docs/intro-animation.md`, `AGENTS.md`, `.gitignore`, and `tests/frozen-intro-source.test.ts`.
- Updated `Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md` with the resolved intro overlay purge issue.
- Updated `.github/workflows/pr-slack-notify.yml` so missing `PR_SLACK_WEBHOOK_URL` warns instead of failing PR checks.

## Next Actions

| Task | Status | Notes |
|---|---|---|
| Source video moved | DONE | `animations/source/Veo.mp4` |
| Render scripts | DONE | `scripts/render-intro-videos.ps1`, `scripts/render-intro-videos.sh` |
| Responsive assets | DONE | Root `animations/` plus `public/animations/` mirror |
| Watermark crop validation | DONE | FFmpeg frame inspection passed |
| Intro integration | DONE | Responsive video, preload, fallback, audio toggle, reduced motion, refresh replay with quiet in-app navigation |
| Obsolete still/old intro removal | DONE | Removed `public/intro/` |
| Documentation update | DONE | README, docs, AGENTS, vault |
| Source test | DONE | `tests/frozen-intro-source.test.ts` passed |
| TypeScript | DONE | `tsc --noEmit` passed |
| ESLint | DONE | Passed |
| Production build | DONE | Passed from clean `.next` |
| Browser visual preview | DONE | Desktop in-app browser passed; audio toggle verified; mobile frame extraction passed |
| Slack notification fail-open | DONE | Missing webhook secret now warns and exits successfully |
| Windows tooling setup docs/scripts | DONE | `scripts/dev/setup-tooling.ps1`, `scripts/dev/verify-tooling.ps1`, `docs/dev/TOOLING.md` |
| Tooling verification | DONE | Passed with 0 failures; Railway remains unlinked by design |
| Slack webhook test PR | IN PROGRESS | Docs-only change prepared for a fresh PR event |
| Slack message formatting cleanup | DONE | Workflow now uses compact Slack blocks and cleaner changed-file formatting |
| Slack markdown normalization | DONE | PR description headings convert to Slack-friendly bold labels |
| Guild roster 20-member pages | DONE | `/guild-roster?page=N` controls the visible roster slice |
| Roster table footer navigator | DONE | Previous/next icon links render in the table container footer |
| Guild roster render coverage | DONE | Test covers page 1 and page 2 slicing |
| README app preview | DONE | Added `docs/assets/readme-screenshot.png` and linked it from `README.md` |
| README and wiki metadata refresh | DONE | Updated public README link and GitHub wiki content |
| Browser gear/roster sync retirement | DONE | Active userscripts/import APIs are removed; exact legacy update URLs now serve inert secret-cleanup scripts |
| First-party gear refresh | DONE | Known-character quick looks refresh on demand through Pizza Logs with five-minute caching and stale fallback |
| First-party roster refresh | DONE | Authenticated admin control refreshes the durable Pizza Warriors snapshot directly from Warmane |
| Windows browser-sync cleanup | DONE | Installers/launchers removed; uninstall-only commands remain for previously configured machines |
| ICC difficulty marker fix | DONE | Saurfang `Rune of Blood` stays normal-capable; Saurfang `Scent of Blood` IDs and Valithria `Twisted Nightmares` now mark heroic |
| Session player chart kill filter | DONE | DPS/HPS by encounter chart excludes wipes; Encounter Breakdown still lists all pulls |

## Open Follow-Ups

- Merge the frontend audit remediation PR, confirm the Railway commit and Production Smoke workflow, then re-upload Neil's original ZIP and compare all five pulls against the frozen acceptance baseline. Historical database rows will not update automatically.
- Re-upload an affected mixed heroic/normal raid after deployment and confirm stored difficulties plus the new analytical sections.
- Compare absorbs/spec/role against one privacy-safe real Warmane pull; synthetic and fixture gates pass, but real overlapping-shield evidence is the next calibration input.
- Rehearse a greenfield Prisma migration baseline before provisioning any replacement database; the existing production database remains the supported migration target.
- Measure quick classification on a privacy-safe real Warmane archive without encounter markers; the robust heuristic CSV path may be slower than the marker-based 1.92660-second benchmark.
- Add 7z only if equivalent no-extraction security and resource enforcement can be maintained.
- Add a shared/distributed upload limiter only if Railway uses multiple parser replicas or production traffic warrants it.
- Smoke-check the intro on real iPhone Safari and Android Chrome after the PR is deployed.
- Confirm the fresh docs-only PR posts to Slack now that `PR_SLACK_WEBHOOK_URL` is configured.
- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- After deployment, uninstall the retired Gear Sync and Guild Roster Sync browser scripts and run the two cleanup commands in `docs/userscript-retirement.md` only if old Windows launchers were previously installed.
- After this parser fix deploys, reprocess or re-upload the affected latest raid so stored Saurfang and Valithria difficulties are regenerated.
- Add more encounter-specific useful-damage exclusions as real Skada comparison data becomes available.
- Link Railway with `railway link` only when intentionally working on Railway configuration; do not deploy without explicit instruction.

## Reference

- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Intro pipeline docs: `docs/intro-animation.md`
- Windows tooling docs: `docs/dev/TOOLING.md`
- Parser contract: `docs/parser-contract.md`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Item metadata table: `wow_items`
