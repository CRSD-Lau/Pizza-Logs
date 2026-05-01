# Latest Handoff

## Date
2026-04-30

## Git
**Branch:** `main`
**Latest commit before this handoff commit:** `6093d5c chore: add userscript diagnostics`
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

### 3. Admin gear cache import
- Removed the failed server-side "Seed Gear Cache" admin action from the UI and code
- The production-supported admin path is now browser-assisted Warmane API import
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

### 5. Wowhead item enrichment and native hover details
- Added `lib/wowhead-items.ts` to enrich Warmane equipment item IDs with Wowhead WotLK item metadata
- Wowhead enrichment reads the normal Wowhead item page and parses embedded `g_items[...]` data for item name, quality, item level, icon, and tooltip text
- Gear cache writes enrich imported/browser-fetched Warmane items before saving, so player pages can render icons and details from the DB snapshot
- Gear cards on player pages are no longer outbound item links; they are native, non-clicking cards with hover/focus tooltips
- Tooltip content is native Pizza Logs UI, not a Wowhead iframe or embedded external widget
- Admin missing-player queue now treats cached rows without Wowhead metadata as needing re-import/enrichment, so older cached gear can be upgraded by rerunning the bookmarklet
- Browser bookmarklet import now retries each Warmane character fetch up to 4 times with backoff and reports failed character names, because Warmane intermittently fails individual API reads
- Added a recommended Tampermonkey/userscript flow on `/admin` that injects a Pizza Logs Gear Sync panel on Warmane Armory pages and auto-syncs at most once per hour after the admin secret is saved locally in that browser
- Userscript is now hosted at `/api/admin/armory-gear/userscript.user.js` with Tampermonkey `@downloadURL` and `@updateURL` metadata; `/admin` links directly to the hosted install/update URL. The older `/userscript` route remains a compatibility alias.
- Userscript v1.0.2 matches both `https://armory.warmane.com/*` and `http://armory.warmane.com/*`, runs at `document-idle`, and waits for `document.body` before injecting the Pizza Logs panel
- Userscript v1.0.3 adds startup and panel-injection console diagnostics so a missing panel can be distinguished from Tampermonkey not running the script
- Confirmed in browser after enabling Tampermonkey injection: the **Pizza Logs Gear Sync** panel appeared on Warmane Armory and was actively importing queued players (`Importing Rimeclaw (13/18)...`)
- Bookmarklet remains a fallback, but the hosted Tampermonkey userscript is now the supported production workflow for filling/refreshing gear cache rows from existing DB players

### 6. Verification
- `tests/armory-gear-client-scripts.test.ts` passed
- `tests/warmane-armory-cache.test.ts` passed
- `tests/warmane-armory-import.test.ts` passed
- `tests/wowhead-items.test.ts` passed
- `prisma validate` passed with a dummy local `DATABASE_URL`
- `tsc --noEmit` passed via bundled Node runtime
- `next build` passed via bundled Node runtime
- `next lint` could not run non-interactively because this Next.js 15 project has no ESLint config yet and Next prompts for setup

### 7. Gear tooltip clipping fix
- Fixed native gear hover/focus tooltips being clipped inside the player profile Gear accordion/table wrapper
- Root cause: the tooltip was absolutely positioned inside `AccordionSection` content, whose animated collapse wrapper uses `overflow-hidden`
- Extracted `components/players/GearItemCard.tsx` as a client component and renders the tooltip through a `document.body` portal with fixed viewport positioning and top-level overlay z-index
- Tooltip placement now clamps to the viewport and flips above the item when there is not enough room below
- Added `tests/gear-tooltip-position.test.ts` for the viewport positioning helper

### 8. GearScoreLite scoring added to native gear section
- Added `lib/gearscore.ts` with a TypeScript port of the GearScoreLite 3.3.5 item/character score math from `GearScoreLite.lua` and `informationLite.lua`
- Player gear sections now show a GearScoreLite total, quality band, average item level, scored-slot count, and per-item GS values on each gear card/tooltip
- Wowhead item enrichment now stores `equipLoc` from Wowhead `slotbak`/slot metadata so two-hand weapons, ranged weapons, trinkets, rings, and armor slots use the same slot weights as the addon
- Existing cached rows missing `equipLoc` are treated as needing re-enrichment by the admin gear sync queue
- Added `tests/gearscore-lite.test.ts` for the core formula, Wowhead inventory-type mapping, two-hand/titan-grip behavior, hunter weapon modifiers, and character summary output

### 9. Partial gear enrichment bug fixed
- Investigated `/players/Lausudo`: all 18 gear slots were present, and missing rows had item IDs/Wowhead URLs, but only 8 slots had enriched icon/item-level/equip-location details
- Root cause: `enrichGearWithWowhead` fetched every item concurrently and saved partial snapshots when individual Wowhead requests failed transiently
- Added retry/backoff to `fetchWowheadItemData` and capped Wowhead enrichment concurrency at 3 requests
- Fresh cached rows that still need Wowhead enrichment are now re-enriched before being returned by `getWarmaneCharacterGear`, instead of staying partial for the 12-hour cache window
- Added `tests/wowhead-enrichment-retry.test.ts` and expanded `tests/warmane-armory-cache.test.ts`

### 10. Relic/ranged slot and GearScore two-hander bug fixed
- Investigated `/players/Lausudo` and `/players/Aalaska` screenshots showing sparse Warmane equipment arrays sliding weapons/relics into the wrong display slots
- Root cause: Warmane omits empty equipment slots, but Pizza Logs assigned slot labels by raw array index; the GearScore Titan Grip adjustment then saw Lausudo as `Main Hand` 2H + `Off Hand` relic and halved both item scores
- Added `normalizeArmoryGearSlots` to repair display slot names from Wowhead `equipLoc` metadata after enrichment and when reading cached rows
- The ranged/relic equipment slot now displays as `Ranged/Relic`, covering bows/guns/wands/thrown/relics without implying every class uses a physical ranged weapon
- Added `lib/gear-layout.ts` so the player gear grid groups by normalized slot name instead of fixed array slices
- Tightened Titan Grip scoring so the half-score modifier only applies when both main/off-hand items are actual weapons and at least one is a two-hander
- Added regression coverage in `tests/gearscore-lite.test.ts`, `tests/warmane-armory-import.test.ts`, and `tests/gear-layout.test.ts`

### 11. Git/Railway push expectations clarified
- Updated `AGENTS.md`, `CLAUDE.md`, `START HERE.md`, and the Railway runbook with the canonical GitHub remote
- Documented that user requests to push/deploy/publish/get changes live mean `git push origin main`, which triggers Railway's deployment from `origin/main`
- Documented the local Windows Git fallback path: `C:\Program Files\Git\cmd\git.exe`

### 12. Guild Roster feature added
- Added a dedicated `/guild-roster` route and nav link
- Added route-level loading, empty, and error states for the roster page
- Added `GuildRosterMember` / `guild_roster_members` as a separate Prisma-backed roster table, distinct from combat-log `Player` rows
- Added a Prisma migration SQL file at `prisma/migrations/20260430210000_add_guild_roster_members/migration.sql`
- Added `lib/warmane-guild-roster.ts` for JSON-first Warmane roster retrieval:
  - Tries `https://armory.warmane.com/api/guild/<guild>/<realm>/summary`
  - Then tries `/members`
  - Falls back to parsing the native Warmane guild summary HTML
  - Handles the observed Warmane naming split by trying `Pizza+Warriors` before `PizzaWarriors`
- Added upsert sync logic keyed by `normalized_character_name + guild_name + realm`
- Added public DB-backed read API: `GET /api/guild-roster?guild=PizzaWarriors&realm=Lordaeron`
- Added admin/manual sync API: `POST /api/guild-roster/sync`
  - Uses the existing `ADMIN_SECRET` style when configured
  - Returns generic public errors rather than raw scraper failures
  - Has a 30-minute cooldown unless `force: true` is provided
- Added focused validation tests for:
  - Warmane guild URL candidate generation
  - JSON roster normalization
  - malformed/empty roster handling
  - HTML fallback parsing
  - upsert payload behavior
  - roster table empty/data render states
- Verified existing Warmane player gear tests still pass

### 13. Warmane roster API investigation
- Warmane forum documentation confirms API-like guild endpoints:
  - `/api/guild/name/realm/summary`
  - `/api/guild/name/realm/members`
- Warmane forum examples show roster data under `roster`
- Local direct requests from this Windows/Codex environment still returned Cloudflare/403, matching the prior gear-work blocker
- Search index showed the actual Warmane guild title as `Pizza Warriors`; code now tries the camel-split `Pizza+Warriors` candidate first while storing `PizzaWarriors`

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Release**: `v0.1.0`
- **Player profiles**: include a native Warmane Armory Gear section wired to a DB-backed gear cache
- **Guild roster**: `/guild-roster` reads from the DB-backed `guild_roster_members` table; `/api/guild-roster/sync` refreshes from Warmane with JSON-first retrieval and HTML fallback
- **Gear display**: uses Wowhead-enriched icons, quality, item level, equip-location metadata, GearScoreLite totals/per-item scores, and tooltip text when item IDs are present; partial cached snapshots are re-enriched with retry/backoff before rendering; slot labels are repaired from equip-location metadata so sparse Warmane arrays do not shift weapons/relics into the wrong UI slot; tooltips render in a viewport-level portal so they are not clipped by accordion/table wrappers
- **Gear sync**: hosted Tampermonkey userscript v1.0.3 is installed/running on Warmane and actively imports missing or enrichment-needed DB players
- **Git/deploy**: canonical remote is `origin` -> `https://github.com/CRSD-Lau/Pizza-Logs.git`; push live changes with `git push origin main` so Railway deploys from `origin/main`
- **Warmane local access**: blocked by Cloudflare/403 from this Codex shell, handled gracefully by UI
- **Checks run**: Guild roster parser/table tests passed; Warmane gear cache/import tests passed; Wowhead parser/enrichment retry tests passed; `prisma validate` passed; `tsc --noEmit` passed; `next build` passed
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
- Use `/admin` hosted userscript install/update link for ongoing Warmane gear imports; bookmarklet is fallback only
- Warmane API forum note: API accepts `/api/character/<name>/<realm>/summary`, returns JSON errors inside 200 responses, and currently lacks slot/itemlevel fields
- Watch production import timing: each cached Warmane item may trigger Wowhead enrichment on first write or first re-enrichment
- Prefer the hosted `/api/admin/armory-gear/userscript.user.js` install over bookmarklets for ongoing gear cache maintenance
- Tampermonkey should update from the hosted URL; manual copy-paste userscripts still need replacement after deploys that change importer code
- Enchants/gems are still source-limited: Wowhead can provide static item details, but character-specific gems/enchants require Warmane to expose them in the data the importer can read
- Consider adding a dedicated item metadata cache if the Wowhead fetch volume becomes noisy
- Consider historical gear snapshots per raid date

### 6. Guild roster follow-ups
- Apply the Prisma migration in the target database before using `/guild-roster`
- After deploy, run `POST /api/guild-roster/sync` with the admin secret and `{ "guild": "PizzaWarriors", "realm": "Lordaeron", "force": true }`
- If Railway can reach Warmane, the sync should populate `guild_roster_members`; if Warmane blocks Railway too, keep the page DB-backed and consider a browser-assisted roster importer similar to the gear userscript

---

## Next Step

Apply the roster migration, deploy, then call `POST /api/guild-roster/sync` with admin auth and `{ "guild": "PizzaWarriors", "realm": "Lordaeron", "force": true }`. Confirm `/guild-roster` lists PizzaWarriors members from the DB. After that, spot-check `/players/Lausudo` and `/players/Aalaska` for the gear slot fixes; parser priority remains fixing HC/Normal detection in `parser/parser_core.py`.
