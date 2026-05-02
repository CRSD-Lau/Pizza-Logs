# Latest Handoff

## Date
2026-05-02

## Git
**Branch:** `claude/sharp-ramanujan-489f4d` (pending merge to main)
**Latest commit:** `47ff1b3 refactor: remove sync agent, add WowItem DB cache`

---

## What Was Done This Session

### Removed auto-sync infrastructure

The sync agent + bridge approach was abandoned (Cloudflare blocked all automated paths — Node.js fetch, Playwright headless, even Playwright headed). Removed all related code:

- Deleted entire `sync-agent/` directory
- Deleted all `app/api/admin/sync/` API routes (trigger, pending, complete, status, userscript)
- Deleted `components/admin/SyncHealthPanel.tsx`
- Deleted `lib/sync-bridge-client-scripts.ts`
- Deleted `scripts/setup-sync-scheduler.ps1`, `tsconfig.sync.json`, `.env.sync-agent.example`
- Removed `SyncJob` model and enums from Prisma schema
- Removed sync scripts from `package.json`, removed `cross-env` and `vitest` devDeps
- Removed SyncHealthPanel section from `/admin` page, removed `triggerSync` from `actions.ts`

**Going forward:** Use the existing Tampermonkey userscripts manually (they bypass Cloudflare via real browser cookies).

### Added WowItem static DB cache

- Added `WowItem` model to Prisma schema (`wow_items` table): `itemId`, `name`, `itemLevel`, `quality`, `equipLoc`, `iconName`
- Migration: `20260502120000_add_wow_items_remove_sync_jobs` (drops sync_jobs, creates wow_items)
- Updated `lib/wowhead-items.ts` → `enrichGearWithWowhead()` now batch-lookups `WowItem` DB first; only calls Wowhead for unknown items and auto-saves results to DB
- Added `scripts/seed-wow-items.ts` — reads all itemIds from existing `ArmoryGearCache`, fetches Wowhead tooltip API once per item, upserts into `wow_items`
- New npm script: `npm run db:seed-items`

---

## Current State

- **Live app:** https://pizza-logs-production.up.railway.app
- **Worktree branch:** `claude/sharp-ramanujan-489f4d` — ready to merge to main
- **TypeScript:** clean (0 errors)
- **Gear import:** works via Tampermonkey userscript on Warmane Armory pages
- **Item enrichment:** DB-first (WowItem cache), Wowhead as live fallback; new fetches auto-cached

---

## Next Steps

1. **Merge worktree branch to main and push** — Railway auto-deploys; migration applied on deploy
2. **Seed item DB** after deploy: `npm run db:seed-items` — reads existing gear cache, bulk-fetches Wowhead once
3. **Verify gear pages** after seeding — check Writman, Yanna, Lausudo for ilvl, GS, slot labels
4. **Fix HC/Normal difficulty detection** — regression/open task
5. **Stats/Analytics page** — brainstorm first
6. **Verify Skada numbers in-game** — Neil to do manually
7. **Absorbs (PW:S)** tracking — future enhancement
