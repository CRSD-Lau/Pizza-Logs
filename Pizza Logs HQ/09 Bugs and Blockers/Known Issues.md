# Known Issues

## Active Bugs

Railway production currently returns HTTP 502 after PR #29 because the Prisma 7
runtime image omitted `prisma.config.ts`. The Docker hotfix is locally verified
through the actual migration/startup path and requires an emergency PR merge.

## Active Limitations And Blockers

| Issue | Impact | Current approach |
|---|---|---|
| Upload concurrency limits are process-local | Multiple Railway parser replicas do not share one global queue/rate limit | Keep bounded per-process quick/full pools; add a shared limiter only if production scaling requires it |
| Archive upload supports ZIP, not 7z/RAR/tar | Users must create a ZIP or upload the raw text/log | Add another format only with equivalent streaming and security validation |
| Absorb attribution is conservative | Fully absorbed missed events without numeric amounts remain unmeasurable; overlapping shields can be ambiguous | Keep absorbs separate from healing, mark multi-shield hits ambiguous, and retain unattributed totals instead of guessing |
| Spec/role evidence can be absent | Short pulls or unobserved signature spells can leave a spec unset or role conservative | Use observed spell, healing, output, and damage-taken evidence; never force a spec from weak evidence |
| UwU boss-specific useful/mechanic reports are not universal | Generic target damage exists, but Valkyr grabs, Defile targets, and opinionated boss-specific useful formulas are not all first-class reports | Add one boss rule at a time with Warmane fixtures and keep it supplemental to Skada totals |
| Warmane direct server fetches can fail with Cloudflare/403 | Gear/roster refreshes are unreliable from Railway or plain CLI requests | Supported path is browser-assisted userscripts running in existing Warmane tabs and cached DB snapshots |
| Hodir Hard Mode and Sartharion drake modes are unsupported | Those attempts cannot be ranked by an auditable mode | Return `UNKNOWN` until explicit evidence rules exist |
| Orphaned pets can remain unmatched | Small DPS mismatches when pets were active before log start | Keep Skada-aligned owner remap when summon evidence exists |
| Migration history began after the original schema was created by `db push` | A brand-new empty database is not reconstructable from migrations alone | Existing production is supported by `start.sh` migration baselining; create and rehearse a greenfield baseline before provisioning a replacement database |

## Resolved Reference

| Issue | Resolution |
|---|---|
| Prisma 7 Railway image returned 502 after PR #29 | The runtime image omitted `prisma.config.ts`, so `migrate deploy` had no datasource URL; Docker now copies the config and the actual startup path is container-tested |
| GitHub `main` rules only blocked deletion and force-pushes | Renamed the ruleset to `Production main` and required a pull request plus a passing `test-build` check |
| Active docs still pointed to the retired laptop/OneDrive checkout | Standardized the supported path on `C:\Projects\PizzaLogs` and added canonical checkout, remote, branch, upstream, and parity checks to the tooling verifier |
| Retired standalone `sync-agent` build/env exclusions remained | Removed the unused TypeScript and dist exclusions; generic `.env.*` protection now covers local secret files while current browser-sync logs remain ignored |
| HPS zero on all encounters | Fixed `SPELL_HEAL` field handling and effective heal formula |
| Post-fight tail lowered DPS | KILL duration now uses boss death timestamp |
| Valithria kills parsed as wipes | Green Dragon Combat Trigger death evidence added |
| Gunship kills parsed as wipes | Warmane crew-death override added |
| Gunship cannon counted as pet | `0xF15*` vehicle GUIDs excluded from pet handling |
| Public upload telemetry exposed raw filenames | Upload history/detail moved behind admin; public upload routes redirect |
| Admin had no auth | `ADMIN_SECRET`, middleware, login action, and admin API checks added |
| Runtime Wowhead item enrichment | Removed; local AzerothCore `wow_items` import backs item metadata |
| Gear cards had metadata but missing icons | Gear queue treats icon gaps as enrichment needs and backfills `wow_items.iconName` |
| Roster rank/professions were blank | Warmane HTML-first roster parsing handles guild-summary links and `Image:` labels |
| Roster-only members had no profiles | Player profiles can resolve from `guild_roster_members` |
| Hunter weapon GearScore display/total mismatch | Raw item display scores and hunter weapon total behavior corrected |
| Mixed-content gear icons | Warmane CDN icon URLs normalize to HTTPS |
| Favicon 404 | Added `public/favicon.ico` and `app/icon.svg` |
| Local dev DB outage crashed pages | Public/admin pages catch DB connection failures and show warnings |
| Local 3001 server missing `.next` chunks | Stopped stale Next process, removed generated `.next`, restarted `PizzaLogsLocalTestServer`, and verified local page/scripts return 200 |
| Portrait userscript stayed on class icons or caused hydration warnings | Retired active portrait capture and standardized avatars on class icons; old userscript URLs now serve no-op compatibility updates |
| Repeating local scheduled task caused recurring PowerShell popups | Disabled `PizzaLogsLocalTestServer`; added Desktop start/stop launchers for web, parser, and PostgreSQL |
| Parser silently skipped malformed lines | Added tokenizer-level skipped-line accounting and aggregate parser warnings |
| Parser `/parse-stream` accepted unsupported filenames | Added `.txt`/`.log` filename validation before temp-file handling |
| Short explicit marker pulls could be discarded | Marker-based encounters now bypass the heuristic minimum-event floor |
| Heroic wipes could promote later normal kills | Non-Gunship `25N` pulls no longer inherit heroic solely from same-session evidence |
| Saurfang/Valithria heroic labels drifted on mixed ICC raids | Removed normal-mode `Rune of Blood` as a Saurfang heroic marker, added ID-based Saurfang `Scent of Blood`, and added Valithria `Twisted Nightmares` heroic detection |
| Session player DPS/HPS chart included wipe pulls | Chart data now uses kill encounters only while the Encounter Breakdown continues showing all pulls |
| Cinematic intro overlay existed but stayed invisible | Replaced dynamically composed Tailwind phase class with static class strings so `frozen-intro-overlay--showing` is emitted |
| Cinematic intro audio was missing | Render scripts preserve audio tracks, and the intro overlay now has a sound toggle while still starting muted for autoplay |
| Missing PR Slack webhook failed PR checks | Workflow now warns and exits successfully when `PR_SLACK_WEBHOOK_URL` is absent |
| Local `rg` resolved to Codex app bundle and failed with Access denied | Installed standalone `ripgrep` with WinGet and prioritized its package directory in User PATH via `scripts/dev/setup-tooling.ps1` |
| PR Slack message read like a raw dump | Reworked Slack blocks into a compact header, metadata fields, trimmed description, and cleaner changed-file list |
| PR description headings showed unsupported Slack markdown | Added markdown normalization so GitHub headings become Slack bold labels |
| Local and production Warmane userscripts shared the same saved admin secret | Gear `1.7.1` and roster `1.0.5` now use target-specific localStorage keys, show the target host, and clear the legacy shared key on unauthorized responses |
| Gear Sync skipped already cached characters | Gear `1.8.0` requests refresh-all mode hourly so complete cached players are refreshed from Warmane too |
| Gear Sync only ran when Neil manually visited Warmane | Gear `1.8.1` auto-runs hourly inside an existing Warmane tab with a saved target secret; hidden Startup launcher opens the page at logon |
| Guild Roster Sync only ran when Neil manually visited Warmane | Roster `1.1.1` auto-runs hourly inside an existing Warmane tab with a saved target secret; hidden Startup launcher opens the guild page at logon |
| Windows sync uninstall scripts errored when no task existed | Gear and roster uninstall scripts now treat missing scheduled tasks/startup launchers as clean no-ops |
| Warmane sync opened recurring tabs and flashed command prompts | Gear `1.8.1` and roster `1.1.1` schedule hourly runs inside existing Warmane tabs; old hourly scheduled tasks and visible `.cmd` launchers were removed |
| Hidden Warmane Startup launchers could still open Chrome tabs | Local Startup launchers were removed, and installer defaults now clean old tasks/launchers without creating any Windows auto-open entry |
| Difficulty used first-match or Normal fallback evidence | Added per-attempt `pizza-difficulty-v2` with complete boss/mode spell sets, Ulduar rules, conflict detection, auditable metadata, and `UNKNOWN` ranking protection |
| Upload had no archive security or early classification | Added one-request UUID streaming, incremental SHA-256, atomic finalization, ZIP safety limits, quick results, bounded full workers, timeouts, and abandoned-file cleanup |
| Leaderboard and boss pages emitted React hydration error #418 | Leaderboard short dates now use an explicit UTC timezone on the server and browser |
| Next.js 15.5.15 had direct middleware/server-action security advisories | Pinned Next.js and `eslint-config-next` to the current 15.x backport, 15.5.23 |
| Next.js 15/transitive production advisories remained | Upgraded Next.js to 16.3 with React 19.2 and reached `npm audit` zero |
| Absorbs were missing | Added separate total absorbs/APS, shield breakdown, ambiguous-hit labeling, and encounter unattributed totals without changing healing |
| Upload-time role inference could not identify tanks | Added observed WotLK spec signatures plus healing/damage-taken role evidence; uncertain cases remain conservative |
| Analytics lacked aura, consumable, power, and death context | Added per-player aura uptime, curated consumables, energize gains, and death timelines with preceding incoming damage |
| New compiler transforms broke serialized browser userscripts in tests | Added a self-contained function serializer and full VM execution coverage; generated scripts no longer depend on module-scoped compiler helpers |
| Fresh CI checkout type-checks saw Prisma query results as `any` | CI now runs `npm run db:generate` before lint and both TypeScript gates |

## Not Bugs

- uwu-logs differences are expected when uwu uses different encounter windows or damage math.
- Warmane live fetch failure is expected; cached/browser-assisted import is the supported path.
- Rendered portraits are intentionally not used; class icons are the supported avatar path.
