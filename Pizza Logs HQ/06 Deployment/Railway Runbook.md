# Railway Runbook

## Services

| Service | Railway name | Notes |
|---|---|---|
| Next.js app | `Web Service` | Public app, deploys from `main` |
| Python parser | `parser-py` | Internal FastAPI parser service |
| Postgres | Postgres service | Internal database |

Live app: https://pizza-logs-production.up.railway.app

Internal Railway hostnames are not reachable from a local machine.

## Normal Deployment

Codex workflow:

1. Work on `codex-dev`.
2. Push `origin/codex-dev`.
3. Open a PR from `codex-dev` to `main`.
4. Neil merges the PR.
5. Railway auto-deploys `main`.

Codex must not push or merge `main` directly.

Before asking Neil to merge, verify:

- `ADMIN_SECRET` is configured on Railway Web Service.
- `ADMIN_COOKIE_SECURE=false` is not set in Railway.
- Prisma migration risk is understood if migrations changed.
- Parser tests ran if parser behavior changed.
- Build and type checks passed.

## Web Startup

`start.sh` runs at container start:

1. Resolves the Prisma CLI package entry point.
2. Marks known historical `db push` migrations as applied when needed.
3. Runs `prisma migrate deploy`.
4. Starts `node server.js`.

If startup fails, inspect Railway Web Service logs for Prisma or standalone Next.js errors.

## Parser Service

- FastAPI binds to `$PORT` or `8000`.
- Health endpoint: `GET /health`.
- Current upload endpoint: `POST /parse-stream`.
- Legacy/debug endpoints also exist: `POST /parse`, `POST /parse-path`, `POST /parse-debug`.
- Parser writes uploads to temp disk before returning `StreamingResponse`.

## Logs

```bash
railway logs --service "Web Service" -n 100
railway logs --service "parser-py" -n 100
```

Common patterns:

- `[start] Running prisma migrate deploy...` means web startup reached migrations.
- `[upload] unhandled error:` means Next.js upload persistence crashed.
- `Parser unreachable` from upload SSE means `PARSER_SERVICE_URL` or parser service health is wrong.

## Database Recovery

There is no committed reset endpoint. Prefer:

1. existing admin cleanup controls for upload-derived data;
2. Railway dashboard SQL;
3. `railway shell --service "Web Service"` for controlled commands.

Do not commit one-time reset endpoints or reset secrets.

After an approved full DB reset, reseed required data:

```bash
railway run --service "Web Service" npm run db:seed
railway run --service "Web Service" npm run db:import-items
```

## Local To Railway DB Access

`postgres.railway.internal` is only available inside Railway. Local options:

- Railway shell inside the Web Service environment.
- Railway dashboard TCP proxy with `DATABASE_PUBLIC_URL`, used temporarily and not committed.

## Rollback

Use Railway dashboard deployment rollback/redeploy for code. Database state is not rolled back automatically.

## Health Checks

```bash
curl https://pizza-logs-production.up.railway.app
```

Use `/admin` after login to check parser and database health.

## Emergency Parser Down

1. Restart `parser-py` in Railway.
2. Check parser logs for Python exceptions.
3. Check `PARSER_SERVICE_URL` on Web Service.
4. If failures involve huge uploads, prioritize server-side upload size enforcement.
