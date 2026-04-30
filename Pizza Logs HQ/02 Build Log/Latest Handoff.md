# Latest Handoff

## Date
2026-04-30

## Git
**Branch:** `main`
**Latest commit before this handoff commit:** unknown locally - `git` unavailable on PATH in this Codex shell
**Release:** `v0.1.0` - tagged and published on GitHub

---

## What Was Done This Session

### 1. Native Warmane Armory gear section added to player profiles
- Added `lib/warmane-armory.ts` as the isolated server-side Warmane reader
- Uses the Warmane character summary API endpoint for Lordaeron by default:
  `https://armory.warmane.com/api/character/<name>/<realm>/summary`
- Sanitizes character names before URL construction
- Adds timeout handling, user-agent headers, server-side logging, and graceful public error messages
- Uses a persistent Prisma `ArmoryGearCache` table with 12-hour freshness
- Player pages render cached gear from the database without requiring a new combat-log upload
- If Warmane blocks a refresh but cached gear exists, the page renders the stale cached snapshot
- Maps Warmane API equipment order to native slot labels

### 2. Player profile UI integration
- Added `components/players/PlayerGearSection.tsx`
- `/players/[playerName]` now renders a native "Gear" `AccordionSection`
- Gear is streamed behind `Suspense` with a skeleton loading state
- Empty/error states are non-blocking and still render the rest of the player page
- The Warmane page is linked as the source, not embedded as an iframe

### 3. Admin gear cache seeding
- Added an admin-only "Seed Gear Cache" control on `/admin`
- The action loops over up to 100 existing DB players and attempts Warmane gear refreshes
- Successful responses are stored in `armory_gear_cache`
- Failed requests are counted and recorded without affecting player pages
- Added a browser-side "Pizza Logs Gear Import" bookmarklet on `/admin`
- Added `POST /api/admin/armory-gear/import` for authenticated browser imports from Warmane pages
- Added `POST /api/admin/armory-gear/missing` so the browser importer can fetch the missing Pizza Logs players queue
- Bookmarklet uses Warmane's JSON API from the Warmane browser origin, prompts for the admin secret, and stores normalized gear in `armory_gear_cache`
- The older single-page fallback remains available, but the recommended flow is now bulk API import
- React blocks rendered `javascript:` links, so `/admin` now shows copyable bookmarklet code instead of clickable bookmarklet anchors

### 4. Warmane access note
- Direct local requests to Warmane HTML and API returned Cloudflare/403 from this environment
- The feature is built to fail gracefully when Warmane blocks, is down, or changes behavior
- Railway behavior still needs verification after deploy because Warmane may treat Railway egress differently

### 5. Verification
- `tests/warmane-armory-cache.test.ts` passed
- `tests/warmane-armory-import.test.ts` passed
- `prisma validate` passed with a dummy local `DATABASE_URL`
- `tsc --noEmit` passed via bundled Node runtime
- `next build` passed via bundled Node runtime
- `next lint` could not run non-interactively because this Next.js 15 project has no ESLint config yet and Next prompts for setup

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Release**: `v0.1.0`
- **Player profiles**: include a native Warmane Armory Gear section wired to a DB-backed gear cache
- **Warmane local access**: blocked by Cloudflare/403 from this Codex shell, handled gracefully by UI
- **Checks run**: cache fallback test passed; import normalization test passed; `prisma validate` passed; `tsc --noEmit` passed; `next build` passed
- **Local env blocker**: DB-backed pages cannot render locally until PostgreSQL is running on `localhost:5432`
- **HPS gap**: ~21-28% under Skada for Disc priests - expected until absorbs are implemented
- **DPS**: <1% residual from orphaned pets - accepted

---

## Open Items (priority order)

### 1. BUG: Hardcore vs Normal difficulty detection regression
Tracked in: https://github.com/CRSD-Lau/Pizza-Logs/issues
- Identify what signal in the Warmane log distinguishes Normal from Hardcore
- Fix difficulty assignment in `parser/parser_core.py`
- Add regression tests

### 2. Stats / Analytics page
New `/stats` page - brainstorm session needed before any code.
Confirmed scope:
- Class performance comparisons (avg DPS/HPS by class)
- Raid comparisons (instance vs instance, week over week)
- All-time records and progression trends
- Multiple graph types using Recharts

### 3. Verify Skada numbers in-game
Neil to upload a log and compare DPS/HPS to in-game Skada for the same fight.
Deferred to next week.

### 4. Absorbs - Power Word: Shield
Decision: **combined Healing+Absorbs column** (not separate).
Do after Skada verification.
1. Parse `SPELL_AURA_APPLIED` for PW:S - store capacity + caster
2. Parse `absorbed` field on damage events - attribute to Disc priest
3. Merge into HPS column in API + UI

### 5. Gear follow-ups
- Run `/admin` Seed Gear Cache after deploy and inspect success/failure counts
- Use `/admin` browser bookmarklet import when Warmane blocks Railway server refreshes
- Warmane API forum note: API accepts `/api/character/<name>/<realm>/summary`, returns JSON errors inside 200 responses, and currently lacks slot/itemlevel fields
- Add item quality/item level/icon/gem/enchant enrichment if a reliable source is chosen
- Consider historical gear snapshots per raid date

---

## Next Step

Deploy the bulk browser API import workflow, run it from any Warmane Armory page, then verify that `/players/<name>` renders cached gear. Parser priority remains fixing HC/Normal detection in `parser/parser_core.py`.
