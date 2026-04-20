import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatBytes, formatDuration } from "@/lib/utils";
import { ClearDatabaseButton } from "./ClearDatabaseButton";

export const metadata: Metadata = { title: "Admin / Diagnostics" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [
    uploadsTotal,
    encountersTotal,
    playersTotal,
    milestonesTotal,
    recentErrors,
    recentUploads,
    topPlayers,
    parserHealth,
    bossCount,
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
    db.player.findMany({
      take:    10,
      include: { _count: { select: { participants: true } } },
    }).then(ps => ps.sort((a, b) => b._count.participants - a._count.participants).slice(0, 10)),
    fetch(`${process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"}/health`, {
      cache: "no-store",
    }).then(r => r.json()).catch(() => ({ status: "unreachable" })),
    db.boss.count(),
  ]);

  return (
    <div className="pt-10 space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            Admin / Diagnostics
          </h1>
          <p className="text-text-secondary text-sm mt-1">System health and database statistics</p>
        </div>
        <ClearDatabaseButton />
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Uploads"     value={uploadsTotal} />
        <StatCard label="Encounters"  value={encountersTotal} highlight />
        <StatCard label="Players"     value={playersTotal} />
        <StatCard label="Active Milestones" value={milestonesTotal} />
      </div>

      {/* Service health */}
      <section>
        <SectionHeader title="Service Health" />
        <div className="grid sm:grid-cols-3 gap-3">
          <ServiceCard
            name="Next.js App"
            status="ok"
            detail="Running"
          />
          <ServiceCard
            name="Python Parser"
            status={parserHealth.status === "ok" ? "ok" : "error"}
            detail={parserHealth.status === "ok" ? "Reachable" : "Unreachable"}
          />
          <ServiceCard
            name="Database"
            status="ok"
            detail={`${bossCount} bosses seeded`}
          />
        </div>
      </section>

      {/* Top active players */}
      <section>
        <SectionHeader title="Most Active Players" sub="By encounter count" />
        <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
          {topPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-text-dim text-sm w-5">{i + 1}</span>
                <span className="text-sm font-medium text-text-primary">{p.name}</span>
                {p.class && <span className="text-xs text-text-dim">{p.class}</span>}
              </div>
              <span className="text-sm tabular-nums text-text-secondary">
                {p._count.participants} encounters
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent upload timings */}
      {recentUploads.length > 0 && (
        <section>
          <SectionHeader title="Recent Upload Timings" sub="Parse duration per log" />
          <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
            {recentUploads.map(u => {
              const elapsedMs = u.parsedAt ? u.parsedAt.getTime() - u.createdAt.getTime() : null;
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
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Failed uploads */}
      {recentErrors.length > 0 && (
        <section>
          <SectionHeader title="Recent Failures" />
          <div className="bg-bg-panel border border-danger/20 rounded divide-y divide-gold-dim">
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

      {/* Parser env info */}
      <section>
        <SectionHeader title="Configuration" />
        <div className="bg-bg-panel border border-gold-dim rounded p-4 space-y-2 font-mono text-xs text-text-secondary">
          <div><span className="text-text-dim">PARSER_SERVICE_URL</span> = {process.env.PARSER_SERVICE_URL ?? "http://localhost:8000"}</div>
          <div><span className="text-text-dim">NODE_ENV</span>           = {process.env.NODE_ENV}</div>
          <div><span className="text-text-dim">UPLOAD_DIR</span>         = {process.env.UPLOAD_DIR ?? "./uploads"}</div>
        </div>
      </section>
    </div>
  );
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
    <div className="bg-bg-card border border-gold-dim rounded px-4 py-4">
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
