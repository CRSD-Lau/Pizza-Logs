# Railway Runbook

## Services

Production contains two application services plus PostgreSQL:

- **Web Service** — Next.js standalone image built from the root `Dockerfile`
- **parser-py** — FastAPI image built from `parser/Dockerfile`
- **PostgreSQL** — durable Prisma data store

`main` is the only production source branch. Do not deploy unmerged feature branches as production.

## Required Configuration

Web:

- `DATABASE_URL`
- `PARSER_SERVICE_URL` pointing to the internal parser service
- `ADMIN_SECRET` set to a long random value
- Railway-provided deployment metadata used by admin diagnostics, when available

Parser limits have safe defaults in code. Do not set `ENABLE_LEGACY_PARSER_ROUTES=true` in production. Do not set `ADMIN_COOKIE_SECURE=false` in production.

Secrets belong in Railway configuration, never Git, a PR body, issue, screenshot, browser storage, or client bundle.

## Deployment Flow

1. Merge a passing PR into `main`.
2. Railway builds both services from the merge commit.
3. Web startup runs `start.sh`, resolves the packaged Prisma CLI, reconciles three historical pre-migration records, and runs `prisma migrate deploy`.
4. The web server starts only after migration succeeds.
5. Successful deployment events trigger the Production Smoke workflow; a weekly scheduled run checks ongoing availability.

## Verification

Confirm:

- the Railway deployment commit matches merged `main`;
- web and parser health are green;
- `/`, `/raids`, `/leaderboards`, and `/api/bosses` respond;
- `/admin` redirects to login when unauthenticated;
- security headers, canonical metadata, `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` are present;
- an upload works when the change touched upload/parser/data paths;
- required migrations appear applied.

Manual smoke command:

```bash
PIZZA_LOGS_BASE_URL=https://pizza-logs-production.up.railway.app npm run smoke:production
```

PowerShell:

```powershell
$env:PIZZA_LOGS_BASE_URL = "https://pizza-logs-production.up.railway.app"
npm run smoke:production
```

## Migration Safety

Every Prisma migration must be inspected before merge. Prefer additive changes with explicit backfill behavior. The web startup cannot serve traffic if `migrate deploy` fails.

Document:

- lock/downtime risk;
- data rewrite or backfill behavior;
- compatibility with the previous web version;
- whether historic uploads must be re-uploaded because parsed rows are not automatically recomputed.

## Rollback

For application-only regressions, revert the offending PR through a new passing PR and let Railway redeploy `main`. Do not force-push `main`.

Database rollback is not assumed to be reversible. Use a forward corrective migration unless a reviewed restoration plan exists. Never delete production data or alter Railway variables as an improvised rollback.

For parser regressions, restore the previous code, verify fixtures, redeploy, and re-upload affected source logs when stored rows were produced by incorrect parsing.

## Incident Triage

1. Identify the exact deployed commit and affected service.
2. Check Railway build/start logs without copying secrets into public channels.
3. Separate database connection, migration, parser capacity, upstream Warmane, and application errors.
4. Reproduce with synthetic fixtures; do not publish a real guild combat log.
5. Open an issue for non-sensitive incidents or a private advisory for a security incident.
