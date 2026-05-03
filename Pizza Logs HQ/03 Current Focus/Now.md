# Now

## Status

**Gear icon DOM fallback fix implemented locally.** Gear cards with AzerothCore stats but missing icons were traced to Warmane API omitting icon fields for deterministic items; the browser page still exposes item icons in the DOM, so the userscript now merges DOM icons into the import payload.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Deploy icon DOM fallback fix | DEPLOY | Push `main` to `origin`; Railway auto-deploys |
| Install/update Gear Sync `1.6.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript |
| Run Warmane Gear Sync | VERIFY | Re-import Lausudo from Warmane character page so DOM icons are merged and `iconName` values are written |
| Verify Lausudo icons | VERIFY | Check Blightborne Warplate `50024`, Legguards of Lost Hope `49964`, Juggernaut Band `49985` |
| Fix stale unrelated tests | TEST | Guild roster admin panel and deprecated Wowhead tests have old assertions |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Verify Skada numbers in-game | VERIFY | Neil to do manually |
| Absorbs (PW:S) | FEATURE | Combined column. Do after verification. |

---

## Reference
- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted userscript, then use the Pizza Logs panel on Warmane Armory
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
- Item template import: `npm run db:import-items` (AzerothCore -> wow_items)
