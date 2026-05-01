# Latest Handoff

## Date
2026-05-01

## Git
**Branch:** `main`
**Latest commit:** `6b076e0 feat: enrich gear with Wowhead data in browser-side userscript (v1.1.0)`
**Release:** `v0.1.0` - tagged and published on GitHub

---

## What Was Done This Session

### Admin Page Cleanup (complete)
All 6 scoped changes were made and validated:

1. `app/admin/actions.ts` — `clearDatabase` now only deletes `weeklySummary` and `upload` (cascade). Players, gear cache, and roster are retained.
2. `app/admin/ClearDatabaseButton.tsx` — button now says "Clear Upload Data"; confirmation explains what's cleared vs retained.
3. `app/admin/GearImportBookmarklet.tsx` — removed two `<details>` fallback blocks (copy-paste userscript + bookmarklet).
4. `app/admin/GuildRosterSyncPanel.tsx` — removed `action` prop, removed bookmarklet `<details>`, updated copy.
5. `app/admin/GuildRosterSyncButton.tsx` — deleted (dead code).
6. `app/admin/page.tsx` — reordered sections, removed stale imports.
7. `tests/guild-roster-admin-panel.test.ts` — removed stale `action` prop from test render.

### Nav + Players subtitle (complete)
- `components/layout/Nav.tsx` — "Roster" nav label renamed to "Guild"
- `app/players/page.tsx` — subtitle updated to "players tracked across logs and the guild roster"

### Wowhead gear enrichment (complete)
Root cause: Railway's server IPs are blocked by Cloudflare for both Warmane and Wowhead, so server-side enrichment always returns null. Also, the old Wowhead HTML scraping approach was broken because Wowhead removed the `$.extend(g_items[...])` marker from their pages.

Two fixes shipped:
- `lib/wowhead-items.ts` — rewrote to use Wowhead tooltip JSON API (`/wotlk/tooltip/item/{id}`) instead of HTML scraping. `parseWowheadTooltipJson` is exported for unit testing.
- `lib/armory-gear-client-scripts.ts` (v1.1.0) — Tampermonkey userscript now fetches Wowhead tooltip JSON **browser-side** before posting to Pizza Logs. Uses `GM_xmlhttpRequest` (bypasses CORS/Cloudflare). Adds `itemLevel`, `equipLoc` (INVTYPE_* from slotbak), and `iconUrl` to each item. 300ms delay between items.

**Required user action after deploy:** Update Tampermonkey userscript from `/admin` Install/Update button, then run sync on any Warmane Armory character page to re-import and re-enrich cached players.

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Release**: `v0.1.0`
- **Admin page**: fully cleaned up — bookmarklets removed, button copy updated, clear-database scoped to upload data only, dead component deleted
- **TypeScript**: clean
- **Git/deploy**: canonical remote is `origin` -> `https://github.com/CRSD-Lau/Pizza-Logs.git`; push live changes with `git push origin main`

---

## Next Steps

1. **Update Tampermonkey userscript** — click Install/Update on `/admin`, then run sync on a Warmane Armory character page to re-enrich cached players with correct ilvl/slot/icon data
2. **Verify gear pages** — check Writman, Yanna, and other players after re-sync to confirm ilvl, GS, and slot labels are now correct
3. **Fix HC/Normal difficulty detection** — regression bug (open on GitHub)
4. **Stats/Analytics page** — brainstorm first
5. **Verify Skada numbers in-game** — Neil to do manually
6. **Absorbs (PW:S)** tracking — future enhancement
