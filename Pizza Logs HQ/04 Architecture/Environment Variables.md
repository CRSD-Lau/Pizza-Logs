# Environment Variables

---

## Next.js App (Railway: "Web Service")

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:...@postgres.railway.internal:5432/railway?sslmode=disable` | Auto-set by Railway |
| `PARSER_SERVICE_URL` | `http://parser-py.railway.internal:8000` | Internal Railway hostname |
| `ADMIN_SECRET` | long random secret | Required in production; admin fails closed if missing |
| `ADMIN_COOKIE_SECURE` | omit | Optional; only set `false` for local HTTP compose |
| `DEFAULT_REALM_NAME` | `Lordaeron` | Default realm for uploads |
| `DEFAULT_REALM_HOST` | `warmane` | Default host |
| `MAX_FILE_SIZE_BYTES` | `1073741824` | 1 GB |
| `UPLOAD_DIR` | `./uploads` | Temp upload dir in container |

## Python Parser (Railway: "parser-py")

| Variable | Value | Notes |
|---|---|---|
| `PORT` | (Railway injects) | FastAPI binds to this |

---

## Local Development

`.env.local` in Next.js root:
```
DATABASE_URL="postgresql://..."
PARSER_SERVICE_URL="http://localhost:8000"
ADMIN_SECRET="local-dev-secret"
```

Run parser locally:
```bash
cd parser && uvicorn main:app --reload --port 8000
```

`postgres.railway.internal` is **not** reachable locally — Railway DB only accessible from inside Railway. See [[Railway Runbook]] for workarounds.

---

## Secrets — Never Commit

- `.env.local`
- Anything with `DATABASE_URL`
- One-time reset/recovery secrets, if Neil explicitly requests a temporary recovery endpoint
- `ADMIN_SECRET` for admin auth (see [[Security Checklist]])

---

## Related
- [[Railway Runbook]] — how to set vars, workarounds for local DB access
- [[Security Checklist]] — which vars are security-sensitive
