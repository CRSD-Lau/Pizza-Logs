# Environment Variables

Source of truth for examples: `.env.example`, `docker-compose.yml`, `lib/admin-auth.ts`, and `app/api/upload/route.ts`.

## Web Service

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma/PostgreSQL connection string. Railway usually injects this from Postgres. |
| `PARSER_SERVICE_URL` | Yes | Parser service URL. Local: `http://localhost:8000`; Railway: internal `parser-py` URL. |
| `ADMIN_SECRET` | Yes in production | Protects `/admin` and admin import APIs. Production fails closed if missing. |
| `ADMIN_COOKIE_SECURE` | No | Omit in Railway. Set `false` only for local HTTP production-mode compose. |

`NODE_ENV` is set by the runtime. Production admin auth uses it to fail closed when `ADMIN_SECRET` is missing.

## Parser Service

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Railway injects | Parser defaults to `8000` if unset. |

## Local `.env.local`

```env
DATABASE_URL="postgresql://pizzalogs:pizzalogs@localhost:5432/pizzalogs?schema=public"
PARSER_SERVICE_URL="http://localhost:8000"
ADMIN_SECRET="local-dev-admin-secret"
```

## Compose Defaults

`docker-compose.yml` provides local-only defaults:

- `DATABASE_URL=postgresql://pizzalogs:pizzalogs@postgres:5432/pizzalogs?schema=public`
- `PARSER_SERVICE_URL=http://parser:8000`
- `ADMIN_SECRET=${ADMIN_SECRET:-local-dev-admin-secret}`
- `ADMIN_COOKIE_SECURE=false`

## Drift Notes

- The upload UI says files up to 1 GB are supported, but the upload route does not currently enforce a hard server-side size limit.
- `UPLOAD_DIR`, `MAX_FILE_SIZE_BYTES`, `DEFAULT_REALM_NAME`, and `DEFAULT_REALM_HOST` were removed from `.env.example` because current app code does not actively use them for upload behavior.

## Never Commit

- `.env`
- `.env.local`
- `.env.sync-agent`
- Railway tokens
- database URLs
- `ADMIN_SECRET`
- one-time recovery/reset secrets
