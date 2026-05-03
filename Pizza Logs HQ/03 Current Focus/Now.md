# Now

## Status

**Gear sync queue cap fix implemented locally.** Gear cards with AzerothCore stats but missing icons were traced to Warmane API omitting icon fields for deterministic items; the userscript can now fetch queued players' pages and merge DOM icons, but Maxximusboom exposed a follow-up queue bug where the missing API only inspected the first 100 player/roster candidates before filtering.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Deploy missing-queue cap fix | DEPLOY | Maxximusboom was outside the first 100 pre-filtered candidates, so `/api/admin/armory-gear/missing` never queued him |
| Install/update Gear Sync `1.7.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript if Tampermonkey has not picked up the latest version |
| Run Warmane Gear Sync once | VERIFY | Script fetches queued players' Warmane pages and writes missing `iconName` values without visiting each player |
| Verify Maxximusboom icons | VERIFY | Confirm Lasherweave pieces are queued and update after one bulk sync |
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
