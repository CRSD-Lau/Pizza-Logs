# Now

## Status

GuildRosterSyncButton component has been deleted as dead code. The component was previously removed from usage when GuildRosterSyncPanel stopped accepting an `action` prop. The deletion is committed. Next task will clean up stale imports and prop references in `app/admin/page.tsx` and the test file.

Vault priority for this session:
1. Remove GuildRosterSyncButton import from `app/admin/page.tsx(10)`
2. Remove `action` prop from GuildRosterSyncPanel call at line 112
3. Remove `action` prop from test setup in `tests/guild-roster-admin-panel.test.ts`
4. Run `npx tsc --noEmit` to verify TypeScript errors cleared

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Clean up page.tsx import | CLEANUP | Delete import of GuildRosterSyncButton from `app/admin/page.tsx(10)` |
| Clean up GuildRosterSyncPanel props | CLEANUP | Remove `action` prop from `GuildRosterSyncPanel` call at line 112 |
| Clean up test file props | CLEANUP | Remove `action` prop from test setup in `tests/guild-roster-admin-panel.test.ts` |
| Verify TypeScript passes | VERIFY | Run `npx tsc --noEmit` and confirm all errors cleared |
| Fix HC/Normal difficulty detection | BUG | Regression - issue open on GitHub |
| Spot-check gear slot/GearScore fix | VERIFY | After deploy, confirm `/players/Lausudo` shows the libram as `Ranged/Relic` and full 2H+relic GearScore; confirm `/players/Aalaska` shows staff/wand in the weapon row |
| Spot-check Titan Grip GS fix | VERIFY | After deploy, confirm `/players/Contents` no longer double-counts both two-handed weapons |
| Refresh gear metadata | VERIFY | Rerun the hosted Warmane userscript so cached rows missing Wowhead `equipLoc` metadata get re-enriched for exact weapon scoring |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Populate Guild Roster | VERIFY | Apply migrations, deploy, install/update roster userscript v1.0.4 from `/admin`, sync from Warmane guild page, then run Warmane Gear Sync from a character page so roster-only players get gear/GS |
| Spot-check Warmane panels | VERIFY | Confirm Gear Sync appears on character pages and Roster Sync appears on guild pages |
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
