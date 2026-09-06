import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { NumericValue } from "@/components/ui/NumericValue";
import {
  buildRaidSessionRoutesWithAnalytics,
  formatRaidSessionTitle,
  getRaidSessionPath,
} from "@/lib/raid-session-slug";
import { cn, formatBytes, formatCountLabel, formatDateTimeRangeUtc, formatDateTimeUtc, formatDuration, formatInteger, formatNumber, getRecordedDurationSeconds } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

function sumRecordedDurationSeconds(encounters: readonly Parameters<typeof getRecordedDurationSeconds>[0][]): number | null {
  let total = 0;
  for (const encounter of encounters) {
    const duration = getRecordedDurationSeconds(encounter);
    if (duration === null) return null;
    total += duration;
  }
  return total;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const { id } = await params;
  const upload = await db.upload.findUnique({ where: { id }, select: { filename: true } });
  return { title: upload ? `Admin Upload: ${upload.filename}` : "Admin Upload" };
}

export default async function AdminUploadDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const upload = await db.upload.findUnique({
    where: { id },
    include: {
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          sessionIndex: true,
          outcome: true,
          difficulty: true,
          durationSeconds: true,
          durationMs: true,
          totalDamage: true,
          startedAt: true,
          endedAt: true,
          boss: { select: { name: true, slug: true, raid: true } },
        },
      },
    },
  });

  if (!upload) notFound();

  const routeBySessionIndex = new Map(
    buildRaidSessionRoutesWithAnalytics(
      upload.encounters.map(encounter => ({
        sessionIndex: encounter.sessionIndex,
        startedAt: encounter.startedAt,
      })),
      upload.sessionAnalytics,
    ).map(route => [route.sessionIndex, route]),
  );

  const sessionMap = new Map<number, typeof upload.encounters>();
  for (const enc of upload.encounters) {
    const arr = sessionMap.get(enc.sessionIndex) ?? [];
    arr.push(enc);
    sessionMap.set(enc.sessionIndex, arr);
  }
  const sessions = Array.from(sessionMap.entries()).sort((a, b) => a[0] - b[0]);

  const totalKills = upload.encounters.filter(e => e.outcome === "KILL").length;
  const totalWipes = upload.encounters.filter(e => e.outcome === "WIPE").length;
  const totalDmg = upload.encounters.reduce((sum, e) => sum + e.totalDamage, 0);
  const totalSecs = sumRecordedDurationSeconds(upload.encounters);

  return (
    <PageShell>
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-text-dim">
          <Link href="/admin" className="inline-flex min-h-11 items-center hover:text-gold">Admin</Link>
          <span aria-hidden="true">/</span>
          <Link href="/admin/uploads" className="inline-flex min-h-11 items-center hover:text-gold">Upload History</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-text-secondary break-all">{upload.filename}</span>
        </nav>

        <PageHeader
          title={<span className="break-all">{upload.filename}</span>}
          description={
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span>{upload.realm?.name ?? "Unknown realm"}</span>
              {upload.realm?.host && <span>- {upload.realm.host}</span>}
              {upload.guild?.name && <span>- {upload.guild.name}</span>}
              <span>- {formatBytes(upload.fileSize)}</span>
              {upload.rawLineCount != null && <span>- {formatCountLabel(upload.rawLineCount, "line")}</span>}
              <Badge variant={upload.status === "DONE" ? "kill" : upload.status === "FAILED" ? "wipe" : "gold"}>
                {upload.status}
              </Badge>
            </div>
          }
          actions={<p className="text-sm text-text-dim">{formatDateTimeUtc(upload.createdAt)}</p>}
        />
      </div>

      <StatGroup columns={4}>
        <StatCard label="Raids" value={formatInteger(sessions.length)} highlight />
        <StatCard label="Outcomes" value={`${formatCountLabel(totalKills, "kill")} / ${formatCountLabel(totalWipes, "wipe")}`} sub="all recorded attempts" />
        <StatCard label="Total Damage" value={formatNumber(totalDmg)} />
        <StatCard label="Active Time" value={totalSecs === null ? <NumericValue value={null} /> : formatDuration(totalSecs)} sub={totalSecs === null ? "One or more pull durations unavailable" : "sum of all recorded pulls"} />
      </StatGroup>

      {sessions.length === 0 ? (
        <p className="text-text-dim text-sm">No encounters found in this upload.</p>
      ) : (
        <PageSection
          title={sessions.length === 1 ? "Raid" : "Raids"}
          description={`${formatCountLabel(sessions.length, "raid")} detected in this log`}
        >
          <div className="divide-y divide-gold-dim">
            {sessions.map(([sessionIdx, encs]) => {
              const route = routeBySessionIndex.get(sessionIdx);
              const kills = encs.filter(e => e.outcome === "KILL").length;
              const wipes = encs.filter(e => e.outcome === "WIPE").length;
              const dmg = encs.reduce((sum, e) => sum + e.totalDamage, 0);
              const secs = sumRecordedDurationSeconds(encs);
              const start = encs[0]?.startedAt;
              const end = encs[encs.length - 1]?.endedAt;
              const raids = [...new Set(encs.map(e => e.boss.raid))];

              return (
                <article key={sessionIdx} className="space-y-4 py-5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="heading-cinzel text-base font-bold text-gold-light">
                          {route ? formatRaidSessionTitle(route) : "Raid"}
                        </h3>
                        {raids.map((r) => (
                          <span key={r} className="text-xs text-text-dim bg-bg-card border border-gold-dim rounded-sm px-1.5 py-0.5">
                            {r}
                          </span>
                        ))}
                      </div>
                      {start && (
                        <div className="text-sm text-text-dim mt-1">
                          {end ? formatDateTimeRangeUtc(start, end) : formatDateTimeUtc(start)}
                        </div>
                      )}
                    </div>

                    {route && (
                      <Link
                        href={getRaidSessionPath(upload.publicSlug, route)}
                        className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light transition-colors"
                      >
                        Open public raid view &rarr;
                      </Link>
                    )}
                  </div>

                  <StatGroup columns={4}>
                    <StatCard label="Outcomes" value={
                      <span className="block text-base font-semibold">
                        <span className="text-success">{formatCountLabel(kills, "kill")}</span>
                        {" / "}
                        <span className="text-danger">{formatCountLabel(wipes, "wipe")}</span>
                      </span>
                    } />
                    <StatCard label="Damage" value={<span className="block text-base font-semibold">{formatNumber(dmg)}</span>} />
                    <StatCard label="Active Time" value={<span className="block text-base font-semibold">{secs === null ? <NumericValue value={null} /> : formatDuration(secs)}</span>} sub={secs === null ? "One or more pull durations unavailable" : "sum of all recorded pulls"} />
                    <StatCard label="Pulls" value={<span className="block text-base font-semibold">{formatInteger(encs.length)}</span>} />
                  </StatGroup>

                  <div className="flex flex-wrap gap-1">
                    {encs.map((enc) => (
                      <span
                        key={enc.id}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-xs border",
                          enc.outcome === "KILL"
                            ? "bg-success/8 border-success/25 text-success"
                            : "bg-danger/8 border-danger/20 text-danger"
                        )}
                      >
                        {enc.boss.name} · {enc.difficulty} · {enc.outcome}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </PageSection>
      )}
    </PageShell>
  );
}
