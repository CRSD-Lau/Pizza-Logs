# Now

## Status

**Sync agent removed. Back to manual Tampermonkey scripts.** The auto-sync bridge was too complex (Cloudflare blocked everything). Gear and roster imports continue to work via the existing userscripts on Warmane Armory pages.

**New: WowItem DB cache** — item metadata (ilvl, quality, icon, equipLoc) now persists in `wow_items` table. Enrichment hits DB first; Wowhead only called for unknown items and results are auto-saved.

Worktree branch `claude/sharp-ramanujan-489f4d` is ready to merge to main.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Merge worktree to main and push | DEPLOY | `git merge claude/sharp-ramanujan-489f4d && git push origin main`; Railway auto-deploys + applies migration |
| Seed item DB | SETUP | After deploy: `npm run db:seed-items` — one-time bulk Wowhead fetch |
| Verify gear pages | VERIFY | Check Writman, Yanna, Lausudo for correct ilvl, GS, slot labels |
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
- Admin browser import: `/admin` → Warmane Gear Cache → install/update hosted userscript (`/api/admin/armory-gear/userscript.user.js`), then use the Pizza Logs panel on Warmane Armory
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
