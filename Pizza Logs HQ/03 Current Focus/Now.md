# Now

## Active Focus

The current session removed local Windows Warmane auto-open behavior. Direct local CLI requests to Warmane still return 403, so gear and roster refresh now rely on already-open Warmane tabs running the browser userscripts hourly. Parser reliability remains the highest-risk product area.

README visual refresh: added a high-resolution `docs/assets/readme-screenshot.png` preview to the public README. The screenshot was captured from a fresh local Next dev server on `http://127.0.0.1:3004` while the parser service was listening on `127.0.0.1:8000`.

Documentation metadata refresh: the README now links to the GitHub wiki, and the wiki has been rewritten with current upload, roster, gear, parser, roadmap, and branch workflow details.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. Codex does not push or merge `main` directly.

## This Session

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
| Userscript target-specific secrets | DONE | Gear `1.7.1`, roster `1.0.5`; local/prod secrets no longer collide |
| Hourly Gear Sync refresh-all | DONE | Gear `1.8.1` refreshes all known DB/roster characters hourly from an existing Warmane tab |
| Windows Gear Sync auto-open cleanup | DONE | No scheduled task or Startup launcher remains; existing Warmane tab handles hourly sync |
| Windows Guild Roster Sync auto-open cleanup | DONE | No scheduled task or Startup launcher remains; existing Warmane tab handles hourly sync |
| ICC difficulty marker fix | DONE | Saurfang `Rune of Blood` stays normal-capable; Saurfang `Scent of Blood` IDs and Valithria `Twisted Nightmares` now mark heroic |
| Session player chart kill filter | DONE | DPS/HPS by encounter chart excludes wipes; Encounter Breakdown still lists all pulls |

## Open Follow-Ups

- Smoke-check the intro on real iPhone Safari and Android Chrome after the PR is deployed.
- Confirm the fresh docs-only PR posts to Slack now that `PR_SLACK_WEBHOOK_URL` is configured.
- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- After the quiet sync PR deploys, reinstall/update the production Gear Sync and Guild Roster Sync userscripts from `/admin`; keep one Warmane character tab and one guild page tab open for hourly refreshes.
- After this parser fix deploys, reprocess or re-upload the affected latest raid so stored Saurfang and Valithria difficulties are regenerated.
- Absorbs remain future parser work.
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
