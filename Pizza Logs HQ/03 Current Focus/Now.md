# Now

## Status

**Codex modernization is live on `origin/main`, and the vault docs have been synced after the push.** The repo is Codex-first, tracked Claude-specific artifacts were removed, stale Wowhead runtime code was deleted, admin auth is safer in production, compose admin remains usable with local-only overrides, and the Maxximusboom missing-gear queue fix from main was preserved.

**ICC boss ordering is fixed in code for raid-session displays and leaderboards.** `lib/constants/bosses.ts` now owns the canonical Icecrown Citadel progression order plus normalization for common labels like Gunship variants, `Lich King`, and Blood-Queen Lana'thel variants. `/leaderboards` uses that shared sorter instead of alphabetical boss-name order, and raid session encounter displays use it while preserving duplicate pull order.

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
| Verify production admin config | DEPLOY | Confirm Railway Web Service has `ADMIN_SECRET`; do not set `ADMIN_COOKIE_SECURE=false` in Railway |
| Verify Railway deploy logs | DEPLOY | Use Railway dashboard/CLI; local Railway CLI is not installed |
| Install/update Gear Sync `1.7.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript |
| Run Warmane Gear Sync once | VERIFY | Script fetches queued players' Warmane pages and writes missing `iconName` values |
| Verify Maxximusboom and Lausudo icons | VERIFY | Check Maxximusboom Lasherweave items and Lausudo item IDs `50024`, `49964`, `49985` |
| Test Warmane portrait userscript `0.5.0` | VERIFY | Install from `/admin` -> Warmane Gear Cache -> Character Portraits, open a Warmane character profile once, wait for any modelviewer frame to load, then check `/players/<name>`, `/guild-roster`, raid session roster chips, and session player deep-dive pages |
| Verify global player search | VERIFY | After deploy, spot-check exact-match Enter navigation, partial-match dropdowns, and roster-only character navigation from the header |
| Verify ICC boss ordering on real uploads | VERIFY | Check `/raids/<upload>/sessions/<idx>` and `/leaderboards` with full/partial ICC data after deploy |
| Import local sample data | VERIFY | Local DB is live but empty for players/raids; upload a combat log or run Warmane roster sync to populate search results |
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
