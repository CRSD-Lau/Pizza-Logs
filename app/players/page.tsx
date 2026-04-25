import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/EmptyState";
import { WOW_CLASSES } from "@/lib/constants/classes";
import { getClassColor } from "@/lib/constants/classes";
import { formatDps } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Players" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ class?: string }>;
}

export default async function PlayersPage({ searchParams }: Props) {
  const { class: classFilter } = await searchParams;

  // Class stats — always unfiltered, used for the visualization panel
  const allPlayersForStats = await db.player.findMany({
    select: {
      class:     true,
      milestones: {
        where:   { supersededAt: null, metric: "DPS" },
        orderBy: { value: "desc" },
        take:    1,
        select:  { value: true },
      },
    },
  });

  // Aggregate per class: player count + sum of best DPS (for avg)
  const classMap = new Map<string, { count: number; dpsTotal: number; dpsCount: number }>();
  for (const p of allPlayersForStats) {
    const cls = p.class ?? "Unknown";
    const entry = classMap.get(cls) ?? { count: 0, dpsTotal: 0, dpsCount: 0 };
    entry.count++;
    if (p.milestones[0]) {
      entry.dpsTotal += p.milestones[0].value;
      entry.dpsCount++;
    }
    classMap.set(cls, entry);
  }

  // Sort by player count desc for distribution bar
  const classStats = Array.from(classMap.entries())
    .filter(([cls]) => cls !== "Unknown")
    .sort((a, b) => b[1].count - a[1].count);

  const totalPlayersWithClass = classStats.reduce((s, [, v]) => s + v.count, 0);

  // Sort by avg DPS desc for the bar chart
  const classAvgDps = classStats
    .filter(([, v]) => v.dpsCount > 0)
    .map(([cls, v]) => ({ cls, avg: v.dpsTotal / v.dpsCount }))
    .sort((a, b) => b.avg - a.avg);

  const maxAvgDps = classAvgDps[0]?.avg ?? 1;

  const players = await db.player.findMany({
    where:   classFilter ? { class: classFilter } : undefined,
    orderBy: { name: "asc" },
    include: {
      realm:  { select: { name: true } },
      _count: { select: { participants: true } },
      milestones: {
        where:   { supersededAt: null },
        orderBy: { value: "desc" },
        take:    3,
        select:  { value: true, metric: true, rank: true, difficulty: true },
      },
    },
  });

  // Derive quick stats per player
  const enriched = players.map(p => {
    const dpsMilestone = p.milestones.find(m => m.metric === "DPS");
    const hpsMilestone = p.milestones.find(m => m.metric === "HPS");
    return {
      ...p,
      bestDps: dpsMilestone?.value ?? null,
      bestHps: hpsMilestone?.value ?? null,
      topRank: p.milestones.length > 0 ? Math.min(...p.milestones.map(m => m.rank)) : null,
    };
  });

  // Sort: milestones holders first, then by encounter count
  enriched.sort((a, b) => {
    if (a.topRank !== null && b.topRank === null) return -1;
    if (a.topRank === null && b.topRank !== null) return 1;
    if (a.topRank !== null && b.topRank !== null) return a.topRank - b.topRank;
    return b._count.participants - a._count.participants;
  });

  const totalCount = await db.player.count();

  return (
    <div className="pt-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Players</h1>
        <p className="text-text-secondary text-sm mt-1">
          {classFilter
            ? `${players.length} ${classFilter}${players.length !== 1 ? "s" : ""} · ${totalCount} total`
            : `${totalCount} players across all raids`}
        </p>
      </div>

      {/* Class stats */}
      {classStats.length > 0 && (
        <div className="bg-bg-panel border border-gold-dim rounded p-4 space-y-4">
          {/* Distribution bar */}
          <div>
            <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-2">
              Class Distribution
            </p>
            <div className="flex h-5 rounded overflow-hidden gap-px">
              {classStats.map(([cls, { count }]) => (
                <div
                  key={cls}
                  style={{
                    width:      `${(count / totalPlayersWithClass) * 100}%`,
                    background: getClassColor(cls),
                    opacity:    0.8,
                    minWidth:   count > 0 ? 2 : 0,
                  }}
                  title={`${cls}: ${count} player${count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {classStats.map(([cls, { count }]) => (
                <span key={cls} className="text-[11px] text-text-dim flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ background: getClassColor(cls) }}
                  />
                  {cls} <span className="text-text-secondary">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Avg best DPS by class */}
          {classAvgDps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-2">
                Avg Best DPS by Class
              </p>
              <div className="space-y-1.5">
                {classAvgDps.map(({ cls, avg }) => (
                  <div key={cls} className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold w-24 truncate shrink-0"
                      style={{ color: getClassColor(cls) }}
                    >
                      {cls}
                    </span>
                    <div className="flex-1 h-3 bg-bg-card rounded overflow-hidden">
                      <div
                        style={{
                          width:      `${(avg / maxAvgDps) * 100}%`,
                          background: getClassColor(cls),
                          opacity:    0.75,
                        }}
                        className="h-full rounded"
                      />
                    </div>
                    <span className="text-[11px] text-text-secondary tabular-nums w-16 text-right shrink-0">
                      {formatDps(avg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Class filter */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/players"
          className={cn(
            "px-3 py-1 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
            !classFilter
              ? "border-gold bg-gold/10 text-gold-light"
              : "border-gold-dim text-text-dim hover:border-gold/40 hover:text-text-secondary"
          )}
        >
          All
        </Link>
        {WOW_CLASSES.map(cls => {
          const color = getClassColor(cls);
          const active = classFilter === cls;
          return (
            <Link
              key={cls}
              href={`/players?class=${encodeURIComponent(cls)}`}
              className={cn(
                "px-3 py-1 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                active ? "opacity-100" : "opacity-60 hover:opacity-90"
              )}
              style={{
                color,
                borderColor: active ? color : `${color}44`,
                background:  active ? `${color}18` : "transparent",
              }}
            >
              {cls}
            </Link>
          );
        })}
      </div>

      {/* Player grid */}
      {enriched.length === 0 ? (
        <EmptyState
          title="No players found"
          description={classFilter ? `No ${classFilter}s recorded yet.` : "Upload a combat log to get started."}
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {enriched.map(p => {
            const color = getClassColor(p.class ?? p.name);
            return (
              <Link
                key={p.id}
                href={`/players/${encodeURIComponent(p.name)}`}
                className="bg-bg-panel border border-gold-dim rounded px-4 py-3 hover:border-gold/50 transition-colors group flex items-center gap-3"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-sm flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                >
                  {p.name.substring(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-semibold truncate group-hover:text-gold-light transition-colors"
                      style={{ color }}
                    >
                      {p.name}
                    </span>
                    {p.topRank === 1 && (
                      <span className="text-[10px] text-gold font-bold shrink-0">👑 #1</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-dim">
                    {p.class && <span>{p.class}</span>}
                    {p.realm && <span>· {p.realm.name}</span>}
                    <span>· {p._count.participants} pulls</span>
                  </div>
                  {/* Best DPS/HPS */}
                  {(p.bestDps !== null || p.bestHps !== null) && (
                    <div className="flex items-center gap-3 mt-1 text-[11px] tabular-nums">
                      {p.bestDps !== null && (
                        <span className="text-text-secondary">
                          <span className="text-text-dim">Best </span>
                          <span className="font-semibold text-text-primary">{formatDps(p.bestDps)}</span>
                          <span className="text-text-dim"> dps</span>
                        </span>
                      )}
                      {p.bestHps !== null && p.bestHps > 200 && (
                        <span className="text-text-secondary">
                          <span className="text-text-dim">Best </span>
                          <span className="font-semibold text-text-primary">{formatDps(p.bestHps)}</span>
                          <span className="text-text-dim"> hps</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
