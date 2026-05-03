# Railway Runbook

> Everything needed to deploy, debug, and recover on Railway.

---

## Services

| Service | Railway Name | URL |
|---|---|---|
| Next.js app | Web Service | https://pizza-logs-production.up.railway.app |
| Python parser | parser-py | `http://parser-py.railway.internal:8000` (internal only) |
| Database | Postgres | `postgres.railway.internal:5432` (internal only) |

**Internal hostnames are not reachable from your local machine.**

---

## Normal Deploy

Canonical remote: `origin` -> `https://github.com/CRSD-Lau/Pizza-Logs.git`.
When Neil asks to push, deploy, publish, or make changes live, push `main` to `origin` so Railway picks up the deployment. Do not ask for the repo URL; it is the canonical remote above. If `git` is missing from PATH on Neil's Windows machine, use `C:\Program Files\Git\cmd\git.exe`.

Before pushing, verify the Web Service has `ADMIN_SECRET` configured. Production admin routes fail closed without it. Do not set `ADMIN_COOKIE_SECURE=false` in Railway; that override is only for local HTTP compose.

```bash
git push origin main
# Railway auto-deploys on push to main
railway logs --service "Web Service" -n 100   # watch it
railway logs --service "parser-py" -n 100
```

Deploy takes ~2-3 min (Next.js), ~1 min (parser). DB doesn't redeploy unless Postgres config changes.

---

## Startup Sequence (Next.js)

`start.sh` runs at container start:
1. Detects prisma entry point dynamically (avoids `.bin/prisma` wasm issue)
2. Resolves historical migrations that were previously applied by `db push`
3. Runs `prisma migrate deploy`
4. Starts `node server.js`

**If startup fails:** Check Railway logs for Prisma migration errors. Do not use destructive reset commands unless Neil explicitly approves data loss.

---

## Reset Database

There is no committed reset endpoint. Prefer Railway dashboard SQL or a Railway shell for destructive recovery. If a temporary endpoint is absolutely required, use a one-time secret from the environment, remove the endpoint in the same recovery window, and never commit the secret value.

**Alternative:** Railway dashboard -> Postgres -> Connect -> open shell -> SQL

---

## Reseed Bosses (after DB reset)

```bash
railway run --service "Web Service" npm run db:seed
```

---

## Local → Railway DB Access

`postgres.railway.internal` is not reachable locally. Options:
1. `railway shell --service "Web Service"` - opens shell inside Railway environment
2. Railway dashboard → Postgres → Settings → Enable TCP Proxy → use `DATABASE_PUBLIC_URL`

---

## View Logs

```bash
railway logs --service "Web Service" -n 100
railway logs --service "parser-py" -n 100
```

**Common log patterns:**
- `[start] Running prisma migrate deploy...` — startup working
- `[upload] unhandled error:` — upload route crashed
- `TypeError: terminated` — parser connection dropped mid-stream

---

## Parser Service Details

- FastAPI on port `$PORT` (Railway injects)
- Two endpoints:
  - `POST /parse` — returns full JSON (legacy)
  - `POST /parse-stream` — streams SSE progress events (current)
- `X-Accel-Buffering: no` header disables Railway/nginx proxy buffering for SSE
- File written to temp disk before `StreamingResponse` (avoids UploadFile lifecycle bug)

---

## Schema Changes

After editing `prisma/schema.prisma`:
```bash
npx prisma generate        # update local client (no DB needed)
# On Railway: just push after validation - start.sh runs prisma migrate deploy at startup
```

---

## Rollback

Railway dashboard → Deployments → click previous → Redeploy.  
DB state is **not** rolled back — code only.

---

## Health Checks

```bash
curl https://pizza-logs-production.up.railway.app        # app responding?
# Check /admin page → "Python Parser" card for parser health
```

---

## Emergency: Parser Down

1. Railway dashboard → parser-py → Restart
2. Check parser logs for Python exceptions
3. If OOM: large file with no size limit — add hard reject in upload route

---

## Related
- [[Environment Variables]] — all env vars with exact values
- [[Repeated Fixes & Gotchas]] — admin recovery notes + common deploy failures
- [[Security Checklist]] — what's protected, what's not
