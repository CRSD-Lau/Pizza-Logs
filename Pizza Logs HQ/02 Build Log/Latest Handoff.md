# Latest Handoff

## Date
2026-05-04

## Git
**Feature branch:** `codex/upload-cinematic-intro`
**Deploy target:** `origin/main`
**Latest favicon asset commit:** `527c883` on `origin/main`

---

## What Was Done This Session

### Cinematic intro quality and mobile polish

- Re-rendered the cinematic intro as a sharper web asset set:
  - desktop WebM/MP4: `2560x1440`, `60fps`, `5.2s`, `312` generated frames,
  - mobile WebM/MP4: `1080x1920`, `60fps`, `5.2s`, `312` generated frames,
  - desktop and mobile posters.
- Replaced the public desktop intro files and added mobile-specific files:
  - `public/intro/pizza-logs-cinematic-intro.webm`
  - `public/intro/pizza-logs-cinematic-intro.mp4`
  - `public/intro/pizza-logs-cinematic-poster.jpg`
  - `public/intro/pizza-logs-cinematic-intro-mobile.webm`
  - `public/intro/pizza-logs-cinematic-intro-mobile.mp4`
  - `public/intro/pizza-logs-cinematic-poster-mobile.jpg`
- Updated `FrozenLogbookIntro` to select portrait video sources at `(max-width: 640px)` and use the matching mobile poster for reduced-motion/mobile poster display.
- Tightened intro mobile chrome sizing and full-screen CSS so the brand/skip button remain composed on narrow viewports.
- Fixed `/bosses` mobile layout:
  - desktop keeps the dense table-style grid,
  - mobile now uses boss summary cards instead of forcing the desktop grid,
  - boss cards use the shared `getRevealClassName` / `getRevealStyle` animation style,
  - narrow mobile metric cells now have overflow/min-width guards.
- Review artifacts were generated under ignored temp output:
  - `tmp-mobile-check/hd_cinematic_intro/rendered_v2/`
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/local-intro-desktop-final.png`
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/local-intro-mobile-final.png`
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/local-bosses-mobile-500-final.png`
- No parser behavior, Prisma schema, DB queries, upload logic, admin gates, or Railway config were changed.

### HD cinematic intro design spec

- User rejected the strip-derived previews as too low quality for a modern website intro.
- Agreed direction: treat the frame strips as proof-of-concept storyboards only, not production footage.
- Approved creative target:
  - cinematic Warcraft/WotLK/ICC realism,
  - premium modern web-product polish,
  - frost-armored raid boss emerging through snow,
  - blue-eye reveal,
  - close-up hold,
  - frost/dark fade into the real Pizza Logs page.
- Recommended approach: pre-rendered HD cinematic video asset for the site, rather than live Three.js, because the visual bar is lighting/compositing quality and reliable playback.
- Added implementation-ready design spec:
  - `docs/superpowers/specs/2026-05-04-hd-cinematic-intro-design.md`
- Added implementation plan:
  - `docs/superpowers/plans/2026-05-04-hd-cinematic-intro-asset.md`
- Built a review-only HD cinematic proof under ignored temp output:
  - `tmp-mobile-check/hd_cinematic_intro/key_shots/source_contact_sheet.png`
  - `tmp-mobile-check/hd_cinematic_intro/render_hd_cinematic.py`
  - `tmp-mobile-check/hd_cinematic_intro/rendered/intro_hd_cinematic_review.mp4`
  - `tmp-mobile-check/hd_cinematic_intro/rendered/intro_hd_cinematic_review.webm`
  - `tmp-mobile-check/hd_cinematic_intro/rendered/review_contact_sheet.jpg`
- Review render uses newly generated HD key art, not the old frame strips, and does not include mock website UI.
- Verified review render:
  - 6 key shots sliced from generated contact sheet,
  - 300 rendered frames,
  - 1920x1080,
  - 60fps,
  - 5.0s MP4/WebM outputs.

### HD cinematic intro website integration

- Replaced the old CSS-only `FrozenLogbookIntro` particle/title treatment with the generated HD cinematic video.
- Added web-served intro assets:
  - `public/intro/pizza-logs-cinematic-intro.webm`
  - `public/intro/pizza-logs-cinematic-intro.mp4`
  - `public/intro/pizza-logs-cinematic-poster.jpg`
- Intro behavior now:
  - plays on hard page load as the site intro,
  - uses WebM first with MP4 fallback,
  - keeps an always-available `Skip` button,
  - exits on video end or after the `5200ms` safety timeout,
  - avoids replaying on every client-side route change because a five-second movie on every navigation is too intrusive,
  - respects `prefers-reduced-motion` by showing the poster briefly and closing after `350ms`.
- Updated the source regression so the app cannot silently fall back to the old CSS particle intro.
- Browser review artifacts are under ignored temp output:
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/desktop-intro-latest-edge.png`
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/desktop-after-latest-edge.png`
- Deployed to `origin/main` at `5a6ef83`.
- Production verification after Railway deploy:
  - `/intro/pizza-logs-cinematic-intro.webm` returned HTTP 200 with `video/webm`,
  - `/intro/pizza-logs-cinematic-intro.mp4` returned HTTP 200 with `video/mp4`,
  - `/intro/pizza-logs-cinematic-poster.jpg` returned HTTP 200 with `image/jpeg`,
  - production layout bundle contained `pizza-logs-cinematic-intro.webm` and no `frozen-intro-particle` marker,
  - Edge headless production screenshots confirmed the cinematic overlay and post-fade app reveal.
- Production screenshots:
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/production-intro-edge.png`
  - `tmp-mobile-check/hd_cinematic_intro/site_integration/production-after-edge.png`
- No parser behavior, Prisma schema, DB queries, upload logic, admin gates, or Railway config were changed.

### MVP animation pass

- Added a `FrozenLogbookIntro` overlay mounted from `app/layout.tsx`.
- The intro is CSS-only and uses the existing dark/gold/frost palette:
  - dark ICC-style background treatment,
  - subtle CSS frost particles,
  - small frost/gold glow mark,
  - `Pizza Logs` title reveal,
  - tagline `Raid data, forged from combat logs.`
- The intro is capped at `3000ms`, has a visible `Skip` button, and unmounts after skip or completion.
- The intro now appears on initial load and every client-side route change, not only first visit.
- Reduced-motion users get no particle/entry animations and a short `350ms` intro timeout.
- Added shared CSS reveal classes:
  - `.reveal-item`
  - `.boss-reveal-item`
- Added `lib/ui-animation.ts` for reusable reveal styles/classes and centralized boss display ordering:
  - timestamped encounter/session rows sort by `startedAt` and preserve original order for equal timestamps,
  - fallback uses the existing ICC progression helper when timestamps are not available.
- Wired subtle reveal animations into:
  - `/raids` session cards,
  - raid session encounter rows,
  - raid session roster chips,
  - session player encounter rows,
  - `/leaderboards` boss sections,
  - leaderboard DPS/HPS rows,
  - `/players` player cards,
  - player profile records, per-boss cards, and recent encounter rows,
  - damage/target meter rows.
- No framer-motion dependency was added because the repo does not already include it.
- No parser behavior, Prisma schema, DB queries, navigation structure, layout structure, copyrighted images, audio, 3D, WebGL, or external assets were added.
- Count-up number animation was intentionally not added; there was no existing safe utility, and data accuracy/readability is more important for this MVP.

### Animation visibility follow-up

- User reported the intro only appeared briefly once while navigating to Guild and that the other animations were not obvious.
- Root cause:
  - the intro behaved as coded, but one-time `localStorage` had no easy replay path,
  - reveal animations were too subtle at `260ms` with `45ms` stagger,
  - Guild roster rows were not included in the reveal wiring even though the user landed there,
  - Tailwind purged `.reveal-item` and `.boss-reveal-item` from production CSS because the class names came from `lib/ui-animation.ts`, while Tailwind content scanning only covers `pages/`, `components/`, and `app/`.
- Added `?intro=1` support so the intro can be replayed without clearing localStorage.
- Increased shared reveal timing to `420ms` with `70ms` stagger and a slightly larger upward motion so row/card reveals are visible but still lightweight.
- Wired Guild roster table rows into the shared reveal helper.
- Added a Tailwind safelist for the shared reveal classes so the built production CSS includes the animation selectors and keyframes.
- Follow-up per user request: removed the normal `localStorage` gate and changed the intro to replay on every page change using `usePathname()`. The explicit `?intro=1` replay URL is no longer needed for normal behavior.

### Desktop branch/worktree cleanup

- Confirmed `C:\Users\neil_\OneDrive\Desktop\PizzaLogs` is the active project checkout.
- Identified `C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix` as an old Git worktree for `main`, with no uncommitted/untracked source changes and no unique commits ahead of `origin/main`.
- Removed the orphaned worktree folder and stale `.git/worktrees/PizzaLogs-main-queue-fix` metadata after Git partially deregistered it but Windows ACL deny rules blocked normal deletion.
- Switched the active checkout from `codex/pizza-logs-modernization` to `main`.
- Deleted local merged branches so only local `main` remains.
- Deleted remote `origin/codex/pizza-logs-modernization` after verifying it pointed at the same commit as `origin/main`.
- Preserved and committed Obsidian vault UI-state files because the vault is part of Neil's AI brain workflow.

### GearScore per-item display repair

- Fixed player gear cards showing hunter melee weapon contribution scores as the visible per-item `GS`.
- Root cause: `GearItemCard` was fed `calculateGearScore().itemScores`, which is the class-adjusted contribution used for the total GearScoreLite calculation. For hunters, one-hand melee weapons are multiplied by `0.3164`, so heroic Scourgeborne Waraxe displayed as `168` instead of its raw item GearScore `531`.
- Added `displayItemScores` to `GearScoreSummary` for raw per-item display values while preserving `itemScores` as contribution values for the total score.
- Updated `PlayerGearSection` so visible item-card `GS` values use `displayItemScores`.
- Follow-up production check showed Notlich's summary total was still below the in-game `6237` because the hunter-specific melee/ranged weighting still applied to the total. Removed the hunter-only weapon modifiers from the total calculation so hunter one-hand weapons count at their normal item score; Titan Grip handling remains intact.
- Added a regression covering hunter dual heroic Scourgeborne Waraxes: item cards and total contribution should count `531` for Main Hand and `531` for Off Hand.
- Fixed the AzerothCore `InventoryType` mapping for thrown, ranged-right, and relic items:
  - `25 -> INVTYPE_THROWN`
  - `26 -> INVTYPE_RANGEDRIGHT`
  - `28 -> INVTYPE_RELIC`
- Added a data repair migration to update previously imported `wow_items` rows for guns/crossbows, thrown weapons, and relics that were imported with the shifted equip locations.

### ICC boss display ordering

- Added a single ICC progression-order source in `lib/constants/bosses.ts`:
  - `ICC_BOSS_ORDER_NAMES`
  - `ICC_BOSS_ORDER`
  - `normalizeIccBossName`
  - `sortByICCOrder`
  - `sortBossesByICCOrder`
- The helper keeps known Icecrown Citadel bosses in kill order from Lord Marrowgar through The Lich King, puts unknown/non-ICC bosses after known ICC bosses, and preserves original order for duplicates and other fallback ties.
- Added normalization for common non-canonical labels:
  - `Gunship`
  - `Gunship Battle - Alliance`
  - `Gunship Battle - Horde`
  - `Skybreaker`
  - `The Skybreaker`
  - `Orgrim's Hammer`
  - `Lich King`
  - `Arthas`
  - `Blood Queen Lanathel` variants
- `/leaderboards` no longer orders boss boards alphabetically. It fetches bosses by seeded `sortOrder` and applies the shared ICC sorter before building DPS/HPS boards.
- Raid session encounter displays now apply the shared ICC sorter in:
  - `app/uploads/[id]/sessions/[sessionIdx]/page.tsx`
  - `app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx`
  - the `/raids/...` routes re-export those pages.
- Parser output was inspected: `parser/bosses.py` emits canonical ICC boss names matching `WOTLK_BOSSES`, and uploads map parser `bossName` to the normalized `bosses` table by name.
- No parser behavior, Prisma schema, or UI structure was changed.

### Player profile Per-Boss Summary ordering

- Fixed `/players/<name>` Per-Boss Summary cards sorting by best DPS instead of ICC progression order.
- Added `buildPlayerPerBossSummary` in `lib/player-profile.ts` so the player page groups kills/best DPS/best HPS in one tested helper.
- The helper uses the shared `sortByICCOrder` from `lib/constants/bosses.ts`, so player summaries now follow the same canonical ICC order as raid sessions and leaderboards.
- Unknown/non-ICC bosses retain the shared fallback behavior from the ICC sorter.

### Remaining ICC display ordering follow-up

- Fixed `/players/<name>` Recent Encounters so the most recent 20-player-encounter window is displayed in ICC progression order instead of reverse chronological boss order.
- Added `buildPlayerRecentEncounters` in `lib/player-profile.ts`; duplicates keep their original order within the same boss.
- Fixed `/weekly` Boss Kills This Week sorting by kill count instead of ICC progression order.
- Added `buildWeeklyBossKills` in `lib/weekly-stats.ts` and reused it in both:
  - `app/weekly/page.tsx`
  - `app/api/weekly/route.ts`

### Codex push expectation

- Updated `AGENTS.md` to record that Neil does not test local-only changes.
- Future validated change sessions should commit and push scoped changes to Git unless Neil explicitly asks to keep work local.
- Ordinary branch work should push the current branch; deploy/live/publish/main requests still follow Railway rules and push `origin/main` only after the required gates pass.

### Global player search

- Added a reusable `PlayerSearch` client component for the global header.
- Mounted search in `components/layout/Nav.tsx`:
  - large screens show a compact header search input,
  - smaller screens show a visible search row in the header below the logo/menu row,
  - mobile nav closes after selecting a player result.
- Added `GET /api/players/search?q=<query>` backed by `lib/player-search.ts`.
- Search reads only lightweight fields from:
  - combat-log `players`,
  - scoped PizzaWarriors/Lordaeron `guild_roster_members` for roster-only characters.
- Search does not scan uploads, participants, combat-log rows, `readGuildRosterMembers()`, or gear cache blobs.
- Results are merged by name+realm, exact matches rank first, partial matches are case-insensitive, and returned profile paths use `encodeURIComponent`.
- Header search supports debounced API calls, simple client-side query caching, loading/empty/error states, clear button, Enter, Escape, arrow highlight, click outside close, and click result navigation.
- Updated README and vault data-model/feature-status docs.
- No Prisma migration was added.

### Admin page local DB outage guard

- Fixed `/admin` crashing the whole dev page when local Postgres is unavailable.
- `app/admin/page.tsx` now catches dashboard Prisma read failures, keeps the page/header rendering, marks the Database service card as unavailable, and shows a database warning instead of triggering the Next error overlay.
- Added regression coverage for rendering the admin diagnostics page with a mocked unavailable database.

### Public page local DB outage guard

- Added shared database-connection error detection and a dark UI `DatabaseUnavailable` warning component.
- Main public routes now catch local database connection failures and still render the shared layout/header/search:
  - `/`
  - `/players`
  - `/raids`
  - `/leaderboards`
  - `/bosses`
  - `/weekly`
- Offline pages hide the normal empty-data states so they do not incorrectly say there are no players, raids, leaderboards, encounters, or weekly data when the database is simply down.
- Non-connection errors still throw normally so real application bugs are not hidden.

### Local PostgreSQL setup

- Installed PostgreSQL 16 locally through `winget`.
- Created the local `pizzalogs` role and `pizzalogs` database expected by `.env.local`.
- Ran Prisma client generation and `prisma db push`.
- Seeded base boss/realm data and imported AzerothCore `item_template` metadata into `wow_items`.
- Restarted the local Next dev server on `http://127.0.0.1:3000`.
- This fresh local DB has schema/static data but no uploaded combat logs, roster imports, players, raids, or encounters yet.

### Warmane rendered character face capture expanded

- Extended `PlayerAvatar` to support compact table/chip sizing.
- Replaced guild roster initials with `PlayerAvatar`, including name, realm, class, race, guild, and class-icon fallback metadata.
- Replaced the session player deep-dive initials header with `PlayerAvatar`.
- Added avatars to the session Raid Roster chips so the player deep-dive entry points can also be upgraded by the portrait userscript.
- Enhanced the portrait userscript to `0.2.0`:
  - runs on Pizza Logs pages and Warmane character pages,
  - shares cache through Tampermonkey `GM_getValue` / `GM_setValue`,
  - tries static Warmane portrait URLs first,
  - then tries to cache the rendered Warmane character canvas as a data URL when browser security allows it,
  - keeps class-icon and initials fallback behavior.
- Updated `/admin` copy to explain that exact rendered faces require opening a Warmane character page once after installing the portrait userscript.
- No Prisma migration was added.

### Portrait scrape fallback follow-up

- User confirmed portraits still fell back to class icons after opening Warmane character pages.
- Root-cause hypothesis: Warmane's rendered character model can be inside a Wowhead/Zamimg modelviewer frame, while Portrait Userscript `0.2.0` only matched the Warmane parent page and Pizza Logs pages.
- Updated Portrait Userscript to `0.3.0`:
  - matches Wowhead/Zamimg modelviewer frame URLs,
  - captures readable modelviewer canvases from inside those frames,
  - uses the Warmane page `document.referrer` when available,
  - also writes a short-lived Warmane target handoff through Tampermonkey storage so frame capture still works if the browser strips the referrer path.
- Added regression tests for modelviewer frame capture and referrer-less frame capture.
- User then reported the avatar was black once, and after reload fell back to class icons.
- Root-cause confirmation: the userscript accepted a blank/black modelviewer canvas as a valid portrait because it only checked data URL length.
- Updated Portrait Userscript to `0.4.0`:
  - rejects very small canvas exports,
  - samples readable canvas pixels and rejects visibly blank/black canvases,
  - keeps retrying instead of caching blank captures,
  - uses a new `pizzaLogsWarmanePortraitCacheV2` storage key so stale black/null captures from earlier versions are ignored.
- Added a regression test that proves a blank modelviewer canvas is not cached.

### Portrait black-canvas and Warmane CDN mixed-content follow-up

- User reported production still showing a black avatar square for Lausudo and Chrome mixed-content warnings for Warmane gear icons loaded from `http://cdn.warmane.com/...`.
- Root-cause confirmation:
  - Portrait Userscript `0.4.0` rejected blank canvases only when pixels were readable from the source canvas as `2d`; a WebGL modelviewer canvas can return `null` for `getContext("2d")`, causing a long black `toDataURL()` export to be accepted.
  - Gear cache data could preserve Warmane CDN icon URLs with an `http://` scheme, so production HTTPS pages triggered browser mixed-content auto-upgrade warnings.
- Updated Portrait Userscript to `0.5.0`:
  - samples modelviewer output by drawing the source canvas into a fresh scratch 2D canvas,
  - treats unreadable/blank sampling as not cacheable instead of accepting unknown content,
  - keeps retrying instead of writing a black portrait,
  - uses `pizzaLogsWarmanePortraitCacheV3` so stale black/null captures from earlier versions are ignored.
- Normalized imported and cached gear icon URLs to HTTPS, including existing `http://cdn.warmane.com/...` snapshots read through `normalizeArmoryGearSlots`.
- No Prisma migration was added.

### Warmane character portrait userscript POC

- Replaced duplicated player initials markup with `components/players/PlayerAvatar.tsx`.
- `PlayerAvatar` accepts `portraitUrl` and class-icon fallback data, preserves initials when images fail, and exposes stable `data-pizza-avatar` attributes for browser scripts.
- `lib/player-profile.ts` now carries `portraitUrl: null` so future backend/cache integration has a clean field instead of hard-coded visual logic.
- Added `lib/warmane-portrait.ts` for Warmane profile URL building, static portrait URL extraction, and class icon fallback URL generation.
- Added hosted Tampermonkey route:
  - `/api/player-portraits/userscript`
  - `/api/player-portraits/userscript.user.js`
- The portrait userscript runs on production and local Pizza Logs URLs, uses `GM_xmlhttpRequest` against Warmane, caches results in `localStorage` for 7 days, and can be disabled with `localStorage.pizzaLogsWarmanePortraitsDisabled = "1"`.
- The userscript handles both the new avatar data attributes and the currently deployed player header/list markup by inferring the character from `/players/<name>`, nearby `h1`, and initials boxes.
- Follow-up fix added the portrait userscript install link to `/admin` in the existing Warmane Gear Cache userscript card, alongside the gear sync userscript link.
- No Prisma migration was added. Portraits are a browser-side proof of concept for now.

### Favicon aligned with the in-app logo mark

- Added `app/icon.svg` using the existing `PizzaIcon` SVG geometry and gold color from `components/layout/Nav.tsx`.
- Added `public/favicon.ico` from the same SVG geometry so legacy browser requests to `/favicon.ico` no longer 404.
- Did not use the attached raster image; both favicon assets mirror the logo mark already rendered by the web app.
- Left parser behavior, admin flows, database schema, and Railway config untouched.

### Codex modernization and repository cleanup

- Created and committed modernization branch `codex/pizza-logs-modernization`.
- Removed tracked Claude-only artifacts:
  - `CLAUDE.md`
  - `.claude/launch.json`
  - stale Claude/Superpowers vault reference docs copied into the repo
  - stale `docs/superpowers` implementation plan/spec files
- Removed local Claude worktrees and stale generated/untracked artifacts after review.
- Converted vault AI-control docs to Codex-first docs:
  - `Codex Resume Prompt.md`
  - `Codex Prompts.md`
  - `Codex Gotchas.md`
  - `Codex Skills Index.md`
  - `Codex Skills and Plugins.md`
- Expanded `AGENTS.md` into the canonical Pizza Logs Codex guide covering parser safety, setup/dev/test/build commands, Railway expectations, Git hygiene, secrets, stale-code deletion rules, and Codex review rules.
- Added `docs/code-review.md` and updated `CONTRIBUTING.md`, `README.md`, `SECURITY.md`, Railway/env docs, and vault links.

### Safety and hygiene fixes

- Admin auth now fails closed in production when `ADMIN_SECRET` is missing.
- Admin login now sets the admin cookie server-side as `HttpOnly`.
- Admin import/sync routes use shared `lib/admin-auth.ts`.
- `.env.example` now documents `ADMIN_SECRET` and the local-only `ADMIN_COOKIE_SECURE=false` compose override.
- `.dockerignore` now excludes local agent dirs, combat logs, build/test caches, screenshots, and vault docs from Docker build context.
- `docker-compose.yml` parser service now builds from repo-root context so `parser/Dockerfile` paths resolve.
- `docker-compose.yml` now passes a local default `ADMIN_SECRET` and disables secure admin cookies for local HTTP compose, so compose remains usable with production-mode web builds while Railway production still requires an explicit secret and secure cookies by default.
- `package.json` lint script now uses ESLint CLI with `eslint.config.mjs`.
- Follow-up review fixes removed accidental `{` ignore patterns, fixed deleted vault links, and cleared `git diff --check` whitespace.

### Stale code removed

- Deleted deprecated Wowhead runtime enrichment module and tests:
  - `lib/wowhead-items.ts`
  - `tests/wowhead-enrichment-retry.test.ts`
  - `tests/wowhead-items.test.ts`
- Renamed the remaining numeric inventory-type helper from Wowhead-specific naming to generic item-template naming.
- Removed the duplicated `/parse-stream` line-count/progress block in `parser/main.py`; parser math/segmentation behavior was not changed.
- Updated stale guild roster admin test assertion to match the current userscript/admin panel UI.
- Renamed passive-heal parser tests so their names match the Skada-confirmed behavior: Judgement of Light, Vampiric Embrace, and Improved Leader of the Pack are included in healing totals.

### Maxximusboom missing from gear sync queue

Preserved the main-branch queue fix while merging modernization:

- `app/api/admin/armory-gear/missing/route.ts` no longer pre-limits player and roster candidate queries before filtering.
- The route still caps the final returned queue to `MAX_PLAYERS`.
- The regression keeps Maxximusboom visible even after many fresh cached players.

### Documentation sync after push

- Updated vault docs that still described pre-push work as incomplete.
- Moved admin auth, footer text, reset cleanup, and Gear Sync icon backfill into shipped/resolved docs.
- Updated Backlog, Feature Status, Technical Debt, Security Checklist, Known Issues, Now, and this handoff to reflect `origin/main` state.

---

## Verification

- MVP animation pass:
  - `tests/ui-animation.test.ts` -> failed first on missing `lib/ui-animation`, then passed.
  - `tests/frozen-intro-source.test.ts` -> failed first on missing `components/intro/FrozenLogbookIntro.tsx`, then passed.
  - `tests/boss-order.test.ts` -> passed.
  - `tests/player-profile.test.ts` -> passed.
  - `tests/player-search-ui-source.test.ts` -> passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed in the OneDrive checkout.
  - Local HTTP smoke on built server `http://127.0.0.1:3005` returned HTTP 200 for `/raids`, `/leaderboards`, and `/players`.
  - The Browser plugin's Node REPL bridge was blocked by Windows access control, so manual browser verification used local headless Chrome through the DevTools protocol.
  - Chrome checks confirmed:
    - first visit shows the intro, skip button, and tagline,
    - skip unmounts the overlay and writes `pizzaLogsFrozenIntroSeen = "1"`,
    - refresh after skip does not show the intro,
    - automatic completion unmounts and writes the same key,
    - reduced-motion hides particles, disables overlay animation, and unmounts quickly,
    - mobile `/players` at `390x844` has no horizontal overflow and keeps the mobile nav/search available.
  - Pushed `main` to `origin/main` at `8a6de54`.
  - Production poll confirmed Railway deployed the new client bundle when `/_next/static/chunks/app/layout-f6656fa126cc1614.js` contained `pizzaLogsFrozenIntroSeen` after one transient 502 during deploy.
  - Production headless Chrome check confirmed first-visit intro, skip/localStorage behavior, and mobile `/players` nav/search/no-horizontal-overflow on `https://pizza-logs-production.up.railway.app`.
- Animation visibility follow-up:
  - `tests/frozen-intro-source.test.ts` -> failed first on missing `INTRO_REPLAY_PARAM`, then passed.
  - `tests/ui-animation.test.ts` -> failed first on the old `260ms` / `45ms` reveal timing, then passed; the test now also covers the Tailwind safelist for `reveal-item` and `boss-reveal-item`.
  - `tests/guild-roster-table-render.test.ts` -> failed first because Guild roster rows did not render `reveal-item`, then passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed.
  - Local headless Chrome check against `http://127.0.0.1:3006` confirmed `?intro=1` replays the intro even with `pizzaLogsFrozenIntroSeen = "1"`, Skip still unmounts the overlay, and a normal refresh does not replay it.
  - Local production CSS check against `http://127.0.0.1:3007` confirmed the generated stylesheet contains `.reveal-item`, `.boss-reveal-item`, `@keyframes revealItem`, `@keyframes bossRevealItem`, and the `420ms` reveal timing.
- Route-change intro follow-up:
  - `tests/frozen-intro-source.test.ts` -> failed first because the intro still used the old localStorage gate and `2300ms` duration, then passed after switching to `usePathname()` and `3000ms`.
  - `tests/ui-animation.test.ts` -> passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed.
  - Local Chrome/CDP check against built app returned `{"initialIntro":true,"routeChangeIntro":true,"pathname":"/players"}` after skipping the initial intro and clicking the `/players` nav link.
  - Parser tests: bundled Python running `python -m pytest tests/ -v` from `parser/` -> 123 passed.
  - Production bundle check after Railway deploy confirmed the live client no longer contains `pizzaLogsFrozenIntroSeen`, does contain the intro text, does contain the route/pathname hook marker, and contains the minified `3000ms` duration marker.
- GearScore display repair:
  - `tests/gearscore-lite.test.ts` -> passed, including hunter dual heroic Scourgeborne Waraxe card and contribution scores of `531`/`531`
  - `tests/item-template.test.ts` -> passed, including corrected `InventoryType` 25/26/28 mapping
  - Full TypeScript test sweep through PowerShell loop over `tests/*.test.ts` -> passed
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed
  - Prisma validate with local `DATABASE_URL` -> passed
  - `git diff --check` -> passed
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed
  - Local fresh DB is not migration-baselined, so `prisma migrate deploy` refused with P3005 as expected; the repair SQL was verified directly with `psql`, updating guns/crossbows to `INVTYPE_RANGEDRIGHT`, thrown weapons to `INVTYPE_THROWN`, and relics to `INVTYPE_RELIC`
- ICC boss ordering:
  - `tests/boss-order.test.ts` -> passed after first failing on missing exports.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed.
  - Parser tests: bundled Python running `python -m pytest tests/ -v` from `parser/` -> 123 passed.
  - `git diff --check` -> passed.
- Player profile Per-Boss Summary ordering:
  - `tests/player-profile.test.ts` -> passed after first failing on the missing `buildPlayerPerBossSummary` export.
  - `tests/boss-order.test.ts` -> passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed.
  - Parser tests: bundled Python running `python -m pytest tests/ -v` from `parser/` -> 123 passed.
  - `git diff --check` -> passed.
- Remaining ICC display ordering follow-up:
  - `tests/player-profile.test.ts` -> passed after first failing on the missing `buildPlayerRecentEncounters` export.
  - `tests/weekly-stats.test.ts` -> passed after first failing on missing `lib/weekly-stats`.
  - `tests/boss-order.test.ts` -> passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> passed.
  - Parser tests: bundled Python running `python -m pytest tests/ -v` from `parser/` -> 123 passed.
  - `git diff --check` -> passed.
- Global player search:
  - `tests/player-search.test.ts` -> passed.
  - `tests/player-search-route.test.ts` -> passed.
  - `tests/player-search-ui-source.test.ts` -> passed.
  - Full TypeScript test sweep with JSX/compiler alias registration -> 21 tests passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - In-place OneDrive production build hit the known `.next` `readlink` issue.
  - Clean temp-copy production build outside OneDrive -> passed with exit code 0. It emitted the expected Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
- Admin page local DB outage guard:
  - `tests/admin-page-db-unavailable.test.ts` -> passed.
  - Local dev `/admin` with local Postgres unavailable returned HTTP 200 and rendered `Search players`, `Database unavailable`, and `Upload analytics are unavailable`.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Focused ESLint: bundled Node running `node_modules/eslint/bin/eslint.js app/admin/page.tsx tests/admin-page-db-unavailable.test.ts --max-warnings=0` -> passed.
- Fresh final gates after the search/admin changes:
  - `tests/player-search.test.ts`, `tests/player-search-route.test.ts`, `tests/player-search-ui-source.test.ts`, and `tests/admin-page-db-unavailable.test.ts` -> passed.
  - Full TypeScript test sweep with `TS_NODE_BASEURL=.` alias registration -> 23 tests passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Clean temp-copy production build outside OneDrive -> passed with exit code 0.
  - Local dev server required clearing generated `.next` after stale missing webpack chunk errors; after restart, `/admin` returned HTTP 200 with the header search and database warning while Postgres remained offline.
  - Local smoke test with Postgres offline returned HTTP 200 and rendered `Search players` for `/`, `/players`, `/raids`, `/leaderboards`, `/bosses`, `/guild-roster`, `/weekly`, `/admin`, and `/admin/login`; the offline pages showed `Database unavailable` without false empty-data states. `/uploads` returned the expected redirect.
- Local PostgreSQL setup:
  - `localhost:5432` TCP check -> passed.
  - DB counts after setup -> 53 bosses, 4 realms, 38,610 imported item rows, 0 players.
  - Local smoke test with Postgres online returned HTTP 200 and no `Database unavailable` warning for `/`, `/players`, `/raids`, `/leaderboards`, `/bosses`, `/guild-roster`, `/weekly`, `/admin`, `/admin/login`, `/api/players/search?q=lich`, `/api/bosses`, `/api/leaderboard`, `/api/weekly`, `/api/guild-roster`, `/api/encounters`, and `/api/uploads`.
- Character portrait POC:
  - `tests/guild-roster-table-render.test.ts` -> passed with bundled Node, `ts-node/register`, and manual `tsconfig-paths` alias registration.
  - `tests/session-avatar-source.test.ts` -> passed.
  - `tests/player-portrait-client-scripts.test.ts` -> passed, including Warmane-page rendered canvas cache and Pizza Logs cache reuse.
  - `tests/gear-import-bookmarklet.test.ts` -> passed.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Lint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Clean temp-copy production build outside OneDrive: passed with exit code 0. It emitted the expected Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
- Portrait scrape fallback follow-up:
  - `tests/player-portrait-client-scripts.test.ts` -> passed, including Wowhead/Zamimg modelviewer frame capture and blank-referrer Warmane target handoff.
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
  - Focused ESLint: bundled Node running `node_modules/eslint/bin/eslint.js lib/player-portrait-client-scripts.ts tests/player-portrait-client-scripts.test.ts --max-warnings=0` -> passed.
  - `git diff --check` -> passed.
  - Clean temp-copy production build outside OneDrive: passed with exit code 0. It emitted the expected Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
  - Follow-up `0.4.0` blank-canvas fix:
    - `tests/player-portrait-client-scripts.test.ts` -> passed, including blank modelviewer canvas rejection.
    - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
    - Focused ESLint: bundled Node running `node_modules/eslint/bin/eslint.js lib/player-portrait-client-scripts.ts tests/player-portrait-client-scripts.test.ts --max-warnings=0` -> passed.
    - `git diff --check` -> passed.
    - Clean temp-copy production build outside OneDrive: passed with exit code 0. It emitted the expected Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
  - Follow-up `0.5.0` WebGL black-canvas and HTTPS icon fix:
    - `tests/player-portrait-client-scripts.test.ts` -> passed, including WebGL-style blank canvas rejection through scratch-canvas sampling.
    - `tests/warmane-armory-import.test.ts` -> passed, including Warmane CDN `http://` to `https://` normalization for new imports and cached slot normalization.
    - `tests/armory-gear-client-scripts.test.ts` -> passed.
    - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed.
    - Focused ESLint: bundled Node running `node_modules/eslint/bin/eslint.js lib/player-portrait-client-scripts.ts lib/warmane-armory.ts tests/player-portrait-client-scripts.test.ts tests/warmane-armory-import.test.ts tests/armory-gear-client-scripts.test.ts --max-warnings=0` -> passed.
    - Full ESLint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed.
    - `git diff --check` -> passed.
    - Clean temp-copy production build outside OneDrive -> passed with exit code 0. It emitted the expected Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
  - Direct local `curl`/`Invoke-WebRequest` to Warmane character summary and API returned HTTP 403 Cloudflare challenge headers, confirming the server/backend path is unreliable for this quick pass.
  - Headless Playwright through local Edge also remained on the Cloudflare "Just a moment..." verification page.
  - Web-rendered Warmane profile pages confirmed the public URL pattern `/character/<name>/<realm>/summary` and profile text, but did not expose a clearly verifiable static portrait in the extracted HTML.
  - AzerothCore docs confirm character DB tables carry race/class/gender/customization/equipment metadata, not a rendered portrait URL.
  - Focused tests:
    - `tests/warmane-portrait.test.ts` -> passed
    - `tests/player-portrait-client-scripts.test.ts` -> passed
    - `tests/gear-import-bookmarklet.test.ts` -> passed
    - `tests/player-profile.test.ts` -> passed
    - `tests/armory-gear-client-scripts.test.ts` -> passed
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> passed
  - Lint: bundled Node running `node_modules/eslint/bin/eslint.js . --max-warnings=0` -> passed
  - Production build passed once after the avatar route/component work.
  - A later rebuild in the OneDrive checkout failed because `.next` generated files became OneDrive reparse/cloud files and Next tried to `readlink` them. Generated `.next` was not deleted because that requires explicit user confirmation.
  - Clean temp-copy production build outside OneDrive: passed with exit code 0. It emitted a Windows-only standalone trace warning because the temp copy used a junction to this checkout's `node_modules`; Railway installs normal dependencies and should not hit that junction warning.
  - Local userscript route check: `http://127.0.0.1:3000/api/player-portraits/userscript.user.js` returned HTTP 200 with `text/javascript`.
  - Local player page HTTP check could not complete because local Postgres was not running at `localhost:5432`.
- Favicon update:
  - Reproduced the reported issue locally: `http://127.0.0.1:3000/favicon.ico` returned **404** before adding the ICO.
  - Reproduced the reported issue on production before deploy: `https://pizza-logs-production.up.railway.app/favicon.ico` returned **404**.
  - Production also returned **404** for `https://pizza-logs-production.up.railway.app/icon.svg` before deploy because the favicon assets were not deployed yet.
  - `app/icon.svg` XML parse: **passed**
  - `public/favicon.ico` inspection: **passed**, ICO with `16x16`, `32x32`, and `48x48` sizes
  - TypeScript: bundled Node running `node_modules/typescript/bin/tsc --noEmit` -> **passed**
  - Production build: bundled Node running `node_modules/next/dist/bin/next build` -> **passed**, and build output includes static route `/icon.svg`
  - Local built app: `http://127.0.0.1:3000/favicon.ico` returned HTTP 200 with `image/x-icon`
  - Local built app: `http://127.0.0.1:3000/icon.svg` returned HTTP 200 with `image/svg+xml`
  - Production after deploy: `https://pizza-logs-production.up.railway.app/favicon.ico` returned HTTP 200 with `image/x-icon`
  - Production after deploy: `https://pizza-logs-production.up.railway.app/icon.svg` returned HTTP 200 with `image/svg+xml`
  - Production player page check: `https://pizza-logs-production.up.railway.app/players/Lichkingspet` returned HTTP 200
- Modernization branch gates before merge:
  - Parser tests: `python -m pytest tests/ -v` from `parser/` using bundled Python -> **123 passed**
  - TypeScript test sweep: `ts-node --project tsconfig.seed.json tests/*.test.ts` with JSX compiler options -> **13 passed**
  - Type check: `tsc --noEmit` via bundled Node -> **passed**
  - Lint: `eslint . --max-warnings=0` via bundled Node -> **passed**
  - Production build: `next build` via bundled Node after clearing generated `.next` cache -> **passed**
  - `git diff --check` -> **passed**
  - Secret scan found only placeholders/docs/local compose values; ignored local `.env.local` and `.env.sync-agent` were not staged.
- Docker/compose validation was not run because Docker is not installed on this machine.
- npm command validation was not run through `npm` because `npm` is not on PATH; equivalent bundled Node entrypoints were used.
- Main merge gates after conflict resolution:
  - Parser tests: **123 passed**
  - TypeScript test sweep: **14 passed** including `armory-gear-missing-route`
  - Lint: **passed**
  - Type check: **passed**
  - Production build: **passed with exit code 0**; Windows emitted a standalone trace warning because this worktree's `node_modules` is a junction to the other worktree. Railway's Linux build will install normal dependencies and should not hit that junction warning.
  - `git diff --cached --check`: **passed**
  - Staged secret scan found only placeholders/docs/local compose values.
- Push/deploy handoff:
  - `main` was pushed to `origin/main` at `3b98665`.
  - Live site returned HTTP 200 after push.
  - Railway CLI is not installed locally, so Railway deploy logs were not inspected from this machine.

---

## Current State

- HD cinematic intro integration is live on production at `5a6ef83`, and this branch now contains a higher-resolution replacement pass ready for deploy. The old CSS-only particle/title intro has been replaced by generated cinematic video assets in `public/intro/`.
- Intro behavior: `FrozenLogbookIntro` now plays the HD cinematic on hard page load, uses WebM with MP4 fallback, selects portrait mobile WebM/MP4 sources at `(max-width: 640px)`, lasts up to `5200ms`, exits on video end, keeps `Skip`, and avoids replaying on every internal route change. Reduced-motion users get the matching desktop/mobile poster and a short `350ms` timeout.
- `/bosses` now has a mobile-native boss card layout with the same shared reveal animation style used on the other table/card pages. The desktop table grid is preserved for medium-and-up screens.
- Raid session encounter displays now preserve parsed/session timestamp order when `startedAt` values are available. The existing ICC progression order remains the fallback for boss displays that do not have encounter timestamps, such as leaderboard boss-board ordering.
- Gear card item-level and visible per-item `GS` display now distinguish raw item score from character contribution, and hunter one-hand weapons now count at normal item score in the total. This fixes Notlich-style hunter dual Scourgeborne Waraxe cards showing `168` instead of `531` each and removes the hunter weighting that kept Notlich's total below the in-game value.
- Existing `wow_items` rows affected by the old ranged/relic map are repaired by migration `20260504120000_repair_wow_item_ranged_relic_equip_locs`.
- Global player search is implemented on `codex/pizza-logs-modernization`. The header now has a compact autocomplete on large screens and a visible search row on smaller screens. The endpoint searches combat-log players plus PizzaWarriors/Lordaeron roster-only members and returns capped stable JSON for `/players/<name>` navigation.
- `/admin` now stays renderable when the local database is offline, so the shared header/search remain visible while the page reports Database unavailable.
- Character avatars now have a clean component and browser-script hook across player profiles, player lists, the guild roster table, session roster chips, and session player deep-dive headers.
- Without the portrait userscript, the app shows a class icon when available and falls back to initials on broken/missing images.
- The portrait userscript is still the fastest proof of concept path. Exact Warmane-rendered faces now have a browser-side cache attempt: open the Warmane character page once, and Portrait Userscript `0.5.0` will cache a static portrait URL, Warmane-page canvas, or Wowhead/Zamimg modelviewer frame canvas if Warmane and the browser allow it. It rejects blank/black canvases through scratch-canvas pixel sampling and ignores stale captures from earlier cache versions. If every render canvas is tainted, unreadable, or unavailable, Pizza Logs falls back to class icons/initials.
- Gear icon URLs are normalized to HTTPS when imported and when cached gear slots are normalized, preventing production mixed-content warnings for old `http://cdn.warmane.com/...` icon snapshots.
- `app/icon.svg` is now the app metadata icon generated from the existing navigation logo SVG.
- `public/favicon.ico` now covers the legacy root favicon request that Chrome reported as 404 in production.
- Favicon assets were pushed to `origin/main` in `527c883`, and production returned HTTP 200 for both `/favicon.ico` and `/icon.svg` after the Railway deploy.
- `codex/pizza-logs-modernization` is committed at `2360f64`.
- `main` was pushed to `origin/main` at `3b98665`; this docs-only sync updates the vault after that push.
- Parser behavior is preserved; parser fixture suite passes.
- Railway deployment risk is low if production `ADMIN_SECRET` is configured and `ADMIN_COOKIE_SECURE` is not set to `false`.
- Existing Prisma migrations include historical migration `20260502120000_add_wow_items_remove_sync_jobs`, which drops `sync_jobs` if present; no new schema migration was added in this session.

---

## Exact Next Step

For cinematic intro: deploy the higher-resolution desktop/mobile asset pass, then hard-refresh production in a normal browser to judge playback smoothness/taste and try the Skip button manually.

For `/bosses`: after deploy, open `/bosses` on a phone-sized viewport with real production data and confirm the mobile boss cards animate in without horizontal overflow.

For GearScore: after deploy, spot-check `/players/Notlich`; both heroic Scourgeborne Waraxe cards should show `GS 531`, and the summary should be much closer to the in-game `6237` because hunter weapon weighting is no longer applied.

For search: manually spot-check the header search against production-like data after deploy, especially exact-match Enter navigation and roster-only members from the guild roster.

Manual production checks remain: confirm Railway Web Service has `ADMIN_SECRET`, inspect Railway deploy logs from a machine with Railway CLI/dashboard access, install or update Warmane Gear Sync `1.7.0`, run it once, then verify Maxximusboom and Lausudo gear icons.

For portraits: install/update Portrait Userscript `0.5.0` from `/admin`, open the Warmane profile for a target character once, wait for any modelviewer frame to load, then test `/players/<name>`, `/guild-roster`, a raid session roster, and that session's player deep-dive page. If the face still does not appear, inspect whether the modelviewer frame canvas is cross-origin tainted, unreadable after scratch-canvas sampling, or never reaches a non-black render state.
