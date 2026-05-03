# Now

## Status

**Codex modernization is live on `origin/main`, and the vault docs have been synced after the push.** The repo is Codex-first, tracked Claude-specific artifacts were removed, stale Wowhead runtime code was deleted, admin auth is safer in production, compose admin remains usable with local-only overrides, and the Maxximusboom missing-gear queue fix from main was preserved.

**Local favicon update is ready on `codex/pizza-logs-modernization`.** `app/icon.svg` now uses the same SVG mark as the navigation logo, and `public/favicon.ico` fixes the legacy `/favicon.ico` 404 reported from production. This change is not committed or pushed yet.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Commit/deploy favicon update | DEPLOY | Includes `app/icon.svg`, `public/favicon.ico`, and vault handoff updates; verified with XML/ICO inspection, type check, production build, local `/favicon.ico` HTTP 200, and local `/icon.svg` HTTP 200 |
| Verify production admin config | DEPLOY | Confirm Railway Web Service has `ADMIN_SECRET`; do not set `ADMIN_COOKIE_SECURE=false` in Railway |
| Verify Railway deploy logs | DEPLOY | Use Railway dashboard/CLI; local Railway CLI is not installed |
| Install/update Gear Sync `1.7.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript |
| Run Warmane Gear Sync once | VERIFY | Script fetches queued players' Warmane pages and writes missing `iconName` values |
| Verify Maxximusboom and Lausudo icons | VERIFY | Check Maxximusboom Lasherweave items and Lausudo item IDs `50024`, `49964`, `49985` |
| Stats / Analytics page | FEATURE | Brainstorm first, then design, then build |
| Verify Skada numbers in-game | VERIFY | Neil to do manually |
| Absorbs (PW:S) | FEATURE | Combined column. Do after verification. |

---

## Reference

- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Admin browser import: `/admin` -> Warmane Gear Cache -> install/update hosted Warmane Gear Sync userscript, then use the Pizza Logs panel on Warmane Armory
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
- Item template import: `npm run db:import-items` (AzerothCore -> wow_items)
