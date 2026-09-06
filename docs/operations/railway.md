# Railway Runbook

## Services

Production contains two application services plus PostgreSQL:

- **Web Service** - Next.js standalone image built from the root `Dockerfile`
- **parser-py** - FastAPI image built from `parser/Dockerfile`
- **PostgreSQL** - durable Prisma data store

`main` is the only production source branch. Do not deploy unmerged feature branches as production.

## Required Configuration

Web:

- `DATABASE_URL`
- `PARSER_SERVICE_URL` pointing to the internal parser service
- `ADMIN_SECRET` set to a random server-only key of at least 32 characters
- `ADMIN_AUTH_URL` set to the exact public HTTPS origin
- Railway-provided deployment metadata used by admin diagnostics, when available

Parser limits have safe defaults in code. Do not set `ENABLE_LEGACY_PARSER_ROUTES=true` in production. Do not set `ADMIN_COOKIE_SECURE=false` in production.

Secrets belong in Railway configuration, never Git, a PR body, issue, screenshot, browser storage, or client bundle.

For the MFA rollout, follow [admin setup and recovery](admin-access.md). Auth tables are additive;
existing raid reports are not rewritten. Old admin cookies and shared-secret callers stop authenticating.
The owner must configure the origin/key and provision/enroll the account. An agent must not change
Railway production environment variables. Record actual enrollment, deployed enforcement and logout
verification; build/CI success alone is not enrollment proof. The completed production acceptance and
accepted reupload behavior are recorded in [admin access](admin-access.md#deployment-and-acceptance).

## Deployment Flow

1. Merge a passing PR into `main`.
2. Railway builds both services from the merge commit.
3. Web startup runs `start.sh`, resolves the packaged Prisma CLI and migration engine, adopts only three historical records whose expected schema exists, and runs `prisma migrate deploy`. Empty databases execute the restored initial core migration and every subsequent migration. The engine is installed during image build; startup needs PostgreSQL, not Prisma's download service.
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

### Acquisition modernization rollout

1. Verify a recoverable database backup and inspect `prisma migrate status` on the target. Check a schema diff; unexpected legacy drift must be reconciled before rollout.
2. Deploy the parser from the reviewed commit and verify `/ready`. The preceding web accepts the additional optional parser provenance fields.
3. Deploy the web from that same commit. Normal startup applies initial-core adoption, nullable parser-provenance fields and normalization of the known historical roster index name. Existing report values are not updated; provenance stays null for old rows. Core adoption creates no tables when the existing core is present. The index operation only renames an existing unique index; it does not rebuild it or change its columns. Normal DDL locking still requires rollout observation.
4. Check parser `/ready`, web `/api/health/ready`, all normal smoke routes, one authorized synthetic upload, duplicate retry and stored milliseconds/provenance.
5. On application failure, roll back through a revert PR. Leave the additive nullable columns in place; do not reverse-drop them or rewrite migration history. New environmental-damage totals apply only to newly parsed uploads.

Read [service objectives and recovery](service-objectives.md) before making availability or backup claims. No backup/PITR configuration or restoration was verified by the repository audit.

## Incident Triage

1. Identify the exact deployed commit and affected service.
2. Check Railway build/start logs without copying secrets into public channels.
3. Separate database connection, migration, parser capacity, upstream Warmane, and application errors.
4. Reproduce with synthetic fixtures; do not publish a real guild combat log.
5. Open an issue for non-sensitive incidents or a private advisory for a security incident.
