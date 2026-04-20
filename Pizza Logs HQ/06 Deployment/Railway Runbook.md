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
2. Runs `prisma db push --skip-generate`
3. Starts `node server.js`

**If startup fails:** Check Railway logs for prisma error. Common cause: schema change requiring manual migration (column rename, type change). Use `prisma db push --force-reset` as last resort (destructive — wipes data).

---

## Reset Database

```bash
# 1. Create app/api/admin/reset-db/route.ts (see [[Repeated Fixes & Gotchas]] for template)
# 2. git add + commit + push
# 3. Poll until live, then wipe:
until curl -s -X POST https://pizza-logs-production.up.railway.app/api/admin/reset-db \
  -H "x-reset-secret: pizza-reset-now" | grep -q "DB cleared"; do sleep 5; done
# 4. git rm + commit + push
```

**Alternative (no endpoint):** Railway dashboard → Postgres → Connect → open shell → SQL

---

## Reseed Bosses (after DB reset)

```bash
railway run --service "Web Service" npx tsx prisma/seed.ts
```

---

## Local → Railway DB Access

`postgres.railway.internal` is not reachable locally. Options:
1. Deploy temp reset-db endpoint (standard pattern above)
2. `railway shell --service "Web Service"` — opens shell inside Railway environment
3. Railway dashboard → Postgres → Settings → Enable TCP Proxy → use `DATABASE_PUBLIC_URL`

---

## View Logs

```bash
railway logs --service "Web Service" -n 100
railway logs --service "parser-py" -n 100
```

**Common log patterns:**
- `[start] Running prisma db push...` — startup working
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
# On Railway: just push — start.sh runs prisma db push at startup
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
- [[Repeated Fixes & Gotchas]] — reset-db template + common deploy failures
- [[Security Checklist]] — what's protected, what's not
