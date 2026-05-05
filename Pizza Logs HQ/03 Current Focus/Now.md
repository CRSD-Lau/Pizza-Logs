# Now

## Active Focus

Documentation freshness audit is ready to review through the `codex-dev -> main` PR.

## Current Branch Rule

Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`. Codex does not push or merge `main` directly.

## This Session

- Synced `codex-dev` with `origin/main`.
- Inventoried Markdown files and implementation source.
- Deleted obsolete/duplicate docs.
- Rewrote current setup, deployment, parser, security, workflow, and vault notes.
- Kept parser fixture notes and community docs where they are still useful.
- Added parser pytest coverage to GitHub Actions so CI matches parser-critical docs.
- Validation passed locally with bundled runtimes: lint, type-check, production build, and 123 parser tests.

## Next Actions

| Task | Status | Notes |
|---|---|---|
| Finish doc rewrites | DONE | Docs are concise and code-backed |
| Run validation | DONE | Lint, type-check, build, parser tests passed |
| Review final diff | DONE | Confirmed intended docs, env example, PR template, and CI metadata only |
| Branch publication | HANDOFF | Push/open PR if not already done; target is `main` |
| Human review | NEXT | Neil reviews the documentation cleanup PR and merges when ready |

## Open Follow-Ups

- Add hard server-side upload size enforcement.
- Decide whether app-level upload rate limiting is needed or Railway-level controls are enough.
- Continue using browser-assisted Warmane imports until a local automated sync agent is built.
- Absorbs remain future parser work.

## Reference

- Live app: https://pizza-logs-production.up.railway.app
- GitHub: https://github.com/CRSD-Lau/Pizza-Logs
- Parser contract: `docs/parser-contract.md`
- Gear cache table: `armory_gear_cache`
- Guild roster table: `guild_roster_members`
- Item metadata table: `wow_items`
