import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber, formatDps, formatDuration } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ playerName: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { playerName } = await params;
  return { title: decodeURIComponent(playerName) };
}

export default async function PlayerPage({ params }: Props) {
  const { playerName } = await params;
  const name = decodeURIComponent(playerName);

  const player = await db.player.findFirst({
    where: { name },
    include: {
      realm: { select: { name: true } },
      milestones: {
        where:   { supersededAt: null },
        orderBy: [{ rank: "asc" }, { metric: "asc" }],
        include: {
          encounter: { include: { boss: { select: { name: true, slug: true } } } },
        },
      },
    },
  });

  if (!player) notFound();

  const participants = await db.participant.findMany({
    where: { playerId: player.id },
    orderBy: { encounter: { startedAt: "desc" } },
    take: 50,
    include: {
      encounter: {
        include: { boss: { select: { name: true, slug: true, raid: true } } },
      },
    },
  });

  const kills       = participants.filter(p => p.encounter.outcome === "KILL");
  const wipes       = participants.filter(p => p.encounter.outcome === "WIPE");
  const totalDamage = participants.reduce((a, p) => a + p.totalDamage, 0);
  const totalDeaths = participants.reduce((a, p) => a + p.deaths, 0);
  const avgDps      = kills.length > 0
    ? kills.reduce((a, p) => a + p.dps, 0) / kills.length : 0;
  const bestDps     = Math.max(0, ...participants.map(p => p.dps));

  const color = getClassColor(player.class ?? name);

  // Group by boss for per-boss bests
  const perBoss = participants.reduce<Record<string, {
    bossName: string; bossSlug: string; kills: number; bestDps: number; bestHps: number;
  }>>((acc, p) => {
    const k = p.encounter.boss.slug;
    if (!acc[k]) acc[k] = { bossName: p.encounter.boss.name, bossSlug: k, kills: 0, bestDps: 0, bestHps: 0 };
    if (p.encounter.outcome === "KILL") acc[k].kills++;
    if (p.dps > acc[k].bestDps) acc[k].bestDps = p.dps;
    if (p.hps > acc[k].bestHps) acc[k].bestHps = p.hps;
    return acc;
  }, {});

  return (
    <div className="pt-10 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-sm flex items-center justify-center text-lg font-bold"
          style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
        >
          {name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h1
            className="heading-cinzel text-2xl font-bold text-glow-gold"
            style={{ color }}
          >
            {name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {player.class && <span className="text-sm text-text-secondary">{player.class}</span>}
            {player.realm && <span className="text-xs text-text-dim">{player.realm.name}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Encounters" value={participants.length} />
        <StatCard label="Kills"      value={kills.length} highlight />
        <StatCard label="Best DPS"   value={formatDps(bestDps)} sub="single encounter" />
        <StatCard label="Avg DPS"    value={formatDps(avgDps)} sub="on kills" />
      </div>

      {/* Milestones */}
      {player.milestones.length > 0 && (
        <section>
          <SectionHeader title="All-Time Records" sub="Current rankings, kills only" />
          <div className="grid sm:grid-cols-2 gap-2">
            {player.milestones.map(m => (
              <div key={m.id} className="milestone-banner flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rank-badge",
                    m.rank === 1 && "rank-1",
                    m.rank === 2 && "rank-2",
                    m.rank === 3 && "rank-3",
                  )}>
                    #{m.rank}
                  </span>
                  <div>
                    <Link href={`/bosses/${m.encounter.boss.slug}`} className="hover:text-gold">
                      {m.encounter.boss.name}
                    </Link>
                    <span className={cn(
                      "ml-1 diff-badge",
                      m.difficulty?.endsWith("H") ? "heroic" : "normal"
                    )}>
                      {m.difficulty}
                    </span>
                  </div>
                </div>
                <span className="tabular-nums font-bold text-gold-light">
                  {m.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {m.metric}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-boss bests */}
      {Object.values(perBoss).length > 0 && (
        <section>
          <SectionHeader title="Per-Boss Summary" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.values(perBoss)
              .sort((a, b) => b.bestDps - a.bestDps)
              .map(b => (
                <Link
                  key={b.bossSlug}
                  href={`/bosses/${b.bossSlug}`}
                  className="bg-bg-card border border-gold-dim rounded px-4 py-3 hover:border-gold/40 transition-colors block"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-text-primary">{b.bossName}</span>
                    <span className="text-xs text-success font-bold">{b.kills} kills</span>
                  </div>
                  {b.bestDps > 0 && (
                    <div className="text-xs text-text-secondary">
                      Best DPS: <span className="font-bold text-text-primary tabular-nums">{formatDps(b.bestDps)}</span>
                    </div>
                  )}
                  {b.bestHps > 100 && (
                    <div className="text-xs text-text-secondary">
                      Best HPS: <span className="font-bold text-text-primary tabular-nums">{formatDps(b.bestHps)}</span>
                    </div>
                  )}
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Recent encounters */}
      <section>
        <SectionHeader title="Recent Encounters" sub={`Last ${participants.length} encounters`} />
        {participants.length > 0 ? (
          <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
            {participants.slice(0, 20).map(p => (
              <Link
                key={p.id}
                href={`/encounters/${p.encounter.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={p.encounter.outcome === "KILL" ? "outcome-kill" : "outcome-wipe"}>
                    {p.encounter.outcome}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{p.encounter.boss.name}</span>
                  <span className={cn("diff-badge", p.encounter.difficulty.endsWith("H") ? "heroic" : "normal")}>
                    {p.encounter.difficulty}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm tabular-nums text-text-secondary">
                  {p.dps > 0 && <span>{formatDps(p.dps)} dps</span>}
                  {p.hps > 100 && <span>{formatDps(p.hps)} hps</span>}
                  {p.deaths > 0 && <span className="text-danger">☠{p.deaths}</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No encounters recorded" />
        )}
      </section>
    </div>
  );
}
