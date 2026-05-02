# Warmane Sync Agent (Option B: Admin UI + Desktop Bridge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual Warmane userscript runs with a UI-triggered + auto-scheduled system: admin page buttons fire sync requests stored in the database, a silent desktop bridge service picks them up, fetches Warmane data using the desktop's residential IP (bypassing Cloudflare), and posts validated snapshots back to Railway.

**Architecture:** The admin page at `/admin` gains a `SyncHealthPanel` with "Sync Roster" and "Sync Gear" buttons. Clicking a button writes a `SyncJob` row via a Next.js server action (so `ADMIN_SECRET` never touches the browser). A Node.js service on the desktop polls Railway every 5 seconds for pending jobs; when one arrives it fetches from Warmane locally, enriches with Wowhead (also from the desktop), validates the snapshot, and POSTs to the existing Railway import endpoints. The bridge also self-schedules (roster every 6 h, gear every 12 h) so manual triggers are optional.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Node.js + ts-node (bridge), Vitest (bridge unit tests), dotenv, PowerShell (Task Scheduler setup)

---

## File Structure

### New Files

| Path | Responsibility |
|------|----------------|
| `app/admin/actions.ts` | Server action `triggerSync(type)` — adds `ADMIN_SECRET` server-side, writes `SyncJob` |
| `app/api/admin/sync/trigger/route.ts` | POST: create SyncJob (no auth — called by server action internally, also usable directly) |
| `app/api/admin/sync/pending/route.ts` | GET: atomically claim first PENDING job (bridge sends `x-admin-secret` header) |
| `app/api/admin/sync/complete/route.ts` | POST: bridge marks job DONE or FAILED |
| `app/api/admin/sync/status/route.ts` | GET: last job results + pending count (no auth — admin page polls this) |
| `components/admin/SyncHealthPanel.tsx` | Client component: trigger buttons + live status polling every 10 s |
| `sync-agent/config.ts` | Load + validate bridge env config (origin, secret, intervals) |
| `sync-agent/logger.ts` | Timestamped log to stdout + `.sync-agent-logs/sync.log` |
| `sync-agent/validate.ts` | Pure fns: detect HTML challenge pages, Warmane error JSON, empty payloads |
| `sync-agent/warmane/wowhead.ts` | Fetch Wowhead tooltip JSON, return `itemLevel`/`iconUrl` |
| `sync-agent/warmane/character.ts` | Fetch Warmane character summary → enrich items → return `CharacterGear` |
| `sync-agent/warmane/roster.ts` | Fetch Warmane guild JSON → return `RosterMember[]` |
| `sync-agent/jobs/roster.ts` | Handle ROSTER job: fetch → validate → POST to Railway |
| `sync-agent/jobs/gear.ts` | Handle GEAR job: get queue → fetch each char → enrich → POST each |
| `sync-agent/index.ts` | Polling loop (5 s) + self-scheduler (6 h roster / 12 h gear) + dispatcher |
| `tsconfig.sync.json` | TypeScript config for bridge (Node 18, CommonJS, no Next.js libs) |
| `.env.sync-agent.example` | Template env file for bridge configuration |
| `scripts/setup-sync-scheduler.ps1` | Windows Task Scheduler registration (runs bridge on login) |
| `__tests__/sync-agent/validate.test.ts` | Unit tests for HTML detection + payload validation |
| `__tests__/sync-agent/warmane-roster.test.ts` | Unit tests for roster JSON normalization |
| `vitest.config.ts` | Vitest config (includes only `__tests__/sync-agent/**`) |

### Modified Files

| Path | Change |
|------|--------|
| `prisma/schema.prisma` | Add `SyncJob` model + `SyncJobType`/`SyncJobStatus` enums; add `lastSuccessAt`/`sourceAgent` to `ArmoryGearCache` |
| `lib/warmane-armory.ts` | `writeCachedGear`: skip Wowhead enrichment if already done; add snapshot preservation guard |
| `app/api/admin/guild-roster/import/route.ts` | Reject zero-member roster after normalization |
| `app/admin/page.tsx` | Import + render `SyncHealthPanel`; update section heading for Guild Roster |
| `package.json` | Add `sync:warmane`, `sync:warmane:dry`, `test:sync` scripts |

---

## Tasks

### Task 1: Prisma schema — SyncJob model + ArmoryGearCache fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and SyncJob model to the bottom of `prisma/schema.prisma`** (before the final blank line)

```prisma
// ─────────────────────────────────────────────
//  SYNC JOBS  (desktop bridge job queue)
// ─────────────────────────────────────────────

enum SyncJobType {
  ROSTER
  GEAR
}

enum SyncJobStatus {
  PENDING
  IN_PROGRESS
  DONE
  FAILED
  CANCELLED
}

model SyncJob {
  id          String        @id @default(cuid())
  type        SyncJobType
  status      SyncJobStatus @default(PENDING)
  triggeredAt DateTime      @default(now())
  startedAt   DateTime?
  completedAt DateTime?
  agentId     String?
  error       String?
  result      Json?

  @@index([status, triggeredAt])
  @@map("sync_jobs")
}
```

- [ ] **Step 2: Add `lastSuccessAt` and `sourceAgent` fields to `ArmoryGearCache`**

Find the `ArmoryGearCache` model and add after `lastError`:

```prisma
  lastSuccessAt DateTime?
  sourceAgent   String?
```

The full updated model should look like:

```prisma
model ArmoryGearCache {
  id            String    @id @default(cuid())
  characterName String
  characterKey  String
  realm         String    @default("Lordaeron")
  sourceUrl     String
  gear          Json
  fetchedAt     DateTime
  lastAttemptAt DateTime  @default(now())
  lastError     String?
  lastSuccessAt DateTime?
  sourceAgent   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([characterKey, realm])
  @@index([fetchedAt])
  @@map("armory_gear_cache")
}
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add_sync_jobs
```

Expected output: `The following migration(s) have been created and applied` and the `sync_jobs` table appears.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Verify type-check passes**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SyncJob model and sync health fields to ArmoryGearCache"
```

---

### Task 2: Harden `writeCachedGear` — skip redundant enrichment + snapshot preservation

**Files:**
- Modify: `lib/warmane-armory.ts` (function `writeCachedGear` at line ~395)

The bridge enriches gear before posting to Railway. If we don't skip enrichment server-side, Railway will try to re-fetch Wowhead and likely fail (Cloudflare-blocked), corrupting already-good data. We also add a guard: never replace a healthy snapshot with a degraded one.

- [ ] **Step 1: Replace the `writeCachedGear` function body**

Find the existing `writeCachedGear` export and replace it entirely with:

```typescript
export async function writeCachedGear(
  gear: ArmoryCharacterGear,
  opts?: { sourceAgent?: string }
): Promise<ArmoryCharacterGear> {
  // Skip Wowhead enrichment if items are already fully enriched (e.g. posted by bridge)
  const needsEnrichment = gearNeedsWowheadEnrichment(gear);
  const enrichedGear: ArmoryCharacterGear = {
    ...gear,
    items: needsEnrichment
      ? normalizeArmoryGearSlots(await enrichGearWithWowhead(gear.items))
      : normalizeArmoryGearSlots(gear.items),
  };

  // Snapshot preservation: don't overwrite a healthy cache with a degraded fetch
  const existing = await db.armoryGearCache.findUnique({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(enrichedGear.characterName),
        realm: enrichedGear.realm,
      },
    },
    select: { gear: true },
  });

  if (existing && isArmoryCharacterGear(existing.gear)) {
    const existingCount = existing.gear.items.length;
    if (existingCount >= 10 && enrichedGear.items.length < Math.floor(existingCount * 0.5)) {
      // New snapshot has fewer than half the items of the existing one — skip write
      return enrichedGear;
    }
  }

  await db.armoryGearCache.upsert({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(enrichedGear.characterName),
        realm: enrichedGear.realm,
      },
    },
    create: {
      characterName: enrichedGear.characterName,
      characterKey: getCharacterKey(enrichedGear.characterName),
      realm: enrichedGear.realm,
      sourceUrl: enrichedGear.sourceUrl,
      gear: enrichedGear,
      fetchedAt: new Date(enrichedGear.fetchedAt),
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      ...(opts?.sourceAgent ? { sourceAgent: opts.sourceAgent } : {}),
    },
    update: {
      characterName: enrichedGear.characterName,
      sourceUrl: enrichedGear.sourceUrl,
      gear: enrichedGear,
      fetchedAt: new Date(enrichedGear.fetchedAt),
      lastAttemptAt: new Date(),
      lastError: null,
      lastSuccessAt: new Date(),
      ...(opts?.sourceAgent ? { sourceAgent: opts.sourceAgent } : {}),
    },
  });

  return enrichedGear;
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/warmane-armory.ts
git commit -m "feat: skip redundant Wowhead enrichment and guard against degraded gear snapshots"
```

---

### Task 3: Harden roster import — reject zero-member payloads

**Files:**
- Modify: `app/api/admin/guild-roster/import/route.ts`

`normalizeImportedGuildRoster` can return `{ ok: true, members: [] }` if all member entries were malformed. We need to catch this before writing.

- [ ] **Step 1: Add the zero-member guard after normalization**

Find the block in the `POST` handler that calls `normalizeImportedGuildRoster` and calls `writeGuildRosterMembers`. After the normalization check, add:

```typescript
  const normalized = normalizeImportedGuildRoster(payload);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.message }, { status: 400, headers });
  }

  // Reject empty rosters — prevents a bad Warmane response from clearing the roster
  if (normalized.members.length === 0) {
    return NextResponse.json({ ok: false, error: "Empty roster — import skipped to preserve existing data." }, { status: 400, headers });
  }

  await writeGuildRosterMembers(normalized.members);
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/guild-roster/import/route.ts
git commit -m "feat: reject zero-member roster imports to preserve existing data"
```

---

### Task 4: Sync API — four endpoints (trigger, pending, complete, status)

**Files:**
- Create: `app/api/admin/sync/trigger/route.ts`
- Create: `app/api/admin/sync/pending/route.ts`
- Create: `app/api/admin/sync/complete/route.ts`
- Create: `app/api/admin/sync/status/route.ts`

- [ ] **Step 1: Create trigger endpoint**

```typescript
// app/api/admin/sync/trigger/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const type = (body as Record<string, unknown>)?.type;
  if (type !== "ROSTER" && type !== "GEAR") {
    return NextResponse.json({ ok: false, error: "type must be ROSTER or GEAR" }, { status: 400 });
  }

  // Cancel any existing PENDING jobs of the same type to avoid queue buildup
  await db.syncJob.updateMany({
    where: { type, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const job = await db.syncJob.create({
    data: { type, status: "PENDING" },
  });

  return NextResponse.json({ ok: true, jobId: job.id, type: job.type });
}
```

- [ ] **Step 2: Create pending endpoint** (bridge polls this to claim jobs)

```typescript
// app/api/admin/sync/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const agentId = req.headers.get("x-agent-id") ?? "unknown";

  const job = await db.syncJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { triggeredAt: "asc" },
  });

  if (!job) return NextResponse.json({ ok: true, job: null });

  // Atomic claim: update only succeeds if status is still PENDING
  const claimed = await db.syncJob
    .update({
      where: { id: job.id, status: "PENDING" },
      data: { status: "IN_PROGRESS", startedAt: new Date(), agentId },
    })
    .catch(() => null);

  if (!claimed) return NextResponse.json({ ok: true, job: null });

  return NextResponse.json({ ok: true, job: { id: claimed.id, type: claimed.type } });
}
```

- [ ] **Step 3: Create complete endpoint** (bridge posts result here)

```typescript
// app/api/admin/sync/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const { jobId, success, error, result } = (body as Record<string, unknown>) ?? {};

  if (typeof jobId !== "string") {
    return NextResponse.json({ ok: false, error: "jobId required." }, { status: 400 });
  }

  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: success ? "DONE" : "FAILED",
      completedAt: new Date(),
      error: typeof error === "string" ? error : null,
      result: result !== undefined ? (result as object) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create status endpoint** (admin page polls this — no auth required)

```typescript
// app/api/admin/sync/status/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [lastRoster, lastGear, pendingCount, inProgressJob] = await Promise.all([
    db.syncJob.findFirst({
      where: { type: "ROSTER", status: { in: ["DONE", "FAILED"] } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true, error: true, result: true, agentId: true },
    }),
    db.syncJob.findFirst({
      where: { type: "GEAR", status: { in: ["DONE", "FAILED"] } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true, error: true, result: true, agentId: true },
    }),
    db.syncJob.count({ where: { status: "PENDING" } }),
    db.syncJob.findFirst({
      where: { status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { type: true, startedAt: true, agentId: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    roster: lastRoster ?? null,
    gear: lastGear ?? null,
    pendingCount,
    inProgress: inProgressJob ?? null,
  });
}
```

- [ ] **Step 5: Verify type-check passes**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 6: Smoke-test trigger endpoint locally**

Start dev server: `npm run dev`

```bash
curl -X POST http://localhost:3000/api/admin/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"type":"ROSTER"}'
```

Expected: `{"ok":true,"jobId":"...","type":"ROSTER"}`

```bash
curl http://localhost:3000/api/admin/sync/status
```

Expected: `{"ok":true,"roster":null,"gear":null,"pendingCount":1,"inProgress":null}`

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/sync/
git commit -m "feat: add sync trigger/pending/complete/status API endpoints"
```

---

### Task 5: Admin UI — SyncHealthPanel + server action

**Files:**
- Create: `app/admin/actions.ts`
- Create: `components/admin/SyncHealthPanel.tsx`

- [ ] **Step 1: Create server action `app/admin/actions.ts`**

The server action runs on the server so `ADMIN_SECRET` never reaches the browser. It directly writes to the database (same logic as the trigger endpoint) rather than calling the HTTP endpoint.

```typescript
// app/admin/actions.ts
"use server";

import { db } from "@/lib/db";

export async function triggerSync(
  type: "ROSTER" | "GEAR"
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  try {
    await db.syncJob.updateMany({
      where: { type, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    const job = await db.syncJob.create({
      data: { type, status: "PENDING" },
    });

    return { ok: true, jobId: job.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
```

- [ ] **Step 2: Create `components/admin/SyncHealthPanel.tsx`**

```tsx
// components/admin/SyncHealthPanel.tsx
"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { triggerSync } from "@/app/admin/actions";

type SyncJobSummary = {
  status: "DONE" | "FAILED";
  completedAt: string | null;
  error: string | null;
  result: Record<string, number> | null;
  agentId: string | null;
} | null;

type SyncStatus = {
  ok: boolean;
  roster: SyncJobSummary;
  gear: SyncJobSummary;
  pendingCount: number;
  inProgress: { type: string; startedAt: string; agentId: string | null } | null;
};

function ago(dateStr: string | null | undefined): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SyncHealthPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<"ROSTER" | "GEAR" | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, [poll]);

  const trigger = (type: "ROSTER" | "GEAR") => {
    setActiveType(type);
    setMessage(null);
    startTransition(async () => {
      const result = await triggerSync(type);
      if (result.ok) {
        setMessage(`${type} sync queued — bridge will pick it up shortly`);
        await poll();
      } else {
        setMessage(`Error: ${result.error}`);
      }
      setActiveType(null);
    });
  };

  const running = (type: "ROSTER" | "GEAR") => status?.inProgress?.type === type;
  const hasPending = (status?.pendingCount ?? 0) > 0;

  return (
    <div className="bg-bg-panel border border-gold-dim rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          Warmane Auto-Sync
        </span>
        {status?.inProgress && (
          <span className="text-xs text-warning animate-pulse">
            {status.inProgress.type} syncing
            {status.inProgress.agentId ? ` on ${status.inProgress.agentId}` : ""}…
          </span>
        )}
        {hasPending && !status?.inProgress && (
          <span className="text-xs text-text-dim">
            {status?.pendingCount} job{(status?.pendingCount ?? 0) > 1 ? "s" : ""} queued —
            waiting for bridge
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SyncCard
          label="Guild Roster"
          job={status?.roster ?? null}
          running={running("ROSTER")}
          triggering={isPending && activeType === "ROSTER"}
          onTrigger={() => trigger("ROSTER")}
          resultKey="membersImported"
          resultLabel="members"
        />
        <SyncCard
          label="Gear Cache"
          job={status?.gear ?? null}
          running={running("GEAR")}
          triggering={isPending && activeType === "GEAR"}
          onTrigger={() => trigger("GEAR")}
          resultKey="synced"
          resultLabel="synced"
        />
      </div>

      {message && <p className="text-xs text-text-secondary">{message}</p>}

      <p className="text-xs text-text-dim">
        Desktop bridge must be running to process queued jobs.
      </p>
    </div>
  );
}

function SyncCard({
  label,
  job,
  running,
  triggering,
  onTrigger,
  resultKey,
  resultLabel,
}: {
  label: string;
  job: SyncJobSummary;
  running: boolean;
  triggering: boolean;
  onTrigger: () => void;
  resultKey: string;
  resultLabel: string;
}) {
  const isOk = job?.status === "DONE";
  return (
    <div className="rounded border border-gold-dim bg-bg-card p-3 space-y-2">
      <div className="text-xs font-medium text-text-secondary">{label}</div>
      {job ? (
        <>
          <div className={`text-xs font-semibold ${isOk ? "text-success" : "text-danger"}`}>
            {isOk ? "✓" : "✗"} {ago(job.completedAt)}
          </div>
          {job.error && (
            <div className="text-xs text-danger truncate" title={job.error}>
              {job.error}
            </div>
          )}
          {job.result && typeof job.result[resultKey] === "number" && (
            <div className="text-xs text-text-dim">
              {job.result[resultKey]} {resultLabel}
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-text-dim">No sync yet</div>
      )}
      <button
        onClick={onTrigger}
        disabled={running || triggering}
        className="w-full rounded bg-gold/10 border border-gold-dim px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {running ? "Running…" : triggering ? "Queuing…" : `Sync ${label}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify type-check passes**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts components/admin/SyncHealthPanel.tsx
git commit -m "feat: add SyncHealthPanel component and triggerSync server action"
```

---

### Task 6: Wire SyncHealthPanel into admin page

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add import at the top of `app/admin/page.tsx`**

After the existing imports, add:

```typescript
import { SyncHealthPanel } from "@/components/admin/SyncHealthPanel";
```

- [ ] **Step 2: Replace section 3 (Guild Roster) with two sections**

Find the comment `{/* 3. Guild Roster */}` and replace the whole section block with:

```tsx
      {/* 3. Warmane Auto-Sync */}
      <section>
        <SectionHeader
          title="Warmane Auto-Sync"
          sub="Trigger and monitor roster and gear syncs from your desktop bridge"
        />
        <SyncHealthPanel />
      </section>

      {/* 4. Guild Roster — read-only stats */}
      <section>
        <SectionHeader title="Guild Roster" sub="Browser-assisted import for PizzaWarriors" />
        <GuildRosterSyncPanel
          rosterCount={rosterCount}
          latestSync={latestRosterSync?.lastSyncedAt ?? null}
        />
      </section>
```

- [ ] **Step 3: Verify type-check passes**

```bash
npm run type-check
```

- [ ] **Step 4: Start dev server and verify the admin page loads**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Confirm the "Warmane Auto-Sync" section appears with "Sync Roster" and "Sync Gear" buttons. Click "Sync Roster" — the button should show "Queuing…" briefly, then display "ROSTER sync queued — bridge will pick it up shortly".

- [ ] **Step 5: Commit and deploy**

```bash
git add app/admin/page.tsx
git commit -m "feat: add Warmane Auto-Sync panel to admin page"
git push origin main
```

Railway deploys automatically. Verify the section appears on the live admin page.

---

### Task 7: Vitest setup + `sync-agent/validate.ts` + tests

**Files:**
- Create: `vitest.config.ts`
- Create: `sync-agent/validate.ts`
- Create: `__tests__/sync-agent/validate.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create `vitest.config.ts` in the repo root**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/sync-agent/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Create `sync-agent/validate.ts`**

```typescript
// sync-agent/validate.ts

export function isHtmlChallengePage(text: string): boolean {
  const t = text.trimStart();
  return (
    t.startsWith("<!DOCTYPE") ||
    t.startsWith("<!doctype") ||
    t.startsWith("<html")
  );
}

export function isWarmaneErrorJson(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.error === "string" && obj.error.length > 0;
}

export function isValidGearPayload(
  data: unknown
): data is { name: string; equipment: unknown[] } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    obj.name.length > 0 &&
    Array.isArray(obj.equipment) &&
    obj.equipment.length > 0
  );
}

export function isValidRosterPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const members = obj.guildMembers ?? obj.roster ?? obj.members;
  return Array.isArray(members) && members.length > 0;
}
```

- [ ] **Step 4: Write the failing tests**

```typescript
// __tests__/sync-agent/validate.test.ts
import { describe, it, expect } from "vitest";
import {
  isHtmlChallengePage,
  isWarmaneErrorJson,
  isValidGearPayload,
  isValidRosterPayload,
} from "../../sync-agent/validate";

describe("isHtmlChallengePage", () => {
  it("detects uppercase DOCTYPE", () => {
    expect(isHtmlChallengePage("<!DOCTYPE html><html>...")).toBe(true);
  });
  it("detects lowercase doctype", () => {
    expect(isHtmlChallengePage("<!doctype html>...")).toBe(true);
  });
  it("detects html tag", () => {
    expect(isHtmlChallengePage("<html lang='en'>")).toBe(true);
  });
  it("passes valid JSON string", () => {
    expect(isHtmlChallengePage('{"name":"Lausudo"}')).toBe(false);
  });
  it("handles leading whitespace before DOCTYPE", () => {
    expect(isHtmlChallengePage("\n\n<!DOCTYPE html>")).toBe(true);
  });
});

describe("isWarmaneErrorJson", () => {
  it("detects error field", () => {
    expect(isWarmaneErrorJson({ error: "Character not found." })).toBe(true);
  });
  it("passes response with no error field", () => {
    expect(isWarmaneErrorJson({ name: "Lausudo", equipment: [] })).toBe(false);
  });
  it("returns false for null", () => {
    expect(isWarmaneErrorJson(null)).toBe(false);
  });
  it("returns false for non-object", () => {
    expect(isWarmaneErrorJson("string")).toBe(false);
  });
});

describe("isValidGearPayload", () => {
  it("passes payload with name and non-empty equipment", () => {
    expect(
      isValidGearPayload({ name: "Lausudo", equipment: [{ name: "Shadowmourne" }] })
    ).toBe(true);
  });
  it("rejects empty equipment array", () => {
    expect(isValidGearPayload({ name: "Lausudo", equipment: [] })).toBe(false);
  });
  it("rejects missing name", () => {
    expect(isValidGearPayload({ equipment: [{ name: "Sword" }] })).toBe(false);
  });
  it("rejects non-object", () => {
    expect(isValidGearPayload(null)).toBe(false);
  });
});

describe("isValidRosterPayload", () => {
  it("accepts guildMembers key", () => {
    expect(isValidRosterPayload({ guildMembers: [{ name: "Lausudo" }] })).toBe(true);
  });
  it("accepts roster key", () => {
    expect(isValidRosterPayload({ roster: [{ name: "Lausudo" }] })).toBe(true);
  });
  it("accepts members key", () => {
    expect(isValidRosterPayload({ members: [{ name: "Lausudo" }] })).toBe(true);
  });
  it("rejects empty array", () => {
    expect(isValidRosterPayload({ guildMembers: [] })).toBe(false);
  });
  it("rejects non-object", () => {
    expect(isValidRosterPayload("not an object")).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npx vitest run
```

Expected: all 18 tests pass, 0 failures.

- [ ] **Step 6: Add test:sync script to `package.json`**

In the `"scripts"` section, add:

```json
"test:sync": "vitest run"
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts sync-agent/validate.ts __tests__/sync-agent/validate.test.ts package.json
git commit -m "feat: add bridge validation utilities + Vitest test suite"
```

---

### Task 8: Bridge infrastructure — config, logger, tsconfig

**Files:**
- Create: `tsconfig.sync.json`
- Create: `sync-agent/config.ts`
- Create: `sync-agent/logger.ts`

- [ ] **Step 1: Create `tsconfig.sync.json` in repo root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": ".sync-agent-dist",
    "rootDir": ".",
    "baseUrl": "."
  },
  "include": ["sync-agent/**/*.ts"],
  "exclude": ["node_modules", ".next", "app", "components", "lib", "prisma"]
}
```

- [ ] **Step 2: Install `dotenv` if not already present**

```bash
npm list dotenv || npm install dotenv
```

- [ ] **Step 3: Create `sync-agent/config.ts`**

```typescript
// sync-agent/config.ts
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

const envFile = join(process.cwd(), ".env.sync-agent");
if (existsSync(envFile)) {
  loadEnv({ path: envFile });
}

export type SyncConfig = {
  origin: string;
  adminSecret: string;
  agentId: string;
  pollIntervalMs: number;
  rosterIntervalMs: number;
  gearIntervalMs: number;
  requestDelayMs: number;
  dryRun: boolean;
};

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optionalNumber(name: string, defaultVal: number): number {
  const val = process.env[name];
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

export function loadConfig(): SyncConfig {
  return {
    origin:
      process.env.PIZZA_LOGS_ORIGIN ??
      "https://pizza-logs-production.up.railway.app",
    adminSecret: requireEnv("PIZZA_ADMIN_SECRET"),
    agentId:
      process.env.SYNC_AGENT_ID ??
      `agent-${process.platform}-${process.pid}`,
    pollIntervalMs: optionalNumber("POLL_INTERVAL_MS", 5_000),
    rosterIntervalMs:
      optionalNumber("ROSTER_INTERVAL_HOURS", 6) * 60 * 60 * 1000,
    gearIntervalMs:
      optionalNumber("GEAR_INTERVAL_HOURS", 12) * 60 * 60 * 1000,
    requestDelayMs: optionalNumber("REQUEST_DELAY_MS", 2_500),
    dryRun: process.env.DRY_RUN === "true",
  };
}
```

- [ ] **Step 4: Create `sync-agent/logger.ts`**

```typescript
// sync-agent/logger.ts
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), ".sync-agent-logs");
const LOG_FILE = join(LOG_DIR, "sync.log");

if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, ...args: unknown[]): void {
  const parts = args.map((a) =>
    typeof a === "string" ? a : JSON.stringify(a)
  );
  const line = `[${timestamp()}] [${level}] ${parts.join(" ")}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

export const log = {
  info: (...args: unknown[]) => write("INFO", ...args),
  warn: (...args: unknown[]) => write("WARN", ...args),
  error: (...args: unknown[]) => write("ERROR", ...args),
};
```

- [ ] **Step 5: Verify tsconfig.sync.json compiles correctly**

```bash
npx tsc --project tsconfig.sync.json --noEmit
```

Expected: 0 errors (may warn about missing entry files — that's fine at this stage).

- [ ] **Step 6: Commit**

```bash
git add tsconfig.sync.json sync-agent/config.ts sync-agent/logger.ts
git commit -m "feat: add bridge tsconfig, config loader, and logger"
```

---

### Task 9: Bridge Warmane fetchers + roster unit tests

**Files:**
- Create: `sync-agent/warmane/wowhead.ts`
- Create: `sync-agent/warmane/character.ts`
- Create: `sync-agent/warmane/roster.ts`
- Create: `__tests__/sync-agent/warmane-roster.test.ts`

- [ ] **Step 1: Create `sync-agent/warmane/wowhead.ts`**

```typescript
// sync-agent/warmane/wowhead.ts

const TIMEOUT_MS = 8_000;

export type WowheadItemData = {
  itemLevel?: number;
  iconUrl?: string;
};

export async function fetchWowheadItem(
  itemId: string
): Promise<WowheadItemData> {
  const url = `https://www.wowhead.com/wotlk/tooltip/item/${itemId}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    const iconName =
      typeof data.icon === "string" ? data.icon : null;
    return {
      itemLevel:
        typeof data.itemLevel === "number" ? data.itemLevel : undefined,
      iconUrl: iconName
        ? `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`
        : undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 2: Create `sync-agent/warmane/character.ts`**

```typescript
// sync-agent/warmane/character.ts
import { isHtmlChallengePage, isWarmaneErrorJson, isValidGearPayload } from "../validate";
import { fetchWowheadItem } from "./wowhead";

const TIMEOUT_MS = 10_000;
const WOWHEAD_DELAY_MS = 1_500;

export type GearItem = {
  slot: string;
  name: string;
  itemId?: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl?: string;
  equipLoc?: string;
  enchant?: string;
  gems?: string[];
};

export type CharacterGear = {
  characterName: string;
  realm: string;
  sourceUrl: string;
  fetchedAt: string;
  items: GearItem[];
};

const SLOTS = [
  "Head", "Neck", "Shoulder", "Back", "Chest", "Shirt", "Tabard", "Wrist",
  "Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2",
  "Trinket 1", "Trinket 2", "Main Hand", "Off Hand", "Ranged",
] as const;

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichItem(item: GearItem): Promise<GearItem> {
  // Skip if already fully enriched
  if (item.itemLevel && item.iconUrl) return item;
  if (!item.itemId) return item;

  const data = await fetchWowheadItem(item.itemId);
  await delay(WOWHEAD_DELAY_MS);

  return {
    ...item,
    itemLevel: item.itemLevel ?? data.itemLevel,
    iconUrl: item.iconUrl ?? data.iconUrl,
    itemUrl:
      item.itemUrl ??
      `https://www.wowhead.com/wotlk/item=${item.itemId}`,
  };
}

export async function fetchCharacterGear(
  characterName: string,
  realm: string,
  opts?: { enrich?: boolean }
): Promise<CharacterGear | null> {
  const apiUrl = `https://armory.warmane.com/api/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;
  const sourceUrl = `https://armory.warmane.com/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    if (isHtmlChallengePage(text)) return null;

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (isWarmaneErrorJson(data)) return null;
    if (!isValidGearPayload(data)) return null;

    const rawItems = (data as { equipment: unknown[] }).equipment;
    const items: GearItem[] = rawItems
      .map((raw, i): GearItem | null => {
        if (!raw || typeof raw !== "object") return null;
        const r = raw as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim() : null;
        if (!name) return null;
        const itemId =
          typeof r.item === "string"
            ? r.item
            : typeof r.item === "number"
            ? String(r.item)
            : undefined;
        return {
          slot: SLOTS[i] ?? `Slot ${i + 1}`,
          name,
          itemId,
          quality: typeof r.quality === "string" ? r.quality : undefined,
          itemLevel:
            typeof r.itemLevel === "number" ? r.itemLevel : undefined,
          iconUrl:
            typeof r.iconUrl === "string" ? r.iconUrl : undefined,
          equipLoc:
            typeof r.equipLoc === "string" ? r.equipLoc : undefined,
          enchant:
            typeof r.enchant === "string" ? r.enchant : undefined,
        };
      })
      .filter((item): item is GearItem => item !== null);

    if (items.length === 0) return null;

    const finalItems =
      opts?.enrich !== false
        ? await Promise.all(items.map(enrichItem))
        : items;

    return {
      characterName:
        typeof (data as Record<string, unknown>).name === "string"
          ? (data as Record<string, unknown>).name as string
          : characterName,
      realm,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      items: finalItems,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 3: Create `sync-agent/warmane/roster.ts`**

```typescript
// sync-agent/warmane/roster.ts
import { isHtmlChallengePage, isWarmaneErrorJson } from "../validate";

const GUILD = "Pizza+Warriors";
const REALM = "Lordaeron";
const TIMEOUT_MS = 15_000;

export type RosterMember = {
  characterName: string;
  normalizedCharacterName: string;
  guildName: string;
  realm: string;
  className?: string;
  raceName?: string;
  level?: number;
  rankName?: string;
  rankOrder?: number;
  armoryUrl: string;
  lastSyncedAt: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeRosterJson(data: unknown): RosterMember[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).roster;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const now = new Date().toISOString();
  const members = raw
    .map((entry): RosterMember | null => {
      if (!entry || typeof entry !== "object") return null;
      const r = entry as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : null;
      if (!name) return null;
      return {
        characterName: name,
        normalizedCharacterName: normalizeName(name),
        guildName: "Pizza Warriors",
        realm: REALM,
        className: typeof r.class === "string" ? r.class : undefined,
        raceName: typeof r.race === "string" ? r.race : undefined,
        level: typeof r.level === "number" ? r.level : undefined,
        rankName:
          typeof r.rankName === "string" ? r.rankName : undefined,
        rankOrder:
          typeof r.rankOrder === "number" ? r.rankOrder : undefined,
        armoryUrl: `https://armory.warmane.com/character/${encodeURIComponent(name)}/${REALM}/summary`,
        lastSyncedAt: now,
      };
    })
    .filter((m): m is RosterMember => m !== null);

  return members.length > 0 ? members : null;
}

export async function fetchGuildRoster(): Promise<RosterMember[] | null> {
  const url = `https://armory.warmane.com/api/guild/${GUILD}/${REALM}/summary`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    if (isHtmlChallengePage(text)) return null;

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (isWarmaneErrorJson(data)) return null;
    return normalizeRosterJson(data);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Write failing roster tests**

```typescript
// __tests__/sync-agent/warmane-roster.test.ts
import { describe, it, expect } from "vitest";
import { normalizeRosterJson } from "../../sync-agent/warmane/roster";

describe("normalizeRosterJson", () => {
  it("returns null for non-object", () => {
    expect(normalizeRosterJson("string")).toBeNull();
  });

  it("returns null for missing roster key", () => {
    expect(normalizeRosterJson({ members: [] })).toBeNull();
  });

  it("returns null for empty roster array", () => {
    expect(normalizeRosterJson({ roster: [] })).toBeNull();
  });

  it("parses a valid roster", () => {
    const data = {
      roster: [
        { name: "Lausudo", class: "Paladin", level: 80, rankName: "Officer", rankOrder: 2 },
        { name: "Writman", class: "Warlock", level: 80 },
      ],
    };
    const result = normalizeRosterJson(data);
    expect(result).toHaveLength(2);
    expect(result![0]).toMatchObject({
      characterName: "Lausudo",
      normalizedCharacterName: "lausudo",
      guildName: "Pizza Warriors",
      realm: "Lordaeron",
      className: "Paladin",
      rankName: "Officer",
      rankOrder: 2,
    });
    expect(result![1].characterName).toBe("Writman");
  });

  it("trims whitespace from names", () => {
    const data = { roster: [{ name: "  Lausudo  " }] };
    const result = normalizeRosterJson(data);
    expect(result![0].characterName).toBe("Lausudo");
    expect(result![0].normalizedCharacterName).toBe("lausudo");
  });

  it("filters out entries without names", () => {
    const data = {
      roster: [{ class: "Paladin" }, { name: "Lausudo" }],
    };
    const result = normalizeRosterJson(data);
    expect(result).toHaveLength(1);
    expect(result![0].characterName).toBe("Lausudo");
  });

  it("sets correct armoryUrl", () => {
    const data = { roster: [{ name: "Lausudo" }] };
    const result = normalizeRosterJson(data);
    expect(result![0].armoryUrl).toBe(
      "https://armory.warmane.com/character/Lausudo/Lordaeron/summary"
    );
  });
});
```

- [ ] **Step 5: Run all bridge tests**

```bash
npx vitest run
```

Expected: all tests pass (validate tests + roster tests).

- [ ] **Step 6: Commit**

```bash
git add sync-agent/warmane/ __tests__/sync-agent/warmane-roster.test.ts
git commit -m "feat: add Warmane character + roster fetchers with unit tests"
```

---

### Task 10: Bridge job handlers — roster + gear

**Files:**
- Create: `sync-agent/jobs/roster.ts`
- Create: `sync-agent/jobs/gear.ts`

- [ ] **Step 1: Create `sync-agent/jobs/roster.ts`**

```typescript
// sync-agent/jobs/roster.ts
import { fetchGuildRoster } from "../warmane/roster";
import { log } from "../logger";
import type { SyncConfig } from "../config";

export type RosterJobResult = {
  membersImported: number;
  error?: string;
};

export async function runRosterJob(
  config: SyncConfig
): Promise<RosterJobResult> {
  log.info("ROSTER job: fetching guild roster from Warmane…");

  const members = await fetchGuildRoster();
  if (!members) {
    const error =
      "Failed to fetch roster — Warmane returned HTML challenge or empty response";
    log.warn("ROSTER job:", error);
    return { membersImported: 0, error };
  }

  log.info(`ROSTER job: ${members.length} members fetched`);

  if (config.dryRun) {
    log.info("DRY_RUN: skipping import POST");
    return { membersImported: 0 };
  }

  const res = await fetch(
    `${config.origin}/api/admin/guild-roster/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: config.adminSecret,
        guildName: "Pizza Warriors",
        realm: "Lordaeron",
        members,
      }),
    }
  );

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) {
    const error =
      typeof data.error === "string" ? data.error : "Import rejected";
    log.error("ROSTER job: import failed:", error);
    return { membersImported: 0, error };
  }

  const count =
    typeof data.count === "number" ? data.count : members.length;
  log.info(`ROSTER job: imported ${count} members`);
  return { membersImported: count };
}
```

- [ ] **Step 2: Create `sync-agent/jobs/gear.ts`**

```typescript
// sync-agent/jobs/gear.ts
import { fetchCharacterGear } from "../warmane/character";
import { log } from "../logger";
import type { SyncConfig } from "../config";

export type GearJobResult = {
  synced: number;
  failed: number;
  skipped: number;
  error?: string;
};

type QueueEntry = { characterName: string; realm: string };

async function getGearQueue(config: SyncConfig): Promise<QueueEntry[]> {
  try {
    const res = await fetch(`${config.origin}/api/admin/armory-gear/missing`);
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, unknown>;
    if (!data.ok || !Array.isArray(data.players)) return [];
    return data.players as QueueEntry[];
  } catch {
    return [];
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runGearJob(
  config: SyncConfig
): Promise<GearJobResult> {
  log.info("GEAR job: fetching queue from Railway…");

  const queue = await getGearQueue(config);
  log.info(`GEAR job: ${queue.length} characters in queue`);

  if (queue.length === 0) return { synced: 0, failed: 0, skipped: 0 };

  if (config.dryRun) {
    log.info("DRY_RUN: skipping all imports");
    return { synced: 0, failed: 0, skipped: queue.length };
  }

  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    log.info(
      `GEAR job: fetching ${entry.characterName} (${entry.realm})…`
    );

    const gear = await fetchCharacterGear(entry.characterName, entry.realm, {
      enrich: true,
    });
    await sleep(config.requestDelayMs);

    if (!gear) {
      log.warn(`GEAR job: no gear returned for ${entry.characterName}`);
      failed++;
      continue;
    }

    const res = await fetch(
      `${config.origin}/api/admin/armory-gear/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: config.adminSecret,
          characterName: gear.characterName,
          realm: gear.realm,
          sourceUrl: gear.sourceUrl,
          items: gear.items,
        }),
      }
    );

    const data = (await res.json()) as Record<string, unknown>;
    if (data.ok) {
      log.info(
        `GEAR job: imported ${gear.characterName} (${gear.items.length} items)`
      );
      synced++;
    } else {
      log.warn(
        `GEAR job: import rejected for ${gear.characterName}: ${data.error}`
      );
      failed++;
    }
  }

  log.info(`GEAR job complete — ${synced} synced, ${failed} failed`);
  return { synced, failed, skipped: 0 };
}
```

- [ ] **Step 3: Verify bridge TypeScript compiles**

```bash
npx tsc --project tsconfig.sync.json --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add sync-agent/jobs/
git commit -m "feat: add roster and gear job handlers for bridge"
```

---

### Task 11: Bridge entry point — polling loop + self-scheduler

**Files:**
- Create: `sync-agent/index.ts`

- [ ] **Step 1: Create `sync-agent/index.ts`**

```typescript
// sync-agent/index.ts
import { loadConfig } from "./config";
import { log } from "./logger";
import { runRosterJob } from "./jobs/roster";
import { runGearJob } from "./jobs/gear";

type ClaimedJob = { id: string; type: "ROSTER" | "GEAR" };

const config = loadConfig();

log.info(`Bridge starting — agent: ${config.agentId}`);
log.info(`Origin: ${config.origin}`);
if (config.dryRun) log.warn("DRY_RUN mode enabled — no data will be imported");

async function claimPendingJob(): Promise<ClaimedJob | null> {
  try {
    const res = await fetch(`${config.origin}/api/admin/sync/pending`, {
      headers: {
        "x-admin-secret": config.adminSecret,
        "x-agent-id": config.agentId,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; job: ClaimedJob | null };
    return data.ok ? data.job : null;
  } catch {
    return null;
  }
}

async function completeJob(
  jobId: string,
  success: boolean,
  result: unknown,
  error?: string
): Promise<void> {
  try {
    await fetch(`${config.origin}/api/admin/sync/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": config.adminSecret,
      },
      body: JSON.stringify({ jobId, success, result, error }),
    });
  } catch {}
}

async function triggerJob(type: "ROSTER" | "GEAR"): Promise<ClaimedJob | null> {
  try {
    const res = await fetch(`${config.origin}/api/admin/sync/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = (await res.json()) as { ok: boolean; jobId?: string };
    if (!data.ok || !data.jobId) return null;
    // Immediately claim the job we just created
    return await claimPendingJob();
  } catch {
    return null;
  }
}

async function runJob(job: ClaimedJob): Promise<void> {
  log.info(`Running job: ${job.type} (${job.id})`);
  try {
    const result =
      job.type === "ROSTER"
        ? await runRosterJob(config)
        : await runGearJob(config);

    const success = !result.error;
    await completeJob(job.id, success, result, result.error);
    log.info(`Job ${job.id} ${success ? "completed" : "failed"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Job ${job.id} threw:`, message);
    await completeJob(job.id, false, null, message);
  }
}

// Poll for manual trigger jobs
async function pollLoop(): Promise<void> {
  try {
    const job = await claimPendingJob();
    if (job) await runJob(job);
  } catch (err) {
    log.error("Poll loop error:", err);
  }
}

// Self-scheduler: create + run scheduled jobs
let lastRosterRun = 0;
let lastGearRun = 0;

async function schedulerTick(): Promise<void> {
  const now = Date.now();

  if (now - lastRosterRun >= config.rosterIntervalMs) {
    lastRosterRun = now;
    log.info("Scheduled ROSTER sync starting…");
    const job = await triggerJob("ROSTER");
    if (job) await runJob(job);
  }

  if (now - lastGearRun >= config.gearIntervalMs) {
    lastGearRun = now;
    log.info("Scheduled GEAR sync starting…");
    const job = await triggerJob("GEAR");
    if (job) await runJob(job);
  }
}

// Startup: run initial syncs after a short delay to let Railway warm up
setTimeout(async () => {
  log.info("Running startup sync…");
  lastRosterRun = Date.now();
  lastGearRun = Date.now();
  const rosterJob = await triggerJob("ROSTER");
  if (rosterJob) await runJob(rosterJob);
}, 15_000);

// Poll for manual trigger jobs every pollIntervalMs
setInterval(pollLoop, config.pollIntervalMs);

// Check scheduler every minute
setInterval(schedulerTick, 60_000);

log.info(`Bridge running — poll: ${config.pollIntervalMs / 1000}s, roster: ${config.rosterIntervalMs / 3_600_000}h, gear: ${config.gearIntervalMs / 3_600_000}h`);
```

- [ ] **Step 2: Verify bridge compiles**

```bash
npx tsc --project tsconfig.sync.json --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Install ts-node if not present**

```bash
npm list ts-node || npm install -D ts-node
```

- [ ] **Step 4: Commit**

```bash
git add sync-agent/index.ts
git commit -m "feat: add bridge polling loop and self-scheduler entry point"
```

---

### Task 12: Scripts, package.json, env template, Task Scheduler

**Files:**
- Modify: `package.json`
- Create: `.env.sync-agent.example`
- Create: `scripts/setup-sync-scheduler.ps1`
- Modify: `.gitignore` (add `.env.sync-agent` and `.sync-agent-logs/`)

- [ ] **Step 1: Add scripts to `package.json`**

In the `"scripts"` section add:

```json
"sync:warmane": "ts-node --project tsconfig.sync.json sync-agent/index.ts",
"sync:warmane:dry": "cross-env DRY_RUN=true ts-node --project tsconfig.sync.json sync-agent/index.ts",
"test:sync": "vitest run"
```

Install `cross-env` if not present:

```bash
npm list cross-env || npm install -D cross-env
```

- [ ] **Step 2: Create `.env.sync-agent.example`**

```bash
# Copy this to .env.sync-agent and fill in your values.
# .env.sync-agent is gitignored — never commit it.

# Required
PIZZA_LOGS_ORIGIN=https://pizza-logs-production.up.railway.app
PIZZA_ADMIN_SECRET=your-admin-secret-here

# Optional — identifies this machine in the admin UI
SYNC_AGENT_ID=neil-desktop

# Optional tuning (defaults shown)
POLL_INTERVAL_MS=5000
ROSTER_INTERVAL_HOURS=6
GEAR_INTERVAL_HOURS=12
REQUEST_DELAY_MS=2500

# Set to true to fetch data but skip all imports (safe to test with)
DRY_RUN=false
```

- [ ] **Step 3: Add entries to `.gitignore`**

Append to `.gitignore`:

```
.env.sync-agent
.sync-agent-logs/
.sync-agent-dist/
```

- [ ] **Step 4: Create `scripts/setup-sync-scheduler.ps1`**

```powershell
# Pizza Logs — Warmane Sync Bridge Task Scheduler Setup
#
# Run from the Pizza Logs repo root directory:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-sync-scheduler.ps1
#
# The task starts on login and runs the bridge continuously in the background.
# Logs go to .sync-agent-logs\sync.log in the repo directory.

param(
    [string]$TaskName = "PizzaLogs-WarmaneSync"
)

$RepoDir = (Get-Location).Path
$NodeExe  = (Get-Command node -ErrorAction Stop).Source
$TsNode   = Join-Path $RepoDir "node_modules\.bin\ts-node.cmd"
$LogDir   = Join-Path $RepoDir ".sync-agent-logs"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

if (-not (Test-Path $TsNode)) {
    Write-Error "ts-node not found at $TsNode — run npm install first."
    exit 1
}

$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$TsNode`" --project tsconfig.sync.json sync-agent/index.ts >> `"$LogDir\sync.log`" 2>&1" `
    -WorkingDirectory $RepoDir

$Trigger = New-ScheduledTaskTrigger -AtLogon

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 2) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Pizza Logs Warmane sync bridge — polls Railway for sync jobs every 5s" `
    -Force

Write-Host ""
Write-Host "Task '$TaskName' registered successfully."
Write-Host ""
Write-Host "Commands:"
Write-Host "  Start now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop:       Stop-ScheduledTask  -TaskName '$TaskName'"
Write-Host "  Remove:     Unregister-ScheduledTask -TaskName '$TaskName'"
Write-Host "  View log:   Get-Content '$LogDir\sync.log' -Tail 50 -Wait"
```

- [ ] **Step 5: Copy env example and fill it in**

```bash
# On your desktop/laptop only (never commit .env.sync-agent)
cp .env.sync-agent.example .env.sync-agent
# Edit .env.sync-agent with your PIZZA_ADMIN_SECRET
```

- [ ] **Step 6: Test dry-run manually**

```bash
npm run sync:warmane:dry
```

Expected output (after ~15 s startup delay):
```
[...] [INFO] Bridge starting — agent: neil-desktop
[...] [INFO] Origin: https://pizza-logs-production.up.railway.app
[...] [WARN] DRY_RUN mode enabled — no data will be imported
[...] [INFO] Bridge running — poll: 5s, roster: 6h, gear: 12h
[...] [INFO] Running startup sync…
[...] [INFO] ROSTER job: fetching guild roster from Warmane…
[...] [INFO] ROSTER job: 40 members fetched
[...] [INFO] DRY_RUN: skipping import POST
```

- [ ] **Step 7: Run live (once verified dry-run works)**

```bash
npm run sync:warmane
```

Watch the admin page at `https://pizza-logs-production.up.railway.app/admin` — the "Warmane Auto-Sync" panel should show the in-progress indicator and then a success timestamp.

- [ ] **Step 8: Register Task Scheduler (run from repo root in PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-sync-scheduler.ps1
Start-ScheduledTask -TaskName "PizzaLogs-WarmaneSync"
```

- [ ] **Step 9: Commit everything**

```bash
git add package.json .env.sync-agent.example .gitignore scripts/setup-sync-scheduler.ps1
git commit -m "feat: add sync:warmane scripts, env template, and Task Scheduler setup"
git push origin main
```

---

## Rollout Checklist

After all tasks are complete, verify end-to-end:

- [ ] Admin page `/admin` shows "Warmane Auto-Sync" panel with two sync cards
- [ ] Clicking "Sync Roster" shows "queued" message; "ROSTER" job appears in `sync_jobs` table
- [ ] Bridge picks up the job within 5 s and logs fetching activity
- [ ] Job shows as completed in the admin panel with member count
- [ ] Clicking "Sync Gear" triggers gear queue fetch and per-character imports
- [ ] Gear cards on player pages show updated data after sync
- [ ] `DRY_RUN=true npm run sync:warmane:dry` runs without making any imports
- [ ] Task Scheduler entry exists and bridge starts automatically on Windows login
- [ ] `.env.sync-agent` is not tracked by git (`git status` shows it as untracked only)
