# Railway Deployment Guide

## Services

| Service | Name in Railway | URL |
|---|---|---|
| Next.js app | Web Service | https://pizza-logs-production.up.railway.app |
| Python parser | parser-py | http://parser-py.railway.internal:8000 (internal only) |
| Database | Postgres | postgres.railway.internal:5432 (internal only) |

## Environment Variables (Web Service)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:...@postgres.railway.internal:5432/railway?sslmode=disable` | Auto-set by Railway |
| `PARSER_SERVICE_URL` | `http://parser-py.railway.internal:8000` | Internal Railway hostname |
| `DEFAULT_REALM_NAME` | `Lordaeron` | |
| `DEFAULT_REALM_HOST` | `warmane` | |
| `MAX_FILE_SIZE_BYTES` | `1073741824` | 1 GB |
| `UPLOAD_DIR` | `./uploads` | |

## Common Operations

### View logs
```bash
railway logs --service "Web Service" -n 100
railway logs --service "parser-py" -n 100
```

### Check service health
```bash
curl https://pizza-logs-production.up.railway.app/api/health
curl https://pizza-logs-production.up.railway.app/admin
```

### Clear the database
> ⚠️ The permanent reset-db endpoint was deleted 2026-04-19.
> To clear DB, either:
> a) Temporarily recreate `app/api/admin/reset-db/route.ts` (see git history)
> b) Use Railway shell: `railway shell --service "Web Service"` then run Prisma commands

### Reseed bosses (after DB reset)
```bash
railway run --service "Web Service" npx tsx scripts/seed.ts
```

### Check parser health locally (after port-forwarding or via public URL)
```bash
curl https://pizza-logs-production.up.railway.app/health  # doesn't exist — add if needed
# Or check admin page: /admin → "Python Parser" card
```

## Deployment Flow

1. Push to `main` branch on GitHub
2. Railway auto-deploys both services (parallel build)
3. Next.js: `npm run build` → `npm start`
4. Parser: `pip install -r requirements.txt` → `uvicorn main:app`
5. Build takes ~2-3 min for Next.js, ~1 min for parser

## Local → Railway DB Access

**Internal hostname `postgres.railway.internal` is NOT reachable from your local machine.**

Options to run DB commands:
1. Temporarily add an API endpoint that runs the command (our reset-db pattern)
2. Use `railway shell` (opens a shell in the Railway environment)
3. Enable TCP proxy on the Postgres service in Railway dashboard → get `DATABASE_PUBLIC_URL`

## Parser Service Notes

- FastAPI on port 8000, set via `PORT` env var
- Two parse endpoints:
  - `POST /parse` — returns full JSON (legacy, still works)
  - `POST /parse-stream` — streams SSE progress events (current)
- `X-Accel-Buffering: no` header disables Railway/nginx proxy buffering for SSE
- Parser writes file to temp disk before streaming (UploadFile lifecycle fix)
