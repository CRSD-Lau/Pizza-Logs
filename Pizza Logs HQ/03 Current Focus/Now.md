# Now

## Status

**Warmane Sync Agent is fully built.** The desktop bridge + admin UI are implemented across all 12 plan tasks. 25/25 tests pass. TypeScript is clean. The worktree branch `claude/sharp-ramanujan-489f4d` is 13 commits ahead of main and ready to merge.

Current active focus: **deploy and activate the bridge on Neil's desktop.**

Implementation plan: `docs/superpowers/plans/2026-05-01-warmane-sync-agent.md`
Design spec: `docs/superpowers/specs/2026-05-01-warmane-sync-agent-design.md`

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Merge worktree to main and push | DEPLOY | `git merge claude/sharp-ramanujan-489f4d && git push origin main`; Railway auto-deploys |
| Set up `.env.sync-agent` on desktop | SETUP | Copy from `.env.sync-agent.example`, fill in `PIZZA_ADMIN_SECRET` |
| Test dry-run on desktop | VERIFY | `npm run sync:warmane:dry` — should log roster fetch without importing |
| Test live run on desktop | VERIFY | `npm run sync:warmane` — watch `/admin` Warmane Auto-Sync panel update |
| Register Task Scheduler | SETUP | `powershell -ExecutionPolicy Bypass -File scripts\setup-sync-scheduler.ps1` |
| Verify gear pages after first sync | VERIFY | Check Writman, Yanna, Lausudo for correct ilvl, GS, slot labels |
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
- Wiki: https://github.com/CRSD-Lau/Pizza-Logs/wiki
- Warmane gear source pattern: `https://armory.warmane.com/api/character/<name>/Lordaeron/summary`
- Warmane guild roster source patterns: prefer HTML `https://armory.warmane.com/guild/Pizza+Warriors/Lordaeron/summary` for Rank/Professions, fallback to JSON `https://armory.warmane.com/api/guild/Pizza+Warriors/Lordaeron/summary` and `/members`
- Wowhead item enrichment pattern: `https://www.wowhead.com/wotlk/tooltip/item/<id>`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted userscript (`/api/admin/armory-gear/userscript.user.js`), then use the Pizza Logs panel on Warmane Armory
