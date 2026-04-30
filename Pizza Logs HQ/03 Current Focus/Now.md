# Now

## Status
`v0.1.0` shipped. Wiki live. Railway deployed.
Public upload analytics have been moved into admin-only routes, and the mobile nav/raids/leaderboards pass is done.
Native Warmane Armory gear UI has been added to player profiles. Gear now has a DB-backed cache, an admin seed action, and a browser bookmarklet that bulk-imports missing players through Warmane's browser-accessible API.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Run admin Seed Gear Cache | VERIFY | Attempts Warmane refreshes for existing DB players and records success/failure counts |
| Test browser gear import | VERIFY | Drag/use `/admin` bulk bookmarklet on any Warmane Armory page, then confirm profile gear renders |
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
- Gear cache table: `armory_gear_cache`
- Admin seed UI: `/admin` -> Warmane Gear Cache -> Seed Gear Cache
- Admin browser import: `/admin` -> Warmane Gear Cache -> Pizza Logs Gear Import bookmarklet
