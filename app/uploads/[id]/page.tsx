import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { formatBytes, formatDuration, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const upload = await db.upload.findUnique({ where: { id }, select: { filename: true } });
  return { title: upload ? `Upload: ${upload.filename}` : "Upload" };
}

export default async function UploadDetailPage({ params }: Props) {
  const { id } = await params;

  const upload = await db.upload.findUnique({
    where: { id },
    include: {
      realm:    { select: { name: true, host: true } },
      guild:    { select: { name: true } },
      encounters: {
        orderBy: { startedAt: "asc" },
        select: {
          id:           true,
          sessionIndex: true,
          outcome:      true,
          difficulty:   true,
          durationSeconds: true,
          totalDamage:  true,
          startedAt:    true,
          endedAt:      true,
          boss: { select: { name: true, slug: true, raid: true } },
        },
      },
    },
  });

  if (!upload) notFound();

  // ── Group encounters into sessions ────────────────────────────────
  const sessionMap = new Map<number, typeof upload.encounters>();
  for (const enc of upload.encounters) {
    const arr = sessionMap.get(enc.sessionIndex) ?? [];
    arr.push(enc);
    sessionMap.set(enc.sessionIndex, arr);
  }
  const sessions = Array.from(sessionMap.entries()).sort((a, b) => a[0] - b[0]);

  const totalKills  = upload.encounters.filter(e => e.outcome === "KILL").length;
  const totalWipes  = upload.encounters.filter(e => e.outcome === "WIPE").length;
  const totalDmg    = upload.encounters.reduce((s, e) => s + e.totalDamage, 0);
  const totalSecs   = upload.encounters.reduce((s, e) => s + e.durationSeconds, 0);

  return (
    <div className="pt-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-text-dim">
        <Link href="/uploads" className="hover:text-gold">Upload History</Link>
        <span className="mx-2">›</span>
        <span className="text-text-secondary truncate">{upload.filename}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            {upload.filename}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-text-dim">
            <span>{upload.realm?.name ?? "Unknown realm"}</span>
            {upload.realm?.host && <span>· {upload.realm.host}</span>}
            {upload.guild?.name && <span>· {upload.guild.name}</span>}
            <span>· {formatBytes(upload.fileSize)}</span>
            {upload.rawLineCount && <span>· {upload.rawLineCount.toLocaleString()} lines</span>}
            <Badge variant={upload.status === "DONE" ? "kill" : upload.status === "FAILED" ? "wipe" : "gold"}>
              {upload.status}
            </Badge>
          </div>
        </div>
        <div className="text-xs text-text-dim text-right">
          {new Date(upload.createdAt).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </div>
      </div>

      {/* File-level stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Sessions"     value={String(sessions.length)} highlight />
        <StatCard label="Kills / Wipes" value={`${totalKills} / ${totalWipes}`} />
        <StatCard label="Total Damage"  value={formatNumber(totalDmg)} />
        <StatCard label="Active Time"   value={formatDuration(totalSecs)} sub="sum of all pulls" />
      </div>

      {/* Session cards */}
      {sessions.length === 0 ? (
        <p className="text-text-dim text-sm">No encounters found in this upload.</p>
      ) : (
        <section className="space-y-4">
          <SectionHeader
            title={sessions.length === 1 ? "Raid Session" : "Raid Sessions"}
            sub={`${sessions.length} session${sessions.length !== 1 ? "s" : ""} detected in this log`}
          />
          {sessions.map(([sessionIdx, encs]) => {
            const kills   = encs.filter(e => e.outcome === "KILL").length;
            const wipes   = encs.filter(e => e.outcome === "WIPE").length;
            const dmg     = encs.reduce((s, e) => s + e.totalDamage, 0);
            const secs    = encs.reduce((s, e) => s + e.durationSeconds, 0);
            const start   = encs[0]?.startedAt;
            const end     = encs[encs.length - 1]?.endedAt;
            const raids   = [...new Set(encs.map(e => e.boss.raid))];

            return (
              <Link
                key={sessionIdx}
                href={`/uploads/${id}/sessions/${sessionIdx}`}
                className="block bg-bg-panel border border-gold-dim rounded p-5 hover:border-gold transition-colors group space-y-4"
              >
                {/* Session header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="heading-cinzel text-base font-bold text-gold-light group-hover:text-gold transition-colors">
                        {sessions.length === 1 ? "Raid Session" : `Session ${sessionIdx + 1}`}
                      </span>
                      {raids.map(r => (
                        <span key={r} className="text-[11px] text-text-dim bg-bg-card border border-gold-dim rounded px-1.5 py-0.5">
                          {r}
                        </span>
                      ))}
                    </div>
                    {start && (
                      <div className="text-xs text-text-dim mt-1">
                        {new Date(start).toLocaleString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {end && ` → ${new Date(end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gold group-hover:text-gold-light transition-colors">
                    View session →
                  </span>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-bg-card rounded p-2 text-center">
                    <div className="text-text-dim uppercase tracking-wide text-[10px]">Pulls</div>
                    <div className="font-semibold mt-0.5">
                      <span className="text-success">{kills}K</span>
                      {" / "}
                      <span className="text-danger">{wipes}W</span>
                    </div>
                  </div>
                  <div className="bg-bg-card rounded p-2 text-center">
                    <div className="text-text-dim uppercase tracking-wide text-[10px]">Damage</div>
                    <div className="font-semibold mt-0.5 text-text-primary">{formatNumber(dmg)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2 text-center">
                    <div className="text-text-dim uppercase tracking-wide text-[10px]">Active</div>
                    <div className="font-semibold mt-0.5 text-text-primary">{formatDuration(secs)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2 text-center">
                    <div className="text-text-dim uppercase tracking-wide text-[10px]">Bosses</div>
                    <div className="font-semibold mt-0.5 text-text-primary">{encs.length} pulls</div>
                  </div>
                </div>

                {/* Encounter pills */}
                <div className="flex flex-wrap gap-1">
                  {encs.map(enc => (
                    <span
                      key={enc.id}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-sm border",
                        enc.outcome === "KILL"
                          ? "bg-success/8 border-success/25 text-success"
                          : "bg-danger/8 border-danger/20 text-danger"
                      )}
                    >
                      {enc.boss.name.split(" ").slice(-1)[0]} {enc.difficulty}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
