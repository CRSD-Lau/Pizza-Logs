# Now

## Status
`v0.1.0` shipped. Wiki live. Railway deployed.
Public upload analytics have been moved into admin-only routes, and the mobile nav/raids/leaderboards pass is done.
Native Warmane Armory gear UI has been added to player profiles. Gear now has a DB-backed cache and a browser bookmarklet that bulk-imports missing players through Warmane's browser-accessible API.
Gear items are enriched with Wowhead WotLK metadata when cached, giving the player page native icons, item quality, item level, and hover/focus tooltip details without making each item card link away.
The admin browser import queue includes older cached players whose gear is missing Wowhead details, so rerunning the bookmarklet upgrades existing cache rows too.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Test browser gear import | VERIFY | Use `/admin` bulk bookmarklet on any Warmane Armory page until no players need import/enrichment, then confirm profile gear renders with icons/tooltips |
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
- Admin browser import: `/admin` -> Warmane Gear Cache -> copy Bulk bookmark URL into a browser bookmark, then run it from Warmane Armory
