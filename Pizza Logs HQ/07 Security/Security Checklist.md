# Security Checklist

## Current Status

| Area | Status | Notes |
|---|---|---|
| Admin page auth | Done | `middleware.ts` protects `/admin/:path*` except `/admin/login` |
| Admin API auth | Done | Admin import and cleanup actions verify `ADMIN_SECRET` |
| Admin login cookie | Done | `x-admin-secret` is `HttpOnly`; secure in production unless explicitly disabled |
| Production secret fail-closed | Done | Missing `ADMIN_SECRET` denies admin access in production |
| Public upload telemetry | Done | Upload history/detail moved behind admin |
| SQL injection | Low risk | Prisma parameterizes DB queries |
| XSS | Low risk | React escapes output; avoid adding raw HTML rendering |
| Secrets in repo | Guarded | `.env*`, logs, caches, uploads, and combat logs are ignored |
| Upload file type validation | Improved | Parser `/parse`, `/parse-debug`, and `/parse-stream` reject non-`.txt`/`.log` filenames; `/api/upload` still forwards accepted browser uploads |
| Upload size enforcement | Open | UI says 1 GB, but `/api/upload` does not enforce a hard server-side limit |
| Rate limiting | Open | No app-level upload rate limiting |

## Production Checks

- Railway Web Service has `ADMIN_SECRET`.
- Railway Web Service does not set `ADMIN_COOKIE_SECURE=false`.
- Railway env vars and database URLs are never committed.
- Browser userscript admin secret storage is treated as sensitive local state.

## Priority Fixes

1. Enforce upload size while streaming or before forwarding to the parser.
2. Add deeper content sniffing if filename validation proves insufficient.
3. Decide whether Railway-level rate limiting is sufficient.

## Threat Model

| Threat | Likelihood | Impact | Current mitigation |
|---|---|---|---|
| Huge upload wastes resources | Medium | High | Open work: hard size cap and rate limiting |
| Admin data exposed publicly | Low | Medium | Admin middleware and secret-protected APIs |
| Secret committed to repo | Low | Critical | `.gitignore`, PR checklist, manual staged-secret review |
| Malicious combat-log text | Low | Low | Parsed as strings; no code execution |
| Warmane import abused cross-origin | Low | Medium | Admin secret plus Warmane origin checks on import APIs |
