# Pizza Logs Agent Guide

## Mission

Pizza Logs parses Warmane/WotLK combat logs and publishes raid analytics. Parser correctness, upload safety, admin isolation, and production reliability take priority over speculative cleanup or style churn.

## Start Here

At the beginning of a task:

1. Run `git status --short --branch` and preserve unrelated work.
2. Fetch `origin` and start a short-lived `codex/<task>` branch from current `origin/main` unless the user explicitly chooses another branch.
3. Read [`docs/README.md`](docs/README.md) and only the documentation relevant to the change.
4. For Next.js changes, read the applicable guide under `node_modules/next/dist/docs/` before editing.

There is no mandatory handoff file or Obsidian-vault workflow. GitHub issues and pull requests hold active work, ADRs hold durable decisions, and `CHANGELOG.md` records shipped behavior.

## Delivery Workflow

- Never commit or push directly to `main`.
- Use one short-lived branch per coherent change and open a pull request into `main`.
- Review every modified, deleted, and untracked file before staging.
- Merge only after required checks pass, the final diff is reviewed, and no explicit blocker remains. Do not bypass required checks.
- Prefer squash merges and delete the merged branch.
- Railway deploys production from `main`; verify the production smoke test after deployment-sensitive work.
- Do not change Railway production environment variables from an agent session.

## Architecture

- `app/` — Next.js App Router pages and API routes
- `components/` — UI, upload, reports, charts, and player gear
- `lib/` — database, schemas, raid metadata, analytics helpers, and upstream clients
- `parser/` — FastAPI service and Skada-aligned parser
- `parser/tests/fixtures/` — canonical combat-log fixtures and expected output
- `prisma/` — schema, migrations, and seed data
- `docs/` — maintained architecture, operations, security, guides, and ADRs

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS, Prisma/PostgreSQL, Python 3.12/FastAPI, and Railway.

## Parser Contract

Do not break combat-log parsing. Read [`docs/parser-contract.md`](docs/parser-contract.md) before changing parser behavior.

Non-negotiable rules:

- Warmane logs often lack reliable `ENCOUNTER_START`/`ENCOUNTER_END`; heuristic detection is required.
- Skada-WoTLK is the authority for damage and effective-healing primitives.
- Damage events: `SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, and `SPELL_BUILDING_DAMAGE`.
- `SPELL_HEAL`/`SPELL_PERIODIC_HEAL`: gross is `parts[10]`, overheal `parts[11]`, absorbed metadata `parts[12]`, crit `parts[13]`; effective healing is `max(0, gross - overheal)`.
- `SWING_DAMAGE` is shifted: amount `parts[7]`, overkill `parts[8]`, absorbed `parts[12]`, crit `parts[13]`.
- Headline outgoing damage and damage taken use the raw reported amount. Useful/effective damage is a separate analytical metric.
- Absorbs remain separate stored primitives. The UwU-compatible `Heal` view is explicitly effective healing plus attributed absorbs.
- Encounter windows end at the last boss-destination event. A kill ends at boss death, not a post-kill event.
- Warmane Gunship, heroic detection, Lich King scripted phases, and pet ownership are fixture-protected edge cases.
- Pet ownership requires summon or owner-exclusive spell evidence; generic healing cannot claim ownership.
- Missing or conflicting evidence remains `UNKNOWN` or unattributed.

Never delete parser fixtures or migrations unless replacement coverage and migration safety are proven.

## Validation

Run the strongest gate relevant to the change:

```bash
npm run check:pr
```

This runs lint, both TypeScript checks, the TypeScript test suite, documentation checks, and a production build.

Parser changes also require:

```bash
python -m pip install --require-hashes -r parser/requirements-dev.lock
cd parser
pytest tests/ -v
```

Add or update a fixture or focused pytest for behavior changes. A non-behavioral parser refactor still requires the full parser suite and a written explanation in the PR.

Useful focused commands:

```bash
npx tsx --test tests/<file>.test.ts
npm run db:generate
npx prisma validate
docker compose config
```

## Security

- Never commit `.env*`, database URLs, Railway tokens, admin secrets, API keys, private keys, combat logs, uploads, caches, build output, or personal machine state.
- Production admin access must fail closed when `ADMIN_SECRET` is absent.
- Public routes must not expose raw uploads, internal parser errors, secrets, reset controls, or destructive actions.
- The public upload path must retain size, archive, concurrency, timeout, filename, content, and parser-payload validation.
- Do not reintroduce browser-stored admin secrets, userscript data paths, or arbitrary parser filesystem access.
- Inspect Prisma migrations and document production risk before shipping them.
- See [`SECURITY.md`](SECURITY.md) and [`docs/security/threat-model.md`](docs/security/threat-model.md).

## Cleanup Rules

Classify removal candidates before deleting:

- **Safe to delete:** no imports, scripts, docs, runtime, deployment, or compatibility references.
- **Safe to consolidate:** duplicate behavior with an identified surviving implementation.
- **Suspicious but keep:** parser, upload, admin, analytics, migration, or compatibility code with unclear reachability.
- **Cannot determine:** document it and leave it intact.

Prove deletions with repository search and the relevant validation suite. Preserve public route and API response compatibility unless all consumers and tests are updated.

## Documentation

Update README, maintained docs, ADRs, environment examples, and the changelog when behavior, commands, architecture, security, or deployment changes. Prefer one authoritative document over duplicated status notes. Do not add session transcripts or machine-specific handoffs to the repository.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
