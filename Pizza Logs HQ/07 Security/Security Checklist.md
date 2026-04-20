# Security Checklist

---

## Current Status

| Item | Status | Notes |
|---|---|---|
| Admin page auth | ✅ Done | `middleware.ts` + `ADMIN_SECRET` env var + `/admin/login` page |
| Reset-DB endpoint | ✅ Built-in | `ClearDatabaseButton` on `/admin` — server action re-verifies secret |
| File upload validation | ⚠️ Partial | Accepts only .txt/.log, no server-side MIME check |
| SQL injection | ✅ Safe | Prisma parameterizes all queries |
| XSS | ✅ Safe | React escapes by default; no dangerouslySetInnerHTML |
| Secrets in repo | ✅ None | `.env.local` gitignored |
| CORS | ✅ N/A | Not an API consumed by third parties |
| Rate limiting | ❌ None | Upload endpoint has no rate limit |
| File size limit | ⚠️ Soft | UI says 1GB, no server enforcement |

---

## Priority Fixes

### 1. Admin auth (30 min)
```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const secret = req.cookies.get("admin-secret")?.value;
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }
  return NextResponse.next();
}
```
Set `ADMIN_SECRET` env var on Railway. Simple login page sets cookie.

### 2. Server-side file type validation
```typescript
// In upload route, before forwarding to parser:
const buf = await file.slice(0, 4).arrayBuffer();
// .txt files don't have magic bytes — validate content-type header instead
if (!contentType.includes("text/plain") && !contentType.includes("multipart/form-data")) {
  return error response;
}
```

### 3. Upload rate limiting
Consider Railway's built-in rate limiting or a simple in-memory limiter on `/api/upload`.

---

## Threat Model (brief)

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Someone uploads a huge file to OOM parser | Medium | Parser crash | File size hard limit in upload route |
| Admin page scraped for internal info | Low | Minor | Add auth |
| Malicious log file with injected data | Low | None | Parser is Python string parsing, no code execution |
| DB connection string exposed | Low | Critical | Keep in Railway env vars only, never in code |
