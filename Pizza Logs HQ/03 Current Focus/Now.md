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

Guild Roster feature has been added. `/guild-roster` reads from a new DB-backed `guild_roster_members` table, separate from combat-log `players`. The Warmane roster service tries JSON first (`/api/guild/<guild>/<realm>/summary`, then `/members`) and falls back to parsing the native guild summary HTML. It tries `Pizza+Warriors` before `PizzaWarriors` because Warmane search/index results show the guild title with a space. The sync endpoint is `POST /api/guild-roster/sync` and uses the same `ADMIN_SECRET` style as admin gear import when configured.

Local direct Warmane calls for guild roster returned 403 from this environment, same as prior gear work. The roster page remains DB-backed and does not depend on live Warmane availability at render time. After deployment, test whether Railway can call Warmane; if not, the next enhancement should be a browser-assisted roster import path modeled after the gear userscript.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Spot-check gear slot/GearScore fix | VERIFY | After deploy, confirm `/players/Lausudo` shows the libram as `Ranged/Relic` and full 2H+relic GearScore; confirm `/players/Aalaska` shows staff/wand in the weapon row |
| Refresh gear metadata | VERIFY | Rerun the hosted Warmane userscript so cached rows missing Wowhead `equipLoc` metadata get re-enriched for exact weapon scoring |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Populate Guild Roster | VERIFY | Apply migration, deploy, then POST `/api/guild-roster/sync` with admin auth and force=true |
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
- Warmane guild roster source patterns: `https://armory.warmane.com/api/guild/Pizza+Warriors/Lordaeron/summary`, `/members`, HTML fallback `https://armory.warmane.com/guild/Pizza+Warriors/Lordaeron/summary`
- Wowhead item enrichment pattern: `https://www.wowhead.com/wotlk/item=<id>/<slug>`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted userscript (`/api/admin/armory-gear/userscript.user.js`), then use the Pizza Logs panel on Warmane Armory
