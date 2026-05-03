# Pizza Logs - Codex Instructions

## Mandatory Session Start

At the start of every session, before answering questions or changing files, read these vault files in order:

1. `Pizza Logs HQ/00 Inbox/START HERE.md`
2. `Pizza Logs HQ/02 Build Log/Latest Handoff.md`
3. `Pizza Logs HQ/03 Current Focus/Now.md`

Then run `git status --short --branch` with `C:\Program Files\Git\cmd\git.exe` if `git` is not on PATH. Do not work from memory.

## Mandatory Session End

After every change session, update:

1. `Pizza Logs HQ/02 Build Log/Latest Handoff.md`
2. `Pizza Logs HQ/03 Current Focus/Now.md`
3. `Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md` if bugs were fixed or found

Include vault updates in the same commit as code/docs changes.

## Project Overview

Pizza Logs is a Warmane / WotLK 3.3.5a combat-log parser and leaderboard app for PizzaWarriors. Users upload `WoWCombatLog.txt`; the app parses boss encounters, writes reports to PostgreSQL, and shows DPS/HPS rankings, boss history, player profiles, gear, and admin diagnostics.

- Live app: https://pizza-logs-production.up.railway.app
- Canonical remote: `origin` -> `https://github.com/CRSD-Lau/Pizza-Logs.git`
- Production deploy: Railway auto-deploys from `origin/main`
- Stack: Next.js 15, React 19, TypeScript, Tailwind, Prisma, PostgreSQL, Python FastAPI parser
- Parser target: match Skada-WoTLK, not UWU

## Repo Structure

- `app/` - Next.js App Router pages and API routes
- `components/` - UI, upload, charts, meters, player gear
- `lib/` - Prisma client, schemas, boss/class constants, milestones, Warmane/item helpers
- `parser/` - FastAPI service and Skada-aligned parser
- `parser/tests/fixtures/` - parser fixture inputs and expected outputs
- `prisma/` - schema, migrations, seed
- `docs/` - repo-level parser/review docs
- `Pizza Logs HQ/` - committed Obsidian project vault, handoffs, architecture, runbooks

## Critical Parser Behavior

Do not break combat log parsing. Parser correctness is the product.

- Warmane logs usually have no useful `ENCOUNTER_START/END`; heuristic detection is required.
- Skada-WoTLK is the source of truth for damage/healing totals.
- `SPELL_HEAL`: `parts[10]` gross, `parts[11]` overheal, `parts[12]` absorbed, `parts[13]` crit.
- Effective healing is `max(0, parts[10] - parts[11])`.
- Skada has no `ignored_spells.heal`; all `SPELL_HEAL` and `SPELL_PERIODIC_HEAL` events count.
- Damage events must match Skada `Damage.lua`: `SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `SPELL_BUILDING_DAMAGE`.
- `SWING_DAMAGE` has shifted indexes: amount at `parts[7]`, overkill at `parts[8]`, absorbed at `parts[12]`, crit at `parts[13]`.
- KILL duration uses boss death timestamp, not the last post-kill event.
- Player GUIDs include Warmane `0x06` and retail `Player-`.
- Gunship and heroic difficulty are Warmane edge cases. Do not change their handling without fixture validation and Skada/Warmane evidence.
- Absorbs are separate in Skada (`actor.absorb`) and are not currently implemented as healing.

## Setup Commands

- Install web dependencies: `npm ci --legacy-peer-deps`
- Generate Prisma client: `npm run db:generate`
- Seed bosses: `npm run db:seed`
- Import WotLK item metadata: `npm run db:import-items`
- Python parser setup:
  - `cd parser`
  - `python -m venv .venv`
  - `.venv\Scripts\activate` on Windows
  - `pip install -r requirements.txt`

## Dev Commands

- Web dev: `npm run dev`
- Web production start after build: `npm run start`
- Parser dev: `cd parser && python main.py`
- Local compose: `docker compose up --build`

## Test And Build Commands

- TypeScript: `npm run type-check`
- Web build: `npm run build`
- Parser tests: `cd parser && pytest tests/ -v`
- Parser fixtures only: `cd parser && pytest tests/test_fixtures.py -v`
- Focused TypeScript tests use `ts-node --project tsconfig.seed.json tests/<file>.test.ts` unless a test file requires JSX-aware compiler options.

`npm run lint` uses ESLint flat config in `eslint.config.mjs`.

## Parser Validation Expectations

Any parser change must include one of:

- New or updated parser fixture under `parser/tests/fixtures/`
- Focused pytest coverage in `parser/tests/test_parser_core.py`
- A written reason the change is non-behavioral, plus a full parser test run

Never delete parser fixtures unless they are proven obsolete and replacement coverage exists.

## Web App Validation Expectations

Changes touching upload/report/admin/analytics pages need at least:

- `npm run type-check`
- Relevant `ts-node` tests in `tests/`
- `npm run build` before deploy

Admin-only routes must stay protected. Public routes must not expose raw secrets, reset controls, or destructive actions.

## Railway Deployment Expectations

- Work on a branch first.
- Push `main` only after tests/build/parser validation/secret scan pass.
- Do not change Railway production environment variables from Codex.
- Do not commit `.env` files or production secrets.
- `start.sh` runs `prisma migrate deploy`, then `node server.js`.
- If Prisma migrations change, inspect them and document production risk before pushing.
- Railway has two services: Web Service and `parser-py`.

## Documentation Standards

Update docs when behavior, commands, deployment, parser rules, or workflows change. Keep README, `docs/`, `AGENTS.md`, and vault files consistent. Do not leave retired-agent workflow references in active docs.

## Git Hygiene

- Use branch prefix `codex/`.
- Safe modernization branch for this project: `codex/pizza-logs-modernization`.
- Review every modified, deleted, and untracked file before staging.
- Stage source, tests, docs, config, fixtures, and lockfiles that belong to the change.
- Do not stage `.env*`, logs, build outputs, caches, local screenshots, `node_modules`, `uploads`, combat logs, or personal machine state.
- Expected local-only noise may include `.env.local`, `.env.sync-agent`, `.next/`, `.pytest_cache/`, `.sync-agent-logs/`, `WoWCombatLog/`, and `tmp-mobile-check/`.

## Secret Handling

- `ADMIN_SECRET`, `DATABASE_URL`, Railway tokens, API keys, private keys, and reset secrets must never be committed.
- `.env.example` may contain placeholders only.
- Production admin must fail closed if `ADMIN_SECRET` is missing.
- Browser userscripts may ask an admin for a secret, but docs must call out that local browser storage is not equivalent to server-side secret storage.

## Safe Refactoring Rules

- Prefer the repo's existing patterns.
- Do not rewrite parser architecture speculatively.
- Preserve public routes and API response shapes unless all call sites and tests are updated.
- Avoid style-only churn.
- If a simplification touches combat-log math, segmentation, boss detection, upload persistence, admin gates, or milestones, add tests first or preserve the code.

## Stale-Code Deletion Rules

Classify stale candidates:

- Safe to delete: no imports, scripts, docs, runtime references, or deployment usage remain.
- Safe to consolidate: duplicate behavior with a clear surviving implementation.
- Suspicious but keep: parser/admin/upload/analytics paths where reachability is unclear.
- Cannot determine: leave untouched and document.

Prove deletions with search and validation. Parser code needs fixture validation before removal.

## Codex Workflow

- Use Codex as the canonical agent workflow.
- Use available Codex skills/plugins when they directly fit the task, especially repository audits, debugging, verification, GitHub publishing, browser checks, and security review.
- Prefer true subagents for independent read-only audits or disjoint implementation scopes.
- Do not install risky plugins or plugins that require secrets unless the repo already has safe configuration.

## Codex Review Checklist

When requesting review, include `@codex review` on GitHub if configured and ask it to focus on:

- Parser correctness and Skada alignment
- Fixture validation and combat-log edge cases
- Boss segmentation, wipe/kill detection, DPS/HPS math
- Upload flow regressions and saved report behavior
- Admin-only access control
- Analytics/report query regressions
- Railway deployment and Prisma migration risk
- Accidental secret exposure
- Stale-code deletions without proof
- Generated/private files accidentally staged
- Documentation drift and stale commands
- Dependency or lockfile changes

Before pushing `main`, verify tests pass, parser validation passes, build passes, secret scan passes, no `.env` or production secret is staged, Railway config changes are intentional, database changes are understood, and the final diff has been reviewed.

## Hard Stop

Do not break combat log parsing.
