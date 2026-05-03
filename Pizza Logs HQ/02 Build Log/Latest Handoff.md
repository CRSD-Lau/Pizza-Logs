# Latest Handoff

## Date
2026-05-03

## Git
**Branch:** `codex/pizza-logs-modernization`
**Latest favicon asset commit:** `527c883` on `origin/main`

---

## What Was Done This Session

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

Manual production checks remain: confirm Railway Web Service has `ADMIN_SECRET`, inspect Railway deploy logs from a machine with Railway CLI/dashboard access, install or update Warmane Gear Sync `1.7.0`, run it once, then verify Maxximusboom and Lausudo gear icons.

For portraits: install/update Portrait Userscript `0.5.0` from `/admin`, open the Warmane profile for a target character once, wait for any modelviewer frame to load, then test `/players/<name>`, `/guild-roster`, a raid session roster, and that session's player deep-dive page. If the face still does not appear, inspect whether the modelviewer frame canvas is cross-origin tainted, unreadable after scratch-canvas sampling, or never reaches a non-black render state.
