# Testing and Validation

Author: Neil Mitchell
Last Modified By: Neil Mitchell

## Pull Request Gate

Install the dependencies in [Development Setup](setup.md), then run from the repository root:

```bash
npm run check:pr
```

The gate runs ESLint with zero warnings, TypeScript 7 native checking, TypeScript 6 ecosystem compatibility, every `tests/*.test.ts` test, Markdown local-link validation, Python manifest/hash-lock consistency, and a production Next.js build.

Database integration tests skip explicitly when `TEST_DATABASE_URL` is absent. The Python-to-web contract test skips when `PARSER_CONTRACT_PYTHON` is absent. A passing local gate with those skips does not prove database behavior or the cross-service contract. CI supplies both variables.

Run one TypeScript test with:

```bash
npx tsx --test tests/<file>.test.ts
```

## PostgreSQL and Python Contract Tests

Use a dedicated PostgreSQL 16 database on loopback. The database user must be able to create schemas. For example, after creating a local database named `pizzalogs_test`, set these variables from the repository root. Replace the example local credentials with those for that database:

```powershell
$env:DATABASE_URL = 'postgresql://pizzalogs:pizzalogs@127.0.0.1:5432/pizzalogs_test?schema=public'
$env:TEST_DATABASE_URL = 'postgresql://pizzalogs:pizzalogs@127.0.0.1:5432/pizzalogs_test'
$env:PARSER_CONTRACT_PYTHON = (Resolve-Path 'parser/.venv/Scripts/python.exe').Path
```

On macOS/Linux, export the same database variables and set `PARSER_CONTRACT_PYTHON` to the absolute path of `parser/.venv/bin/python`. The Python environment must contain the hash-locked parser development dependencies.

Prepare the public schema with the same migration path used by CI, then run all integration suites:

```bash
npm run db:generate
node scripts/adopt-legacy-migrations.mjs node_modules/prisma/build/index.js
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
npx tsx --test tests/*.integration.test.ts
```

These migration commands use `DATABASE_URL`; verify it points to the dedicated local database before running them. Do not use a shared or production database. See [Railway Operations](../operations/railway.md) for the separately reviewed deployment and legacy-adoption procedure.

The integration suites exercise ingestion rollback and concurrent deduplication, report aggregates, weekly/all-time milestones, migration preflight, PostgreSQL schema isolation, and canonical Python payloads against the TypeScript persistence schema. Database suites create unique schemas for each invocation and retain them for investigation. They reject non-loopback database hosts. `npm run test:integration` runs the same integration glob; `npm test` includes these suites alongside the unit tests. Both environment variables are required to avoid integration skips.

## Parser Gate

With the Python 3.14 virtual environment active:

```bash
python -m pip install --require-hashes -r parser/requirements-dev.lock
cd parser
python -m pytest tests/ -v
```

Useful focused suites include `tests/test_fixtures.py`, `tests/test_parser_core.py`, `tests/test_parser_service.py`, and `tests/test_archive_upload.py`. Parser behavior changes require a focused pytest or fixture. Full-suite success is still required before shipping.

After editing a Python input manifest, regenerate both platform-aware hash locks from the repository root with Python 3.14 and the pinned `pip-tools`:

```bash
python -m piptools compile --generate-hashes --strip-extras --output-file=parser/requirements.lock parser/requirements.txt
python -m piptools compile --generate-hashes --strip-extras --allow-unsafe --output-file=parser/requirements-dev.lock parser/requirements-dev.txt
npm run locks:check
```

## Differential Parity Evidence

From `parser/`, the offline regression gate is:

```bash
python -m parity verify --output-dir ../.test-artifacts/parity
```

`verify` checks exact claims, provenance integrity, and frozen outputs for reviewed mismatches. It can exit zero while reporting `parityStatus: incomplete`. It does not establish full UwU compatibility. The strict audit is a separate command:

```bash
python -m parity run --output-dir ../.test-artifacts/parity-strict
```

`run` exits nonzero if any case mismatches or any case/surface is blocked. The current reviewed baseline has known mismatches and blocked surfaces, so a failing strict run is expected evidence of incomplete parity. Do not relabel it as a passing acceptance gate or silently suppress the exit code. `--claimed-only` narrows the case selection; it does not prove untested surfaces.

Both commands write `parity.json`, `parity.md`, and `parity.junit.xml`; `verify` also writes `regression.junit.xml`. Keep the mismatch and blocked-surface evidence alongside successful regression results. See [UwU Analytics Parity](../uwu-analytics-parity.md) for the precise claims and provenance boundary.

The separate monthly/manual reference-drift workflow runs `python -m parity check-reference --cache ../.test-artifacts/reference.json`. Exit codes distinguish current (`0`), stale (`2`), and unavailable (`3`). It does not refresh goldens or execute newly fetched reference code.

## Local Headless Acceptance

Start the migrated and seeded local web/parser/database stack, for example using [Local Compose](setup.md#local-compose). Install Chromium once:

```bash
npx playwright install chromium
```

Use a dedicated disposable database for the local web process and this runner. Set `DATABASE_URL`, the same server key and origin used by the web process, and the local web URL:

```powershell
$env:PIZZA_TEST_BASE_URL = 'http://127.0.0.1:3000'
$env:ADMIN_SECRET = 'isolated-test-server-key-at-least-32-characters'
$env:ADMIN_AUTH_URL = 'http://127.0.0.1:3000'
$env:PARSER_CONTRACT_PYTHON = (Resolve-Path 'parser/.venv/Scripts/python.exe').Path
npm run test:e2e
```

The runner and admin fixture accept loopback URLs only. The fixture privately provisions the synthetic `pizza-admin-e2e@example.test` identity, or resets that same identity on a repeated test; it refuses to replace another designated administrator. Never run it against a database containing a real administrator. For a production-mode container served over local HTTP, configure `ADMIN_COOKIE_SECURE=false` on that local web process so the login cookie can be tested. Production HTTPS must retain secure cookies.

The runner uploads synthetic text and ZIP fixtures, checks concurrent duplicate handling and stored totals, visits public report/player/leaderboard pages at six viewport widths, and checks keyboard focus and selected axe accessibility rules. Admin acceptance covers rejected legacy credentials and forged cookies, password-only access denial, authenticator enrollment, enrollment-session revocation, fresh recovery-code login, one-use recovery codes and logout. It views diagnostics without mutating raid data. It records screenshots and a JSON report under `.test-artifacts/e2e` by default; `PIZZA_TEST_ARTIFACTS` changes that destination. Setup keys, passwords and recovery codes are not written into screenshots or reports. Browser requests for external assets are blocked during capture; server-side upstream integrations are not fully mocked. These checks do not prove live provider availability, real administrator enrollment or visual equivalence for private raid logs.

Player quick-look acceptance also covers all six existing avatar surfaces, centered desktop models, keyboard reopening, lazy/deduplicated gear requests, missing appearance, renderer failure, unsupported WebGL and compact touch previews. The helper creates and removes one exact synthetic roster row. It substitutes deterministic scripts at the two permitted viewer URLs while exercising the real sandbox document, model-loaded message and parent-page integration. This verifies layout and fallback behavior; real Warmane assets and actual browser graphics support need a separate visual check.

The same command then runs `scripts/upload-journey-e2e.mjs` and `scripts/ux-navigation-e2e.mjs` against that stack. Upload acceptance exercises fresh and duplicate reports, explicit notification permission, first-screen form placement, and the opt-in intro dialog including reduced motion and media failure. Navigation acceptance checks 12 public routes at 375, 768, 1024 and 1440 pixels, full axe rules, horizontal overflow, duplicate IDs and readable leaderboard names. It also tests keyboard search with stale responses, mobile menu focus, directory and difficulty filters, dated weekly links, section shortcuts and missing-page recovery. These scripts reject non-loopback targets and save reports and screenshots under `.test-artifacts/ux-upload` and `.test-artifacts/ux-navigation`; `PIZZA_UX_UPLOAD_ARTIFACTS` and `PIZZA_UX_ARTIFACTS` override those paths. Review axe incomplete results and screenshots manually: a passing automated run is not a WCAG certification.

## CI and Security Gates

The display-consistency browser suite also runs in `test:e2e`. It uploads an isolated
synthetic report with eight-digit totals, a tiny nonzero contribution, a death,
18 spells and a midnight crossing. At 375, 768, 1024 and 1440 pixels it checks full
number visibility, mobile metric labels, spell disclosure and exact chart values.
The browser deliberately uses a German locale and Halifax timezone to catch
server/client presentation drift; recorded times must still display labelled UTC.
Evidence is saved under `.test-artifacts/display-consistency`. Authenticated layout
coverage includes diagnostics, upload history/details and account security at
375, 768 and 1440 pixels. New render tests cover missing and legacy durations,
zero output, no-kill profiles, and navigation beyond 100 admin uploads.

The main CI job supplies PostgreSQL 16 and Python 3.14, installs both lockfiles, migrates and seeds a fresh database, checks migration/schema agreement, runs the TypeScript and Python suites with integration prerequisites enabled, and runs the offline parity regression gate. It also runs lint, both TypeScript checks, docs/lock checks, npm audit, Ruff, Bandit, pip-audit, a Next.js production build, both Docker builds, and headless acceptance against those containers. Synthetic acceptance artifacts are retained for 90 days. The separate reference-drift workflow retains its evidence for 30 days.

Run the static/security checks from the repository root:

```bash
python -m ruff check parser --select F,E9
python -m bandit -q -r parser -x parser/tests,parser/benchmarks,parser/.venv
npm audit --audit-level=moderate
python -m pip_audit -r parser/requirements.lock --disable-pip
```

Pull requests also receive dependency review; CodeQL has its own workflow. The main CI security checks run weekly so newly published advisories can fail without source changes. A clean advisory scan does not replace review of authentication, authorization, data exposure, error handling, or resource limits.

## Database and Containers

```bash
npx prisma validate
docker compose config
docker build -t pizza-logs-web .
docker build -f parser/Dockerfile -t pizza-logs-parser .
```

Inspect every generated migration. Verify both images for deployment changes. Production smoke testing is a separate deployment step; local acceptance does not establish a production deployment result.

## Final Diff Review

Before staging or merging:

- run `git diff --check`;
- inspect all modified, deleted, and untracked files;
- confirm no `.env`, secret, webhook, private combat log, upload, cache, build output, screenshot with private data, or personal path is included;
- confirm deletions have no imports, scripts, docs, deployment, or compatibility references;
- state migration, re-upload, rollback, unproven parity, and production risks in the pull request.
