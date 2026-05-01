# Now

## Status
`v0.1.0` shipped. Wiki live. Railway deployed.
Public upload analytics have been moved into admin-only routes, and the mobile nav/raids/leaderboards pass is done.
Native Warmane Armory gear UI has been added to player profiles. Gear now has a DB-backed cache and a browser bookmarklet that bulk-imports missing players through Warmane's browser-accessible API.
Gear items are enriched with Wowhead WotLK metadata when cached, giving the player page native icons, item quality, item level, and hover/focus tooltip details without making each item card link away.
Gear tooltips now render through a viewport-level portal from `components/players/GearItemCard.tsx`, so they are not clipped by the Gear accordion/table wrapper and can float above the sections below.
The gear section now calculates and displays GearScoreLite totals using the addon-derived slot weights/formula, plus per-item GS values. Wowhead enrichment stores equip-location metadata so weapon slots can be scored accurately.
Partial gear enrichment has been tightened: Wowhead item fetches retry with backoff, enrichment runs with limited concurrency, and fresh cached rows missing Wowhead metadata are re-enriched before the player page returns them.
Gear slot labeling now repairs sparse Warmane equipment arrays using Wowhead `equipLoc` metadata. This fixes relics/ranged/wands sliding into the `Off Hand` or trinket labels when a character has empty slots, displays that slot as `Ranged/Relic`, and GearScoreLite no longer applies the Titan Grip half-score modifier unless both main/off-hand items are actual weapons.
The admin browser import queue includes older cached players whose gear is missing Wowhead details, so rerunning the bookmarklet upgrades existing cache rows too.
The bookmarklet now retries intermittent Warmane per-character failures and reports failed names; old bookmark URLs must be replaced after deploys because the code is copied into the bookmark.
The recommended gear import path is now a Tampermonkey/userscript from `/admin`; it adds a Pizza Logs panel on Warmane pages and auto-syncs at most once per hour after saving the admin secret in browser localStorage.
The userscript is hosted at `/api/admin/armory-gear/userscript.user.js`, and `/admin` links directly to it so Tampermonkey can install/update from URL metadata.
Userscript v1.0.2 supports both HTTP and HTTPS Warmane pages and waits for the page body before injecting the panel.
Userscript v1.0.3 logs `Pizza Logs userscript starting` at startup and `Pizza Logs panel injection failed` if panel creation crashes.
After enabling Tampermonkey/userscript injection, the Warmane page showed the **Pizza Logs Gear Sync** panel and began importing queued DB players (`Importing Rimeclaw (13/18)...`). The seamless path is now: install/update userscript from `/admin`, visit any Warmane Armory page, save/use the admin secret once, and let the userscript fill/refresh cache rows.
Character-specific enchants/gems are still limited by what Warmane exposes to the browser/importer. Wowhead enrichment provides static item icons, quality, item level, and tooltip text, but not a player's chosen enchants/gems unless those are present in Warmane data.
Git/deploy expectations are now explicit in root instructions and the Railway runbook: canonical remote is `origin` -> `https://github.com/CRSD-Lau/Pizza-Logs.git`, and user requests to push/deploy/publish/get changes live mean push `main` to `origin` so Railway deploys from `origin/main`. If `git` is missing from PATH on this Windows machine, use `C:\Program Files\Git\cmd\git.exe`.

Guild Roster feature has been added. `/guild-roster` reads from a new DB-backed `guild_roster_members` table, separate from combat-log `players`. The Warmane roster service tries JSON first (`/api/guild/<guild>/<realm>/summary`, then `/members`) and falls back to parsing the native guild summary HTML. It tries `Pizza+Warriors` before `PizzaWarriors` because Warmane search/index results show the guild title with a space. `/admin` now has a **Guild Roster Sync** panel with row count, last sync time, and a **Sync Roster** button. The button uses the existing admin session/cookie through a server action and runs a forced PizzaWarriors/Lordaeron sync. Because Railway showed Warmane unavailable, `/admin` also links a hosted roster userscript. The userscript runs on Warmane Armory, fetches the guild JSON/HTML from the browser, and posts normalized roster data to Pizza Logs via `POST /api/admin/guild-roster/import`.

Guild Roster has been extended for rank/profession/GS visibility. `guild_roster_members` now has nullable `rank_order`, `professions_json`, and `gear_score` columns. Sync preserves Warmane's source order so the public table sorts by guild rank order, with Maximusboom first if Warmane returns him first. Warmane JSON is still attempted first, but rankless JSON falls through to the guild HTML page because Warmane's API has historically omitted rank while the HTML roster includes the Rank column. The roster userscript is v1.0.1 and mirrors this behavior. `/guild-roster` now shows GS and Professions columns; GS is computed with the same GearScoreLite code as the player page from existing `armory_gear_cache` snapshots when available, so roster rendering stays DB-backed.

Roster rank/profession import has been tightened again after production still showed blanks. Warmane's guild roster HTML can link members as `/guild/Pizza+Warriors/Lordaeron/summary/<Character>`, not only `/character/<Character>/Lordaeron/summary`; the parser now handles that route shape and `Image: ...` table text. Roster sync and the browser roster userscript now prefer HTML first, then JSON fallback, because HTML is the reliable source for Rank and Professions. The roster userscript is now v1.0.2.

Roster-only player profiles are now supported. `/players/<name>` can resolve a `guild_roster_members` row even if that character has never appeared in combat logs, and combat-log profiles merge roster metadata when present. The admin Warmane gear queue includes roster-only members too, so the existing Warmane Gear Sync userscript can scrape/import their equipment, then the existing player gear section and roster table can calculate GearScore from cached gear.

Local direct Warmane calls for guild roster returned 403 from this environment, same as prior gear work. Production `/admin` also showed "Roster sync is temporarily unavailable from Warmane" for the server-side sync. Use the browser roster userscript fallback from `/admin` when the server-side button is blocked. The roster page remains DB-backed and does not depend on live Warmane availability at render time.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Spot-check gear slot/GearScore fix | VERIFY | After deploy, confirm `/players/Lausudo` shows the libram as `Ranged/Relic` and full 2H+relic GearScore; confirm `/players/Aalaska` shows staff/wand in the weapon row |
| Refresh gear metadata | VERIFY | Rerun the hosted Warmane userscript so cached rows missing Wowhead `equipLoc` metadata get re-enriched for exact weapon scoring |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Populate Guild Roster | VERIFY | Apply migrations, deploy, install/update roster userscript v1.0.2 from `/admin`, sync from Warmane guild page, then run Warmane Gear Sync so roster-only players get gear/GS |
| Verify Skada numbers in-game | VERIFY | Neil to do manually next week |
| Absorbs (PW:S) | FEATURE | Combined column. Do after verification. |

---

## Reference
- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Wiki: https://github.com/CRSD-Lau/Pizza-Logs/wiki
- Warmane gear source pattern: `https://armory.warmane.com/api/character/<name>/Lordaeron/summary`
- Warmane guild roster source patterns: prefer HTML `https://armory.warmane.com/guild/Pizza+Warriors/Lordaeron/summary` for Rank/Professions, fallback to JSON `https://armory.warmane.com/api/guild/Pizza+Warriors/Lordaeron/summary` and `/members`
- Wowhead item enrichment pattern: `https://www.wowhead.com/wotlk/item=<id>/<slug>`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted userscript (`/api/admin/armory-gear/userscript.user.js`), then use the Pizza Logs panel on Warmane Armory
