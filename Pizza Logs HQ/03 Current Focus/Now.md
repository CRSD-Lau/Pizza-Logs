# Now

## Active Focus

Local Warmane import scripts are ready for laptop testing through the `codex-dev -> main` PR.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. Codex does not push or merge `main` directly.

## This Session

- Added local userscript builders and install endpoints for gear, guild roster, and player portraits.
- Added local install links and URL fields on `/admin` for browser-assisted local imports.
- Kept production userscript URLs unchanged for Railway production.
- Verified the three local endpoints on `http://127.0.0.1:3001`.
- Validation passed locally with bundled runtimes: focused userscript/admin tests, lint, type-check, and production build.
- Recovered the local `3001` dev server after a stale `.next` cache caused `Cannot find module './5611.js'`.

## Next Actions

| Task | Status | Notes |
|---|---|---|
| Add local gear userscript | DONE | `http://127.0.0.1:3001/api/admin/armory-gear/userscript.local.user.js` |
| Add local roster userscript | DONE | `http://127.0.0.1:3001/api/admin/guild-roster/userscript.local.user.js` |
| Add local portrait userscript | DONE | `http://127.0.0.1:3001/api/player-portraits/userscript.local.user.js` |
| Run validation | DONE | Focused tests, lint, type-check, build, and live local endpoint checks passed |
| Recover local 3001 server | DONE | Cleared generated `.next`, restarted `PizzaLogsLocalTestServer`, verified `/` and local userscript endpoint return 200 |
| Branch publication | DONE | `codex-dev` pushed to `origin/codex-dev` |
| PR creation | NEEDS NEIL | Codex GitHub connector returned 403; open `https://github.com/CRSD-Lau/Pizza-Logs/compare/main...codex-dev?expand=1` |
| Human review | NEXT | Neil installs local scripts from `/admin` and uses them when targeting the laptop DB |

## Open Follow-Ups

- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- Continue using browser-assisted Warmane imports until a local automated sync agent is built.
- Absorbs remain future parser work.
- If the laptop port changes from `3001`, add matching local userscript variants or update the local constants.

## Reference

- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Parser contract: `docs/parser-contract.md`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Item metadata table: `wow_items`
