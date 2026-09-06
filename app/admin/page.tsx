import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { buttonVariants } from "@/components/ui/Button";
import { formatBytes, formatCountLabel, formatDateTimeUtc, formatDateUtc, formatInteger, formatSeconds } from "@/lib/utils";
import { getDeploymentInfo } from "@/lib/deployment-info";
import { readUpstreamText } from "@/lib/upstream-response";
import { ClearDatabaseButton } from "./ClearDatabaseButton";
import { ClearGearCacheButton } from "./ClearGearCacheButton";
import { DeleteUploadButton } from "./DeleteUploadButton";
import { GuildRosterSyncPanel } from "./GuildRosterSyncPanel";

export const metadata: Metadata = { title: "Admin / Diagnostics" };
export const dynamic = "force-dynamic";

type ParserHealth = { status?: string };
type RecentErrorRow = { id: string; filename: string; errorMessage: string | null; createdAt: Date };
type RecentUploadRow = {
  id: string;
  filename: string;
  fileSize: number;
  rawLineCount: number | null;
  createdAt: Date;
  parsedAt: Date | null;
};
type TopUploaderRow = { uploaderName: string | null; _count: { uploaderName: number } };
type LatestRosterSyncRow = { lastSyncedAt: Date } | null;
type LatestItemImportRow = { importedAt: Date | null } | null;
type LatestGearRefreshRow = { lastSuccessAt: Date | null } | null;

export default async function AdminPage() {
  await requireAdmin();
  const deployment = getDeploymentInfo();
  const parserHealthPromise = fetch(`${process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"}/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
    redirect: "error",
  }).then(async response => {
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Parser health unavailable");
    }
    const payload: unknown = JSON.parse(await readUpstreamText(response, 16 * 1024));
    if (!payload || typeof payload !== "object" || !("status" in payload)
        || typeof payload.status !== "string" || payload.status.length > 64) {
      throw new Error("Invalid parser health");
    }
    return { status: payload.status } satisfies ParserHealth;
  }).catch(() => ({ status: "unreachable" }));

  let uploadsTotal = 0;
  let encountersTotal = 0;
  let playersTotal = 0;
  let milestonesTotal = 0;
  let recentErrors: RecentErrorRow[] = [];
  let recentUploads: RecentUploadRow[] = [];
  let topUploaders: TopUploaderRow[] = [];
  let bossCount = 0;
  let gearCacheTotal = 0;
  let latestGearRefresh: LatestGearRefreshRow = null;
  let rosterCount = 0;
  let latestRosterSync: LatestRosterSyncRow = null;
  let itemImportCount = 0;
  let latestItemImport: LatestItemImportRow = null;
  let databaseAvailable = true;
  let databaseError: string | null = null;

  try {
    [
      uploadsTotal,
      encountersTotal,
      playersTotal,
      milestonesTotal,
      recentErrors,
      recentUploads,
      topUploaders,
      bossCount,
      gearCacheTotal,
      latestGearRefresh,
      rosterCount,
      latestRosterSync,
      itemImportCount,
      latestItemImport,
    ] = await Promise.all([
      db.upload.count(),
      db.encounter.count(),
      db.player.count(),
      db.milestone.count({ where: { supersededAt: null } }),
      db.upload.findMany({
        where:   { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take:    5,
        select:  { id: true, filename: true, errorMessage: true, createdAt: true },
      }),
      db.upload.findMany({
        where:   { status: "DONE", parsedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  { id: true, filename: true, fileSize: true, rawLineCount: true, createdAt: true, parsedAt: true },
      }),
      db.upload.groupBy({
        by:      ["uploaderName"],
        where:   { uploaderName: { not: null } },
        _count:  { uploaderName: true },
        orderBy: { _count: { uploaderName: "desc" } },
        take:    10,
      }),
      db.boss.count(),
      db.armoryGearCache.count(),
      db.armoryGearCache.findFirst({
        where: { lastSuccessAt: { not: null } },
        orderBy: { lastSuccessAt: "desc" },
        select: { lastSuccessAt: true },
      }),
      db.guildRosterMember.count(),
      db.guildRosterMember.findFirst({
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }),
      db.wowItem.count({ where: { importedAt: { not: null } } }),
      db.wowItem.findFirst({
        where:   { importedAt: { not: null } },
        orderBy: { importedAt: "desc" },
        select:  { importedAt: true },
      }),
    ]);
  } catch (error) {
    databaseAvailable = false;
    databaseError = formatAdminDatabaseError(error);
  }

  const parserHealth = await parserHealthPromise;

  return (
    <PageShell>
      <div className="space-y-4">
        <PageHeader title="Admin / Diagnostics" description="System health and database statistics" />
        <nav aria-label="Admin tools" className="flex flex-wrap items-center gap-2">
          <Link href="/admin/uploads" className={buttonVariants({ variant: "gold", size: "sm" })}>
            View upload history &rarr;
          </Link>
          <Link href="/admin/security" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Account security &rarr;
          </Link>
          <div className="w-full pt-2 sm:ml-auto sm:w-auto sm:pt-0"><ClearDatabaseButton /></div>
        </nav>
      </div>

      {!databaseAvailable && (
        <div className="bg-bg-panel border border-danger/30 rounded-sm px-4 py-3">
          <p className="text-sm font-semibold text-danger">Database unavailable</p>
          <p className="mt-1 text-sm text-text-secondary">
            Upload analytics are unavailable until the database connection is restored.
            {databaseError && <span className="block text-xs text-text-dim mt-1">{databaseError}</span>}
          </p>
        </div>
      )}

      {/* 1. Service Health */}
      <PageSection title="Service Health">
        <div className="grid sm:grid-cols-3 gap-3">
          <ServiceCard name="Next.js App"    status="ok"    detail="Running" />
          <ServiceCard
            name="Python Parser"
            status={parserHealth.status === "ok" ? "ok" : "error"}
            detail={parserHealth.status === "ok" ? "Reachable" : "Unreachable"}
          />
          <ServiceCard
            name="Database"
            status={databaseAvailable ? "ok" : "error"}
            detail={databaseAvailable ? `${formatCountLabel(bossCount, "boss", "bosses")} seeded` : "Unavailable"}
          />
        </div>
      </PageSection>

      {/* 2. Configuration */}
      <PageSection title="Configuration">
        <dl className="grid gap-x-6 gap-y-4 md:grid-cols-3">
          {[
            ["APP_VERSION", deployment.version],
            ["DEPLOY_COMMIT", deployment.commitShort ?? "local / unavailable"],
            ["DEPLOY_BRANCH", deployment.branch ?? "local / unavailable"],
            ["DEPLOYMENT_ID", deployment.deploymentId ?? "local / unavailable"],
            ["RAILWAY_ENVIRONMENT", deployment.environment],
            ["RAILWAY_SERVICE", deployment.service ?? "local / unavailable"],
            ["PARSER_SERVICE_URL", process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"],
            ["NODE_ENV", process.env.NODE_ENV],
            ["UPLOAD_DIR", process.env.UPLOAD_DIR ?? "./uploads"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold tracking-wide text-text-dim">{label}</dt>
              <dd className="mt-1 break-all font-mono text-sm text-text-secondary">{value}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      {/* 3. Guild Roster */}
      <PageSection title="Guild Roster" description="First-party Warmane refresh for PizzaWarriors">
        <GuildRosterSyncPanel
          rosterCount={databaseAvailable ? rosterCount : null}
          available={databaseAvailable}
          latestSync={latestRosterSync?.lastSyncedAt ?? null}
        />
      </PageSection>

      {/* 4. Warmane Gear Cache */}
      <PageSection title="Warmane Gear Cache" description="On-demand equipment snapshots for player quick looks">
        <div className="space-y-4">
          <StatGroup columns={2}>
            <StatCard label="Cached Snapshots" value={databaseAvailable ? gearCacheTotal : null} />
            <StatCard
              label="Latest Live Refresh"
              value={<span className="block text-base font-medium leading-relaxed">{!databaseAvailable ? "Unavailable" : latestGearRefresh?.lastSuccessAt
                ? formatDateTimeUtc(latestGearRefresh.lastSuccessAt) : "Never"}</span>}
            />
          </StatGroup>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-sm text-text-secondary max-w-3xl">
              Class avatars fetch current equipment directly through Pizza Logs when a gear quick
              look opens. Healthy snapshots are cached for five minutes, and the last successful
              snapshot remains available if Warmane is temporarily unreachable. No browser helper,
              open Armory tab, or copied admin secret is part of this path.
            </p>
            <ClearGearCacheButton />
          </div>
        </div>
      </PageSection>

      {/* 5. Item Template (AzerothCore) */}
      <PageSection title="Item Template (AzerothCore)" description="Read-only import status for WoW item metadata">
        <div className="space-y-4">
          <StatGroup columns={2}>
            <StatCard label="Items Imported" value={databaseAvailable ? itemImportCount : null} />
            <StatCard
              label="Last Import"
              value={<span className="block text-base font-medium leading-relaxed">{!databaseAvailable ? "Unavailable" : latestItemImport?.importedAt
                ? formatDateUtc(latestItemImport.importedAt) : "Never"}</span>}
            />
          </StatGroup>
          {databaseAvailable && itemImportCount === 0 && (
            <p className="text-sm text-text-secondary">
              No items imported yet. Run{" "}
              <code className="font-mono text-xs bg-bg-card border border-gold-dim rounded-sm px-1.5 py-0.5">
                npm run db:import-items
              </code>{" "}
              to populate.
            </p>
          )}
        </div>
      </PageSection>

      {/* 6. Upload stats */}
      <PageSection title="Upload Analytics" description="Counts reset when upload data is cleared">
        <StatGroup columns={4}>
          <StatCard label="Uploads"           value={databaseAvailable ? uploadsTotal : null} />
          <StatCard label="Encounters"        value={databaseAvailable ? encountersTotal : null} highlight />
          <StatCard label="Players"           value={databaseAvailable ? playersTotal : null} />
          <StatCard label="Active Milestones" value={databaseAvailable ? milestonesTotal : null} />
        </StatGroup>
      </PageSection>

      {/* 7. Top uploaders */}
      <PageSection title="Most Active Uploaders" description="Top 10 by uploads submitted; unnamed uploads excluded">
        {topUploaders.length === 0 ? (
          <p className="text-sm text-text-secondary">{databaseAvailable ? "No named uploads yet." : "Uploader statistics are unavailable."}</p>
        ) : (
          <ol role="list" aria-label="Most active uploaders" className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {topUploaders.map((u, i) => (
              <li key={u.uploaderName} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-text-dim text-sm shrink-0 tabular-nums"><span className="sr-only">Position </span><span aria-hidden="true">#</span>{formatInteger(i + 1)}</span>
                  <span className="break-words text-sm font-medium text-text-primary">{u.uploaderName}</span>
                </div>
                <span className="shrink-0 text-right text-sm tabular-nums text-text-secondary">
                  {formatCountLabel(u._count.uploaderName, "upload")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </PageSection>

      {/* 8. Recent upload timings */}
      {recentUploads.length > 0 && (
        <PageSection title="Recent Upload Timings" description="Latest 10 completed uploads · Time from upload creation to parse completion">
          <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {recentUploads.map(u => {
              const elapsedMs  = u.parsedAt ? u.parsedAt.getTime() - u.createdAt.getTime() : null;
              const elapsedSec = elapsedMs !== null ? elapsedMs / 1000 : null;
              return (
                <div key={u.id} className="flex items-center justify-between px-4 py-2.5 gap-4 flex-wrap">
                  <div className="min-w-0 break-all">
                    <span className="text-sm text-text-primary font-medium">{u.filename}</span>
                    <span className="text-xs text-text-dim ml-2">{formatBytes(u.fileSize)}</span>
                    {u.rawLineCount != null && (
                      <span className="text-xs text-text-dim ml-2">{formatCountLabel(u.rawLineCount, "line")}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm tabular-nums text-text-secondary">
                    {elapsedSec !== null && (
                      <span className="text-gold font-semibold">
                        {formatSeconds(elapsedSec)}
                      </span>
                    )}
                    <span className="text-text-dim">
                      {formatDateTimeUtc(u.createdAt)}
                    </span>
                    <DeleteUploadButton uploadId={u.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </PageSection>
      )}

      {/* 9. Failed uploads */}
      {recentErrors.length > 0 && (
        <PageSection title="Recent Failures" description="Latest 5 failed uploads">
          <div className="bg-bg-panel border border-danger/20 rounded-sm divide-y divide-gold-dim">
            {recentErrors.map(u => (
              <div key={u.id} className="break-words px-4 py-3">
                <div className="text-sm text-text-primary font-medium">{u.filename}</div>
                <div className="text-xs text-danger mt-0.5">{u.errorMessage ?? "Unknown error"}</div>
                <div className="text-xs text-text-dim mt-0.5">
                  {formatDateTimeUtc(u.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      )}
    </PageShell>
  );
}

function formatAdminDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

function ServiceCard({
  name,
  status,
  detail,
}: {
  name:   string;
  status: "ok" | "error" | "warn";
  detail: string;
}) {
  return (
    <div className="bg-bg-card border border-gold-dim rounded-sm px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${
          status === "ok" ? "bg-success" : status === "warn" ? "bg-warning" : "bg-danger"
        }`} />
        <span className="text-sm font-semibold text-text-primary">{name}</span>
      </div>
      <div className="text-xs text-text-secondary">{detail}</div>
    </div>
  );
}
