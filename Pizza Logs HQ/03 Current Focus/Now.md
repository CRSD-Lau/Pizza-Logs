# Now

## Status

**Gear icon backfill fix implemented locally.** Gear cards with AzerothCore stats but missing icons were traced to missing `iconUrl`/`wow_items.iconName`, not missing item-template data.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Deploy icon backfill fix | DEPLOY | Push `main` to `origin`; Railway auto-deploys |
| Run Warmane Gear Sync | VERIFY | Re-import Lausudo via hosted userscript so missing `iconName` values are written |
| Verify Lausudo icons | VERIFY | Check Blightborne Warplate `50024`, Legguards of Lost Hope `49964`, Juggernaut Band `49985` |
| Fix stale userscript version test | TEST | `armory-gear-client-scripts.test.ts` expects `1.0.4`; current userscript is `1.5.0` |
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
