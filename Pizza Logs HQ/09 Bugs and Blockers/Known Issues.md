# Known Issues

## Active Bugs

The linked 2026-08-14 raid is a partial stored upload: a coarse encounter
fingerprint collision inserted 23 encounters, omitted the third Blood Prince
Council kill, and prevented finalization. Its Lich King pull was also split at
the scripted 10% roleplay. The parser repair is verified on the source log, but
the existing production row still needs deletion and re-upload after deployment.

## Active Limitations And Blockers

| Issue | Impact | Current approach |
|---|---|---|
| Upload concurrency limits are process-local | Multiple Railway parser replicas do not share one global queue/rate limit | Keep bounded per-process quick/full pools; add a shared limiter only if production scaling requires it |
| Archive upload supports ZIP, not 7z/RAR/tar | Users must create a ZIP or upload the raw text/log | Add another format only with equivalent streaming and security validation |
| Absorb attribution is conservative | Fully absorbed missed events without numeric amounts remain unmeasurable; overlapping shields can be ambiguous | Keep absorbs separate from healing, mark multi-shield hits ambiguous, and retain unattributed totals instead of guessing |
| Existing reports are not automatically reparsed | Historical rows keep the parser output created when they were uploaded | Re-upload the original combat ZIP after a parser deployment to validate and persist the repaired output |
| Exact UwU ZIP is not publicly downloadable | Synthetic regressions prove each repaired behavior, but cannot reproduce every event in the linked report | Use the frozen public five-pull baseline now; Neil's post-merge re-upload is the real-log acceptance gate |
| Spec/role evidence can be absent | Short pulls or unobserved signature spells can leave a spec unset or role conservative | Use observed spell, healing, output, and damage-taken evidence; never force a spec from weak evidence |
| UwU boss-specific useful/mechanic reports are not universal | Generic target damage exists, but Valkyr grabs, Defile targets, and opinionated boss-specific useful formulas are not all first-class reports | Add one boss rule at a time with Warmane fixtures and keep it supplemental to Skada totals |
| Warmane direct server fetches can regress behind Cloudflare/403 | A live gear quick look or admin roster refresh can temporarily show/use the last healthy snapshot | First-party quick look uses a five-minute cache plus stale fallback; roster refresh preserves the durable database snapshot on failure |
| Hodir Hard Mode and Sartharion drake modes are unsupported | Those attempts cannot be ranked by an auditable mode | Return `UNKNOWN` until explicit evidence rules exist |
| Orphaned pets can remain unmatched | A pet already active before logging and lacking summon or owner-exclusive spell evidence remains intentionally unattributed | Propagate permanent-pet ownership only after defensible owner evidence; never infer from generic raid healing |
| Migration history began after the original schema was created by `db push` | A brand-new empty database is not reconstructable from migrations alone | Existing production is supported by `start.sh` migration baselining; create and rehearse a greenfield baseline before provisioning a replacement database |
| Linked Pizza report contains historical parser output | The existing URL will still show mixed legacy totals after deployment | Re-upload the original ZIP after the PR deploys; new rows persist `sessionAnalytics` and old rows are not mutated |

## Resolved Reference

| Issue | Resolution |
|---|---|
| Full-session and guild roster tables were badly cut off on mobile | Replaced their narrow-screen table strips with semantic two-column player metrics and compact roster member cards; desktop tables return only at fitted breakpoints, with 320-1440px containment coverage |
| Clean CI builds could fail when Google Fonts returned 404 for Cinzel | Replaced `next/font/google` downloads with pinned OFL-licensed Fontsource packages for the existing Cinzel and Rajdhani Latin weights; production builds now bundle the fonts locally |
| Shared raid links exposed `Session 1` and Discord showed generic metadata | Public raid URLs now use the raid date, legacy numeric paths redirect permanently, and date-specific canonical/Open Graph/Twitter metadata describes the actual report |
| Public report pages exposed external report-brand and `Custom Slice` terminology | Replaced it with Pizza Logs-native session and encounter labels and added a recursive TSX source guard so those terms cannot return to rendered UI |
| Back-to-back BPC attempts with the same roster collided and dropped the kill | Encounter fingerprints now use the exact normalized pull start instead of a five-minute bucket; the complete source log produces 23 unique fingerprints and retains all three BPC attempts |
| Lich King 10% roleplay split a one-shot kill into WIPE plus UNKNOWN | `Fury of Frostmourne` now opens a bounded five-minute scripted-finale grace window so the resumed burn and real boss death remain one 25N KILL |
| Low-contrast 9-12px metadata disappeared against dark surfaces | Raised semantic metadata tokens to AA-readable values, established a 12px decorative and 14px normal metadata floor, and added a frontend contract test |
| Viewing current gear required a Tampermonkey-assisted refresh path | Class avatars now lazy-load a first-party five-minute Armory quick look with equipment icons, class identity, GearScoreLite, and cached fallback; no helper or admin secret is required |
| Gear and roster operations depended on browser userscripts and open Warmane tabs | Removed browser import controls/APIs and task installers; gear is on demand, roster has an authenticated first-party admin refresh, and legacy update URLs serve inert secret-cleanup scripts |
| Gear quick looks clipped the final equipment rows because the item grid was capped at 24rem with hidden overflow | Removed the clipping cap and expanded the responsive loadout grid to two columns on narrow screens and three on desktop |
| Gear quick looks read like a generic item grid rather than the in-game character equipment screen | Desktop now uses fixed left/right armor rails, a central character panel, visible empty slots, and bottom weapon slots; mobile retains the complete compact list |
| The WoW-style paper doll center had only a large class icon | Warmane appearance and equipped display IDs now drive a dressed WebGL character in an isolated desktop frame, with the class icon retained as the failure/mobile fallback |
| A legacy cached gear fallback could show the class icon even when Warmane's profile still had a valid model | Equipment and profile results are now handled independently: stale gear can gain and persist the live appearance recipe without being mislabeled as fresh equipment |
| Admin showed a cumulative-looking `Server Refresh Errors` count that actually represented per-character last-attempt state | Replaced it with the latest successful live-refresh timestamp, clarified cached snapshots, and added a protected cache-reset control |
| Long player, boss, and leaderboard pages exposed every record at once | Players now paginate at 30; inactive bosses and per-boss leaderboards use accessible progressive disclosure |
| Damage and target meter rows were mouse-only clickable divs | Rows are native buttons with visible focus, `aria-expanded`, stable controlled regions, and responsive mobile summaries |
| Cinematic intro blocked hard-loaded report routes | Intro now runs only on the homepage and only once per browser session |
| Prisma 7 Railway image returned 502 after PR #29 | The runtime image omitted `prisma.config.ts`, so `migrate deploy` had no datasource URL; Docker now copies the config and the actual startup path is container-tested |
| Stale markers, boss outgoing attacks, and post-fight trash inflated pulls | Encounter scope now ends at the last boss-destination event; tests cover late boss attacks, multi-hour wipe markers, and post-kill trash/roster contamination |
| Session page mixed pull sums with full-log damage | New uploads persist one first-to-last-event Custom Slice for Total Damage, Heal, Damage Taken, exact Duration, and per-player rates |
| Damage formulas disagreed with UwU Total Damage | Headline encounter/session damage now sums raw event `amount`; it neither subtracts overkill nor adds the absorbed metadata field |
| Active Time rendered floating-point noise | Whole-session duration is stored in milliseconds and formatted as `H:MM:SS.mmm`; legacy integer formatting floors fractional seconds |
| Lady Deathwhisper/Blood Prince totals omitted adds | Encounter totals now include every matched pull target; boss-only damage remains a separate target breakdown |
| Damage taken used outgoing effective-damage math | Headline taken now records the raw incoming amount used by UwU |
| Generic raid healing could steal pet ownership | Ownership now requires summon or owner-exclusive spell evidence, with permanent-pet propagation covered by regression tests |
| Divine Aegis and consumed shields lost absorb attribution | Critical Discipline-heal evidence can establish Divine Aegis and recently removed shields remain eligible for 0.5 seconds |
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
| Railway production deployments skipped the Production Smoke job | The workflow now accepts Railway's `Pizza Logs / production` environment name by matching the `production` suffix, with a source regression test |
| Production Smoke tested Railway's project dashboard instead of Pizza Logs | Deployment status `environment_url` is a Railway dashboard link; automated smoke now targets the canonical public app URL, with manual dispatch override retained |
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
- A temporary Warmane fetch failure is expected; first-party refresh plus cached snapshots is the supported path.
- Player-list portraits intentionally remain class icons; the desktop gear quick look uses the isolated Warmane 3D model when available.
