# Now

## Status

**Codex modernization is live on `origin/main`, and the vault docs have been synced after the push.** The repo is Codex-first, tracked Claude-specific artifacts were removed, stale Wowhead runtime code was deleted, admin auth is safer in production, compose admin remains usable with local-only overrides, and the Maxximusboom missing-gear queue fix from main was preserved.

**Favicon update is live on production.** `app/icon.svg` now uses the same SVG mark as the navigation logo, and `public/favicon.ico` fixes the legacy `/favicon.ico` 404 reported from production. After deploy, production returned HTTP 200 for both `/favicon.ico` and `/icon.svg`.

**Character portrait proof of concept now covers more UI surfaces and has a rendered-face cache path pending push.** Player initials render through `PlayerAvatar` on player profiles/lists, guild roster rows, session roster chips, and session player deep-dive headers. Portrait Userscript `0.3.0` runs on Pizza Logs, Warmane character pages, and Wowhead/Zamimg modelviewer frames, shares cache through Tampermonkey storage, and can cache a static portrait or readable rendered canvas when the browser allows it. Direct local Warmane fetches and headless browser checks hit Cloudflare, so exact in-game faces remain browser-assisted.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Verify production admin config | DEPLOY | Confirm Railway Web Service has `ADMIN_SECRET`; do not set `ADMIN_COOKIE_SECURE=false` in Railway |
| Verify Railway deploy logs | DEPLOY | Use Railway dashboard/CLI; local Railway CLI is not installed |
| Install/update Gear Sync `1.7.0` | VERIFY | Open `/admin` and install/update hosted Warmane Gear Sync userscript |
| Run Warmane Gear Sync once | VERIFY | Script fetches queued players' Warmane pages and writes missing `iconName` values |
| Verify Maxximusboom and Lausudo icons | VERIFY | Check Maxximusboom Lasherweave items and Lausudo item IDs `50024`, `49964`, `49985` |
| Test Warmane portrait userscript `0.3.0` | VERIFY | Install from `/admin` -> Warmane Gear Cache -> Character Portraits, open a Warmane character profile once, wait for any modelviewer frame to load, then check `/players/<name>`, `/guild-roster`, raid session roster chips, and session player deep-dive pages |
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
- Portrait POC userscript: `/api/player-portraits/userscript.user.js` (`0.3.0` adds Wowhead/Zamimg modelviewer frame capture attempts)
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- WowItem cache table: `wow_items`
- Item template import: `npm run db:import-items` (AzerothCore -> wow_items)
