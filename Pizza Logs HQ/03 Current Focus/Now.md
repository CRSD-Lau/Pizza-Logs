# Now

## Status
`v0.1.0` shipped. Wiki live. Railway deployed.
Public upload analytics have been moved into admin-only routes, and the mobile nav/raids/leaderboards pass is done.
Native Warmane Armory gear UI has been added to player profiles. Gear now has a DB-backed cache and a browser bookmarklet that bulk-imports missing players through Warmane's browser-accessible API.
Gear items are enriched with Wowhead WotLK metadata when cached, giving the player page native icons, item quality, item level, and hover/focus tooltip details without making each item card link away.
Gear tooltips now render through a viewport-level portal from `components/players/GearItemCard.tsx`, so they are not clipped by the Gear accordion/table wrapper and can float above the sections below.
The gear section now calculates and displays GearScoreLite totals using the addon-derived slot weights/formula, plus per-item GS values. Wowhead enrichment stores equip-location metadata so weapon slots can be scored accurately.
The admin browser import queue includes older cached players whose gear is missing Wowhead details, so rerunning the bookmarklet upgrades existing cache rows too.
The bookmarklet now retries intermittent Warmane per-character failures and reports failed names; old bookmark URLs must be replaced after deploys because the code is copied into the bookmark.
The recommended gear import path is now a Tampermonkey/userscript from `/admin`; it adds a Pizza Logs panel on Warmane pages and auto-syncs at most once per hour after saving the admin secret in browser localStorage.
The userscript is hosted at `/api/admin/armory-gear/userscript.user.js`, and `/admin` links directly to it so Tampermonkey can install/update from URL metadata.
Userscript v1.0.2 supports both HTTP and HTTPS Warmane pages and waits for the page body before injecting the panel.
Userscript v1.0.3 logs `Pizza Logs userscript starting` at startup and `Pizza Logs panel injection failed` if panel creation crashes.
After enabling Tampermonkey/userscript injection, the Warmane page showed the **Pizza Logs Gear Sync** panel and began importing queued DB players (`Importing Rimeclaw (13/18)...`). The seamless path is now: install/update userscript from `/admin`, visit any Warmane Armory page, save/use the admin secret once, and let the userscript fill/refresh cache rows.
Character-specific enchants/gems are still limited by what Warmane exposes to the browser/importer. Wowhead enrichment provides static item icons, quality, item level, and tooltip text, but not a player's chosen enchants/gems unless those are present in Warmane data.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Spot-check completed gear sync | VERIFY | After deploy, confirm `/players/Ashien` and `/players/Aalaska` render icons, GearScoreLite summaries, and native hover tooltips above nearby wrappers |
| Refresh gear metadata | VERIFY | Rerun the hosted Warmane userscript so cached rows missing Wowhead `equipLoc` metadata get re-enriched for exact weapon scoring |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
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
- Wowhead item enrichment pattern: `https://www.wowhead.com/wotlk/item=<id>/<slug>`
- Gear cache table: `armory_gear_cache`
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted userscript (`/api/admin/armory-gear/userscript.user.js`), then use the Pizza Logs panel on Warmane Armory
