import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatBytes } from "@/lib/utils";
import { getDeploymentInfo } from "@/lib/deployment-info";
import { ClearDatabaseButton } from "./ClearDatabaseButton";
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

export default async function AdminPage() {
  const deployment = getDeploymentInfo();
  const parserHealthPromise = fetch(`${process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"}/health`, {
    cache: "no-store",
  }).then(r => r.json() as Promise<ParserHealth>).catch(() => ({ status: "unreachable" }));

  let uploadsTotal = 0;
  let encountersTotal = 0;
  let playersTotal = 0;
  let milestonesTotal = 0;
  let recentErrors: RecentErrorRow[] = [];
  let recentUploads: RecentUploadRow[] = [];
  let topUploaders: TopUploaderRow[] = [];
  let bossCount = 0;
  let gearCacheTotal = 0;
  let recentGearErrors = 0;
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
      recentGearErrors,
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
      db.armoryGearCache.count({ where: { lastError: { not: null } } }),
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
    <div className="page-shell">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            Admin / Diagnostics
          </h1>
          <p className="text-text-secondary text-sm mt-1">System health and database statistics</p>
          <Link href="/admin/uploads" className="text-xs text-gold hover:text-gold-light uppercase tracking-wide mt-3 inline-block">
            View upload history &rarr;
          </Link>
        </div>
        <ClearDatabaseButton />
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
      <section>
        <SectionHeader title="Service Health" />
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
            detail={databaseAvailable ? `${bossCount} bosses seeded` : "Unavailable"}
          />
        </div>
      </section>

      {/* 2. Configuration */}
      <section>
        <SectionHeader title="Configuration" />
        <div className="bg-bg-panel border border-gold-dim rounded-sm p-4 space-y-2 font-mono text-xs text-text-secondary">
          <div><span className="text-text-dim">APP_VERSION</span>         = {deployment.version}</div>
          <div><span className="text-text-dim">DEPLOY_COMMIT</span>       = {deployment.commitShort ?? "local / unavailable"}</div>
          <div><span className="text-text-dim">DEPLOY_BRANCH</span>       = {deployment.branch ?? "local / unavailable"}</div>
          <div><span className="text-text-dim">DEPLOYMENT_ID</span>       = {deployment.deploymentId ?? "local / unavailable"}</div>
          <div><span className="text-text-dim">RAILWAY_ENVIRONMENT</span> = {deployment.environment}</div>
          <div><span className="text-text-dim">RAILWAY_SERVICE</span>     = {deployment.service ?? "local / unavailable"}</div>
          <div><span className="text-text-dim">PARSER_SERVICE_URL</span> = {process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"}</div>
          <div><span className="text-text-dim">NODE_ENV</span>           = {process.env.NODE_ENV}</div>
          <div><span className="text-text-dim">UPLOAD_DIR</span>         = {process.env.UPLOAD_DIR ?? "./uploads"}</div>
        </div>
      </section>

      {/* 3. Guild Roster */}
      <section>
        <SectionHeader title="Guild Roster" sub="First-party Warmane refresh for PizzaWarriors" />
        <GuildRosterSyncPanel
          rosterCount={rosterCount}
          latestSync={latestRosterSync?.lastSyncedAt ?? null}
        />
      </section>

      {/* 4. Warmane Gear Cache */}
      <section>
        <SectionHeader title="Warmane Gear Cache" sub="On-demand equipment snapshots for player quick looks" />
        <div className="bg-bg-panel border border-gold-dim rounded-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Cached Characters"    value={gearCacheTotal} />
            <StatCard label="Server Refresh Errors" value={recentGearErrors} />
          </div>
          <p className="text-sm text-text-secondary max-w-3xl">
            Class avatars fetch current equipment directly through Pizza Logs when a gear quick
            look opens. Healthy snapshots are cached for five minutes, and the last successful
            snapshot remains available if Warmane is temporarily unreachable. No browser helper,
            open Armory tab, or copied admin secret is part of this path.
          </p>
        </div>
      </section>

      {/* 5. Item Template (AzerothCore) */}
      <section>
        <SectionHeader title="Item Template (AzerothCore)" sub="Read-only import status for WoW item metadata" />
        <div className="bg-bg-panel border border-gold-dim rounded-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Items Imported" value={itemImportCount} />
            <StatCard
              label="Last Import"
              value={latestItemImport?.importedAt
                ? latestItemImport.importedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Never"}
            />
          </div>
          {itemImportCount === 0 && (
            <p className="text-sm text-text-secondary">
              No items imported yet. Run{" "}
              <code className="font-mono text-xs bg-bg-card border border-gold-dim rounded-sm px-1.5 py-0.5">
                npm run db:import-items
              </code>{" "}
              to populate.
            </p>
          )}
        </div>
      </section>

      {/* 6. Upload stats */}
      <section>
        <SectionHeader title="Upload Analytics" sub="Counts reset when upload data is cleared" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Uploads"           value={uploadsTotal} />
          <StatCard label="Encounters"        value={encountersTotal} highlight />
          <StatCard label="Players"           value={playersTotal} />
          <StatCard label="Active Milestones" value={milestonesTotal} />
        </div>
      </section>

      {/* 7. Top uploaders */}
      <section>
        <SectionHeader title="Most Active Uploaders" sub="By logs submitted" />
        <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
          {topUploaders.map((u, i) => (
            <div key={u.uploaderName} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-text-dim text-sm w-5">{i + 1}</span>
                <span className="text-sm font-medium text-text-primary">{u.uploaderName}</span>
              </div>
              <span className="text-sm tabular-nums text-text-secondary">
                {u._count.uploaderName} {u._count.uploaderName === 1 ? "upload" : "uploads"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Recent upload timings */}
      {recentUploads.length > 0 && (
        <section>
          <SectionHeader title="Recent Upload Timings" sub="Parse duration per log" />
          <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {recentUploads.map(u => {
              const elapsedMs  = u.parsedAt ? u.parsedAt.getTime() - u.createdAt.getTime() : null;
              const elapsedSec = elapsedMs ? Math.round(elapsedMs / 1000) : null;
              return (
                <div key={u.id} className="flex items-center justify-between px-4 py-2.5 gap-4 flex-wrap">
                  <div>
                    <span className="text-sm text-text-primary font-medium">{u.filename}</span>
                    <span className="text-xs text-text-dim ml-2">{formatBytes(u.fileSize)}</span>
                    {u.rawLineCount && (
                      <span className="text-xs text-text-dim ml-2">{u.rawLineCount.toLocaleString()} lines</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary">
                    {elapsedSec !== null && (
                      <span className="text-gold font-semibold">
                        {elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`}
                      </span>
                    )}
                    <span className="text-text-dim">
                      {u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <DeleteUploadButton uploadId={u.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 9. Failed uploads */}
      {recentErrors.length > 0 && (
        <section>
          <SectionHeader title="Recent Failures" />
          <div className="bg-bg-panel border border-danger/20 rounded-sm divide-y divide-gold-dim">
            {recentErrors.map(u => (
              <div key={u.id} className="px-4 py-3">
                <div className="text-sm text-text-primary font-medium">{u.filename}</div>
                <div className="text-xs text-danger mt-0.5">{u.errorMessage ?? "Unknown error"}</div>
                <div className="text-xs text-text-dim mt-0.5">
                  {new Date(u.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
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
