# Now

## Status

**Gear enrichment overhaul complete.** Wowhead runtime dependency removed. AzerothCore `item_template.sql` importer built. `lib/warmane-armory.ts` updated to use local enrichment. Branch `claude/gear-item-template` ready to merge.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Merge `claude/gear-item-template` to main | DEPLOY | Railway auto-deploys |
| Run `npm run db:import-items` | SETUP | After deploy: set DATABASE_URL from Railway, run once |
| Verify admin page item count | VERIFY | Should show 78k+ items after import |
| Verify player gear pages | VERIFY | Check Writman, Yanna, Lausudo |
| Fix HC/Normal difficulty detection | BUG | Regression/open task |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Verify Skada numbers in-game | VERIFY | Neil to do manually |
| Absorbs (PW:S) | FEATURE | Combined column. Do after verification. |

---

## Reference
- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Admin browser import: `/admin` → Warmane Gear Cache → install/update hosted userscript, then use the Pizza Logs panel on Warmane Armory
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
- Item template import: `npm run db:import-items` (AzerothCore → wow_items)
