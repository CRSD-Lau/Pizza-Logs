# Now

## Status

**Local test server is running correctly on this machine.** The app is on `http://127.0.0.1:3001`, matching `.env.local`'s `NEXT_PUBLIC_APP_URL`; the Python parser is on `http://127.0.0.1:8000`; PostgreSQL 16 is running on `localhost:5432`. Stale Next listeners on `3000`, `3005`, and `3006` were stopped, generated `.next/` was cleared after the known OneDrive `readlink` failure, and the full local stack was restarted cleanly.

**Local server smoke checks passed.** Parser `/health`, the main public pages, `/admin/login`, `/admin`, and the database-backed APIs all returned HTTP 200. The local DB has `53` bosses, `4` realms, and `38,610` item rows, but no players, uploads, or encounters yet.

**HD cinematic intro now has a 4K-master responsive resolution ladder.** The strip-derived previews were rejected as too low quality, so the approved direction uses a generated pre-rendered HD cinematic: ICC/WotLK-inspired frost-armored raid boss, blizzard approach, blue-eye reveal, close-up hold, and a clean fade into the real Pizza Logs page. The app now serves desktop `1920x1080`, `2560x1440`, and `3840x2160` WebM/MP4/poster assets plus mobile portrait `1080x1920` and `2160x3840` WebM/MP4/poster assets, all at `60fps`, `7.2s`, and `432` rendered frames. `FrozenLogbookIntro` plays the cinematic on hard page load, picks mobile/desktop resolutions through ordered `<source media>` entries, keeps `Skip`, exits on video end or after `7200ms`, and gives reduced-motion users the matching poster through the same media-query ladder with a short `350ms` timeout. The latest deployment pass renders from 4K masters first, then downscales per viewport, with the review source retained under ignored `animations/hd_cinematic_intro/continuity_review/responsive_4k_ladder_review/`.

**`/bosses` mobile layout is fixed and deployed.** Desktop keeps the dense table-style grid, while mobile now uses boss summary cards with the same shared reveal animation classes used elsewhere. Narrow metric cells have overflow guards so long values cannot push the page sideways.

**The old CSS-only intro is superseded by the cinematic intro.** Production assets and layout bundle were verified after Railway deploy. The shared reveal animations for boss/player/leaderboard rows and `lib/ui-animation.ts` remain in place.

**Animation visibility follow-up is implemented.** After user feedback that the animation only flashed once and was not obvious, the follow-up makes the intro replay on every page change, makes shared reveal timing more visible (`420ms` / `70ms` stagger), includes Guild roster rows in the reveal wiring, and safelists `reveal-item` / `boss-reveal-item` so Tailwind keeps the shared animation CSS in production builds.

**Raid session boss display now preserves parsed timestamp order when available.** `orderBossDisplayEntries` sorts timestamped encounter rows by `startedAt` and falls back to the existing ICC progression helper only when timestamp/order data is unavailable. Leaderboard boss boards still use ICC progression order because they are aggregate boss boards, not a single timestamped raid session.

**Cinematic intro verification passed locally for the 4K-master ladder.** Focused source tests cover the responsive video sources, poster fallback, skip, reduced-motion handling, and removal of the old particle intro. Media metadata inspection confirmed every public intro video is `60fps`, `7.2s`, `432` frames, and at the intended dimensions; poster metadata also matches. TypeScript, ESLint, `git diff --check`, production `next build`, parser tests, and local media route checks passed. Browser review artifacts and final generated review assets remain under ignored `animations/hd_cinematic_intro/`.

**4K-master intro assets are deployed and verified on production.** After pushing `980352c` to `origin/main`, Railway served the refreshed public WebM/MP4/poster files with expected byte lengths for desktop 1080p, desktop 1440p, desktop 4K, mobile 1080p, mobile 4K, and the mobile 4K poster.

**Crisp intro assets are deployed and verified on production.** After pushing `7fa25c5` to `origin/main`, Railway served the refreshed public WebM/poster files with expected byte lengths for desktop 1080p, desktop 1440p, desktop 4K, mobile 1080p, mobile 4K, and the mobile 4K poster.

**Desktop checkout started clean from public `main`; animation work was developed on `codex/pizza-logs-animation-mvp` before main deployment.** The old `PizzaLogs-main-queue-fix` worktree folder and stale Git metadata are removed, the local modernization/Claude branches are deleted, and the remote `codex/pizza-logs-modernization` branch was deleted after confirming it matched `main`.

**Hunter weapon GearScore display/total is fixed.** Player gear cards now display raw per-item GearScore values through `displayItemScores`. Hunter-only melee/ranged GearScoreLite weighting was also removed from the total calculation because Notlich's in-game total (`6237`) follows the raw hunter weapon scores rather than counting heroic Scourgeborne Waraxes as `168` each. Titan Grip handling remains intact.

**AzerothCore ranged/relic inventory mapping is repaired.** `InventoryType` 25/26/28 now map to thrown/ranged-right/relic correctly, and migration `20260504120000_repair_wow_item_ranged_relic_equip_locs` repairs older `wow_items` rows affected by the previous shifted mapping.

**Codex modernization is live on `origin/main`, and the vault docs have been synced after the push.** The repo is Codex-first, tracked Claude-specific artifacts were removed, stale Wowhead runtime code was deleted, admin auth is safer in production, compose admin remains usable with local-only overrides, and the Maxximusboom missing-gear queue fix from main was preserved.

**ICC boss ordering is fixed in code for raid-session displays and leaderboards.** `lib/constants/bosses.ts` now owns the canonical Icecrown Citadel progression order plus normalization for common labels like Gunship variants, `Lich King`, and Blood-Queen Lana'thel variants. `/leaderboards` uses that shared sorter instead of alphabetical boss-name order, and raid session encounter displays use it while preserving duplicate pull order.

**Player profile Per-Boss Summary now uses the same ICC ordering.** `/players/<name>` no longer sorts summary cards by best DPS. The player page uses `buildPlayerPerBossSummary`, which groups player boss stats and applies the shared `sortByICCOrder` helper.

**Player Recent Encounters and weekly boss-kill cards now use ICC ordering too.** `/players/<name>` keeps the recent 20 encounter window but displays it in ICC progression order through `buildPlayerRecentEncounters`. `/weekly` and `/api/weekly` use `buildWeeklyBossKills`, so Boss Kills This Week no longer sorts by kill count.

**Codex should push validated work by default.** `AGENTS.md` now says Neil does not test local-only changes, so future change sessions should commit and push scoped work to Git unless Neil explicitly asks to keep it local. Deploy/live/main pushes still require the repo's normal validation gates.

**Favicon update is live on production.** `app/icon.svg` now uses the same SVG mark as the navigation logo, and `public/favicon.ico` fixes the legacy `/favicon.ico` 404 reported from production. After deploy, production returned HTTP 200 for both `/favicon.ico` and `/icon.svg`.

**Character portrait proof of concept now covers more UI surfaces and has a stricter rendered-face cache path.** Player initials render through `PlayerAvatar` on player profiles/lists, guild roster rows, session roster chips, and session player deep-dive headers. Portrait Userscript `0.5.0` runs on Pizza Logs, Warmane character pages, and Wowhead/Zamimg modelviewer frames, shares cache through Tampermonkey storage, rejects blank/black WebGL canvas captures through scratch-canvas pixel sampling, and can cache a static portrait or readable rendered canvas when the browser allows it. Direct local Warmane fetches and headless browser checks hit Cloudflare, so exact in-game faces remain browser-assisted.

**Warmane CDN gear icon mixed-content warnings are fixed in code.** Imported and cached gear icon URLs are normalized to HTTPS, including old `http://cdn.warmane.com/...` snapshots when gear slots are normalized for display.

**Global player search is implemented on the current branch.** The header search uses `/api/players/search?q=<query>`, merges combat-log `players` with PizzaWarriors/Lordaeron roster-only `guild_roster_members`, ranks exact matches first, and navigates to `/players/<name>`. It is debounced, cached client-side per query, and visible in the header on large and small screens.

**Local database downtime no longer breaks the main pages.** If Postgres is not running at `localhost:5432`, `/admin` and the main public pages still render the shared header/search and show Database unavailable warnings instead of the Next dev error overlay. The latest smoke check returned HTTP 200 for `/`, `/players`, `/raids`, `/leaderboards`, `/bosses`, `/guild-roster`, `/weekly`, `/admin`, and `/admin/login` with local Postgres offline, without misleading empty-data messages.

**Local PostgreSQL is installed and seeded on this machine.** PostgreSQL 16 is running as `postgresql-x64-16` on `localhost:5432`. The `pizzalogs` role/database exists, Prisma schema is pushed, bosses/realms are seeded, and `wow_items` has 38,610 imported AzerothCore item rows. The local DB is fresh, so players/raids/encounters remain empty until a combat log or Warmane roster is imported.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Use local test server | VERIFY | App is live at `http://127.0.0.1:3001`; parser is `http://127.0.0.1:8000`; local DB is seeded but empty for raid/player data |
| Human-pass HD cinematic intro | VERIFY | After 4K-master ladder deploy, hard-refresh production in normal desktop, 1440p/4K, and phone-sized browsers to judge playback smoothness/taste and try the Skip button manually |
| Verify `/bosses` mobile cards | DONE | Neil confirmed the boss page mobile fix is in and responsiveness is good; leave `/bosses` alone unless a new regression appears |
| Verify Notlich gear cards | VERIFY | After deploy, `/players/Notlich` should show both heroic Scourgeborne Waraxes as `GS 531` |
| Verify production admin config | DEPLOY | Confirm Railway Web Service has `ADMIN_SECRET`; do not set `ADMIN_COOKIE_SECURE=false` in Railway |
| Verify Railway deploy logs | DEPLOY | Use Railway dashboard/CLI; local Railway CLI is not installed |
| Install/update Gear Sync `1.7.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript |
| Run Warmane Gear Sync once | VERIFY | Script fetches queued players' Warmane pages and writes missing `iconName` values |
| Verify Maxximusboom and Lausudo icons | VERIFY | Check Maxximusboom Lasherweave items and Lausudo item IDs `50024`, `49964`, `49985` |
| Test Warmane portrait userscript `0.5.0` | VERIFY | Install from `/admin` -> Warmane Gear Cache -> Character Portraits, open a Warmane character profile once, wait for any modelviewer frame to load, then check `/players/<name>`, `/guild-roster`, raid session roster chips, and session player deep-dive pages |
| Verify global player search | VERIFY | After deploy, spot-check exact-match Enter navigation, partial-match dropdowns, and roster-only character navigation from the header |
| Verify ICC boss ordering on real uploads | VERIFY | Check `/raids/<upload>/sessions/<idx>` and `/leaderboards` with full/partial ICC data after deploy |
| Verify player Per-Boss Summary ordering | VERIFY | Check `/players/Notlich`; summary cards should follow ICC order instead of DPS order |
| Verify remaining ICC display ordering | VERIFY | Check `/players/<name>` Recent Encounters and `/weekly` Boss Kills This Week after deploy |
| Spot-check animation with real raid data | VERIFY | Production intro/mobile checks passed; use populated `/raids`, `/leaderboards`, and player pages for a human visual pass on reveal timing with real data |
| Import local sample data | VERIFY | Local DB is live but empty for players/raids; upload `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt` or run Warmane roster sync to populate search results |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Verify Skada numbers in-game | VERIFY | Neil to do manually |
| Absorbs (PW:S) | FEATURE | Combined column. Do after verification. |

---

## Reference

- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted Warmane Gear Sync userscript, then use the Pizza Logs panel on Warmane Armory
- Portrait POC userscript: `/api/player-portraits/userscript.user.js` (`0.5.0` rejects blank WebGL/modelviewer captures through scratch-canvas sampling and uses `pizzaLogsWarmanePortraitCacheV3`)
- Header player search endpoint: `/api/players/search?q=<query>` (reads `players` plus scoped PizzaWarriors/Lordaeron `guild_roster_members`)
- ICC boss ordering helper: `lib/constants/bosses.ts` (`ICC_BOSS_ORDER`, `sortByICCOrder`, `sortBossesByICCOrder`)
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
- Item template import: `npm run db:import-items` (AzerothCore -> wow_items)
