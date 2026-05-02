# Latest Handoff

## Date
2026-05-01

## Git
**Branch:** `claude/sharp-ramanujan-489f4d` (pending merge to main)
**Latest commit:** `4e7a003 feat: use Playwright headless browser for Warmane fetching (bypass Cloudflare)`
**14 commits ahead of main**

---

## What Was Done This Session

### Playwright migration for Warmane fetchers

Replaced `fetch`+AbortController in both `roster.ts` and `character.ts` with a shared Playwright browser instance that runs headed Chrome off-screen to bypass Cloudflare Turnstile.

**Key findings from smoke testing:**
- Plain `fetch` fails with Cloudflare 403 (datacenter or automation-detected IPs)
- `headless: true` Playwright also gets 403 — Cloudflare's Turnstile detects headless via JS fingerprinting
- `headless: false` with `--disable-blink-features=AutomationControlled` + `navigator.webdriver` masking is the correct approach
- Smoke test showed Turnstile Invisible challenge does NOT auto-pass in the Claude Code sandbox (datacenter IP). Will work on Neil's desktop (residential IP) where Turnstile typically auto-resolves
- `fetchWarmaneJson` uses response interception + 20s body polling fallback so it handles both the "CF passes through immediately" and "CF challenge takes a few seconds" cases

**Files changed:**
- `sync-agent/warmane/browser.ts` — NEW: shared Playwright browser, `getBrowser()`, `closeBrowser()`, `fetchWarmaneJson()`
- `sync-agent/warmane/roster.ts` — removed `TIMEOUT_MS`, AbortController, `fetch`; now calls `fetchWarmaneJson`
- `sync-agent/warmane/character.ts` — same; Wowhead `enrichItem` still uses regular `fetch` (Wowhead has no CF)
- `sync-agent/index.ts` — added `SIGINT`/`SIGTERM` handlers to close Playwright browser on bridge stop
- `package.json` / `package-lock.json` — added `playwright@1.59.1`; Chromium binary downloaded to `%APPDATA%/ms-playwright`

**Tests:** 25/25 still pass (pure function tests unaffected by fetcher changes)
**TypeScript:** 0 errors

---

## Previous Session: Warmane Sync Agent — full implementation complete (all 12 tasks)

Built the complete Option B architecture: admin UI sync trigger buttons + desktop bridge service.

**Backend (Railway):**
- `prisma/schema.prisma` — Added `SyncJob` model, `SyncJobType`/`SyncJobStatus` enums; added `lastSuccessAt`, `sourceAgent` to `ArmoryGearCache`
- `prisma/migrations/20260501213536_add_sync_jobs/` — migration applied
- `lib/warmane-armory.ts` — `writeCachedGear` now skips Wowhead enrichment if gear is already enriched (bridge pre-enriches); snapshot preservation guard (never overwrite 10+ item cache with <50% of existing item count)
- `app/api/admin/guild-roster/import/route.ts` — rejects zero-member roster after normalization
- `app/api/admin/sync/trigger/route.ts` — POST creates PENDING SyncJob (no auth)
- `app/api/admin/sync/pending/route.ts` — GET atomically claims oldest PENDING job (`x-admin-secret` required)
- `app/api/admin/sync/complete/route.ts` — POST marks job DONE/FAILED (`x-admin-secret` required)
- `app/api/admin/sync/status/route.ts` — GET returns last job results + pending count (no auth)

**Admin UI:**
- `app/admin/actions.ts` — `triggerSync("ROSTER"|"GEAR")` server action (ADMIN_SECRET never touches browser)
- `components/admin/SyncHealthPanel.tsx` — trigger buttons + live status polling every 10s
- `app/admin/page.tsx` — "Warmane Auto-Sync" section added before Guild Roster section

**Desktop bridge (`sync-agent/`):**
- `sync-agent/validate.ts` — pure fns: HTML challenge detection, Warmane error JSON, gear/roster payload validation
- `sync-agent/config.ts` — loads `.env.sync-agent` via dotenv, exports `SyncConfig`
- `sync-agent/logger.ts` — timestamped logs to stdout + `.sync-agent-logs/sync.log`
- `sync-agent/fetch-util.ts` — shared `fetchWithTimeout` helper (15s default, AbortController)
- `sync-agent/warmane/wowhead.ts` — fetches Wowhead tooltip JSON for `itemLevel`/`iconUrl`
- `sync-agent/warmane/character.ts` — fetches Warmane character summary → enriched `CharacterGear`
- `sync-agent/warmane/roster.ts` — fetches Warmane guild roster → `RosterMember[]`
- `sync-agent/jobs/roster.ts` — ROSTER job handler: fetch → validate → POST to Railway
- `sync-agent/jobs/gear.ts` — GEAR job handler: get queue → fetch each char → enrich → POST each
- `sync-agent/index.ts` — polling loop (5s) + self-scheduler (6h roster / 12h gear) + startup sync
- `tsconfig.sync.json` — TypeScript config for bridge (Node/CommonJS)
- `.env.sync-agent.example` — env template with all config documented
- `scripts/setup-sync-scheduler.ps1` — Windows Task Scheduler registration (AtLogon trigger)
- `package.json` — `sync:warmane`, `sync:warmane:dry`, `test:sync` scripts

**Tests:** 25/25 passing (Vitest, `__tests__/sync-agent/**`)

---

## Current State

- **Live app:** https://pizza-logs-production.up.railway.app
- **Worktree branch:** `claude/sharp-ramanujan-489f4d` — 13 commits, ready to merge to main
- **TypeScript:** clean (`npm run type-check` = 0 errors)
- **Bridge:** fully built, not yet running on Neil's desktop
- **Next deploy:** merge worktree branch → main → push → Railway auto-deploys

---

## Next Steps

1. **Merge worktree branch to main and push** — `git merge claude/sharp-ramanujan-489f4d && git push origin main`
2. **Set up bridge on desktop:**
   - Copy `.env.sync-agent.example` → `.env.sync-agent`, fill in `PIZZA_ADMIN_SECRET`
   - Test dry-run: `npm run sync:warmane:dry`
   - Test live: `npm run sync:warmane`
   - Register Task Scheduler: `powershell -ExecutionPolicy Bypass -File scripts\setup-sync-scheduler.ps1`
3. **Verify end-to-end on live admin page** — `/admin` → "Warmane Auto-Sync" panel; click "Sync Roster", watch status update
4. **Verify gear pages** after sync — check Writman, Yanna, and other players for correct ilvl, GS, and slot labels
5. **Fix HC/Normal difficulty detection** — regression bug/open task
6. **Stats/Analytics page** — brainstorm first
7. **Verify Skada numbers in-game** — Neil to do manually
8. **Absorbs (PW:S)** tracking — future enhancement
