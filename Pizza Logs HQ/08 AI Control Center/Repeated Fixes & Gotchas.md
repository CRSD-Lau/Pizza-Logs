# Repeated Fixes & Gotchas

> Every time I solve the same problem twice, it goes here. Don't solve it a third time.

---

## Deployment

### Prisma at startup fails with wasm error
**Symptom:** `prisma_schema_build_bg.wasm not found`  
**Cause:** `.bin/prisma` is a bundled script that looks for wasm at `__dirname` — doesn't survive Docker COPY  
**Fix:** Run prisma via package source entry in `start.sh`:
```sh
PRISMA_BIN=$(node -e "
  const pkg = require('./node_modules/prisma/package.json');
  const bin = pkg.bin;
  const rel = typeof bin === 'string' ? bin : (bin.prisma || bin['prisma']);
  console.log('./node_modules/prisma/' + rel);
")
node "$PRISMA_BIN" migrate deploy
```

### nextjs user can't write Prisma engine files
**Symptom:** `Can't write to /app/node_modules/@prisma/engines`  
**Cause:** COPY without `--chown` → root-owned, nextjs user can't write  
**Fix:** Add `--chown=nextjs:nodejs` to all three prisma COPY commands in Dockerfile

### DB not reachable locally
**Symptom:** Can't run migrations or reset DB locally  
**Cause:** `postgres.railway.internal` only reachable from inside Railway network  
**Fix:** Use Railway shell or dashboard SQL. Do not deploy a temporary reset endpoint unless Neil explicitly requests it for that recovery.

---

## SSE / Streaming

### ERR_INVALID_STATE: Controller is already closed
**Symptom:** Upload route crashes on second `controller.close()` call  
**Cause:** Early returns + finally block both calling `close()`  
**Fix:** Wrap in safe helpers:
```typescript
const send  = (data: object) => { try { controller.enqueue(sse(data)); } catch { } };
const close = ()             => { try { controller.close(); }           catch { } };
```
Remove all intermediate `controller.close()` calls. Only `finally` closes.

### Upload status stuck at PARSING
**Symptom:** Encounters saved, but upload shows PARSING forever  
**Cause:** `update(DONE)` was after `computeMilestones` — if milestones errored or stream dropped, status never updated  
**Fix:** Move `db.upload.update({ status: "DONE" })` to BEFORE `computeMilestones`

### Railway drops SSE stream mid-upload (60-90s idle)
**Symptom:** Upload freezes, browser shows stall warning  
**Cause:** Railway proxy times out on idle connections  
**Fix:** Send progress events during all DB phases (92%, 94%, 96%, 98%) as keepalives

---

## TypeScript

### UploadState missing `stalled` field
**Symptom:** TS error on setState calls for "done", "error", "idle"  
**Fix:** Always include `stalled: false` in all setState calls that reset state:
```typescript
setState({ stage: "idle", progress: 0, message: "", elapsed: 0, stalled: false });
```

### Prisma client out of date after schema change
**Symptom:** TS errors like `sessionIndex does not exist in EncounterSelect`  
**Fix:** `npx prisma generate` locally — doesn't need DB connection

---

## UI / React

### AccordionSection vs SectionHeader
**What changed:** All data sections now use `AccordionSection` not `SectionHeader`  
**Pattern:**
```tsx
<AccordionSection title="..." sub="..." count={n} defaultOpen={false}>
  <div className="bg-bg-panel border border-gold-dim rounded ...">
    ...
  </div>
</AccordionSection>
```

### Recharts Legend formatter type error
**Symptom:** `Type '(value, entry: { color: string }) => JSX.Element' is not assignable to type 'Formatter'`  
**Fix:** Make color optional: `entry: { color?: string }`

---

## DB Reset

There is no committed reset endpoint. Use existing admin cleanup actions for upload-derived data, or Railway shell/dashboard SQL for approved destructive recovery. Never commit a reset secret.
