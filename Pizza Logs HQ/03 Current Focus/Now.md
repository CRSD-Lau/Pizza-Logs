# Now

## Active Focus

Retiring rendered portrait capture and standardizing player avatars on class icons through draft PR #8.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. Codex does not push or merge `main` directly.

## This Session

- Retired active rendered portrait capture because class icons are the supported avatar path.
- Removed portrait install links and URL fields from `/admin`.
- Simplified `PlayerAvatar` to use class icons with initials fallback; removed `portraitUrl` props and data attributes from player, session, and roster screens.
- Replaced the old portrait userscript body with a `0.6.0` no-op compatibility update that tells existing users they can uninstall it.
- Added local userscript builders and install endpoints for gear and guild roster imports.
- Kept the old portrait userscript endpoint only for existing install compatibility.
- Added local install links and URL fields on `/admin` for browser-assisted local roster and gear imports.
- Kept production userscript URLs unchanged for Railway production.
- Verified local endpoints on `http://127.0.0.1:3001`, including the no-op portrait compatibility endpoint.
- Validation passed locally with bundled runtimes: focused userscript/admin/profile tests, lint, type-check, and production build.
- Recovered the local `3001` dev server after a stale `.next` cache caused `Cannot find module './5611.js'`.

## Next Actions

| Task | Status | Notes |
|---|---|---|
| Add local gear userscript | DONE | `http://127.0.0.1:3001/api/admin/armory-gear/userscript.local.user.js` |
| Add local roster userscript | DONE | `http://127.0.0.1:3001/api/admin/guild-roster/userscript.local.user.js` |
| Retire portrait capture | DONE | Active script replaced by no-op compatibility update |
| Keep class-icon avatars | DONE | `PlayerAvatar` renders class icons or initials only |
| Remove portrait admin UI | DONE | `/admin` only advertises roster and gear browser imports |
| Run validation | DONE | Focused tests, lint, type-check, build, and live local endpoint checks passed |
| Recover local 3001 server | DONE | Cleared generated `.next`, restarted `PizzaLogsLocalTestServer`, verified `/` and local endpoints return 200 |
| Branch publication | DONE | Commit and push `codex-dev` for draft PR #8 |
| PR creation | DONE | Draft PR #8 is open; connector still lacks PR write permission |
| Human review | NEXT | Neil reviews class-icon behavior after PR #8 merges |

## Open Follow-Ups

- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- Continue using browser-assisted Warmane imports until a local automated sync agent is built.
- Absorbs remain future parser work.
- If the laptop port changes from `3001`, add matching local roster/gear userscript variants or update the local constants.

## Reference

- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Parser contract: `docs/parser-contract.md`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Item metadata table: `wow_items`
