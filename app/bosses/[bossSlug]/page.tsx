import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration, formatNumber } from "@/lib/utils";

interface Props { params: Promise<{ bossSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bossSlug } = await params;
  const boss = await db.boss.findUnique({ where: { slug: bossSlug } });
  return { title: boss?.name ?? "Boss" };
}

async function getBossData(slug: string) {
  const boss = await db.boss.findUnique({
    where: { slug },
    include: {
      encounters: {
        orderBy: { startedAt: "desc" },
        include: {
          participants: {
            orderBy: { dps: "desc" },
            take: 1,
            include: { player: { select: { name: true, class: true } } },
          },
        },
      },
    },
  });
  if (!boss) return null;

  // All-time DPS leaderboard (kills only)
  const dpsLeaders = await db.participant.findMany({
    where: { encounter: { bossId: boss.id, outcome: "KILL" }, dps: { gt: 0 } },
    orderBy: { dps: "desc" },
    take: 25,
    distinct: ["playerId"],
    include: {
      player: { select: { name: true, class: true } },
      encounter: {
        select: { id: true, difficulty: true, durationSeconds: true, startedAt: true,
          boss: { select: { name: true, slug: true } } },
      },
    },
  });

  // All-time HPS leaderboard
  const hpsLeaders = await db.participant.findMany({
    where: { encounter: { bossId: boss.id, outcome: "KILL" }, hps: { gt: 100 } },
    orderBy: { hps: "desc" },
    take: 25,
    distinct: ["playerId"],
    include: {
      player: { select: { name: true, class: true } },
      encounter: {
        select: { id: true, difficulty: true, durationSeconds: true, startedAt: true,
          boss: { select: { name: true, slug: true } } },
      },
    },
  });

  return { boss, dpsLeaders, hpsLeaders };
}

export default async function BossPage({ params }: Props) {
  const { bossSlug } = await params;
  const data = await getBossData(bossSlug);
  if (!data) notFound();

  const { boss, dpsLeaders, hpsLeaders } = data;

  const kills = boss.encounters.filter(e => e.outcome === "KILL");
  const wipes = boss.encounters.filter(e => e.outcome === "WIPE");
  const fastestKill = kills.reduce<number | null>(
    (m, e) => m === null ? e.durationSeconds : Math.min(m, e.durationSeconds), null
  );

  const DIFFICULTIES = ["10N", "25N", "10H", "25H"];
  const killsByDiff = DIFFICULTIES.reduce<Record<string, number>>((acc, d) => {
    acc[d] = kills.filter(e => e.difficulty === d).length;
    return acc;
  }, {});

  return (
    <div className="pt-10 space-y-10">
      {/* Breadcrumb */}
      <div className="text-xs text-text-dim">
        <Link href="/bosses" className="hover:text-gold">Bosses</Link>
        <span className="mx-2">›</span>
        <span>{boss.raid}</span>
        <span className="mx-2">›</span>
        <span className="text-text-secondary">{boss.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="heading-cinzel text-3xl font-bold text-gold-light text-glow-gold">{boss.name}</h1>
        <p className="text-text-secondary text-sm mt-1">{boss.raid}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Kills"    value={kills.length} highlight />
        <StatCard label="Total Wipes"    value={wipes.length} />
        <StatCard label="Fastest Kill"   value={fastestKill !== null ? formatDuration(fastestKill) : "—"} />
        <StatCard label="Total Pulls"    value={boss.encounters.length} />
      </div>

      {/* Kill counts by difficulty */}
      {boss.encounters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.filter(d => killsByDiff[d] > 0 || boss.encounters.some(e => e.difficulty === d)).map(d => (
            <div key={d} className="bg-bg-card border border-gold-dim rounded px-4 py-2 text-center">
              <div className={`diff-badge mb-1 ${d.endsWith("H") ? "heroic" : "normal"}`}>{d}</div>
              <div className="text-xl font-bold text-text-primary tabular-nums">{killsByDiff[d] ?? 0}</div>
              <div className="text-[10px] text-text-dim">kills</div>
            </div>
          ))}
        </div>
      )}

      {/* DPS Leaderboard */}
      <section>
        <SectionHeader title="All-Time DPS Leaderboard" sub="Best single-encounter DPS on kills" />
        {dpsLeaders.length > 0 ? (
          <LeaderboardBar
            metric="dps"
            entries={dpsLeaders.map((p, i) => ({
              rank:        i + 1,
              playerName:  p.player.name,
              class:       p.player.class,
              value:       p.dps,
              bossName:    p.encounter.boss.name,
              bossSlug:    p.encounter.boss.slug,
              difficulty:  p.encounter.difficulty,
              encounterId: p.encounter.id,
              date:        p.encounter.startedAt.toISOString(),
            }))}
          />
        ) : (
          <EmptyState title="No kill data yet" description="Upload a log with a kill of this boss to start the leaderboard." />
        )}
      </section>

      {/* HPS Leaderboard */}
      {hpsLeaders.length > 0 && (
        <section>
          <SectionHeader title="All-Time HPS Leaderboard" sub="Best single-encounter HPS on kills" />
          <LeaderboardBar
            metric="hps"
            entries={hpsLeaders.map((p, i) => ({
              rank:        i + 1,
              playerName:  p.player.name,
              class:       p.player.class,
              value:       p.hps,
              bossName:    p.encounter.boss.name,
              bossSlug:    p.encounter.boss.slug,
              difficulty:  p.encounter.difficulty,
              encounterId: p.encounter.id,
              date:        p.encounter.startedAt.toISOString(),
            }))}
          />
        </section>
      )}

      {/* Recent encounters */}
      <section>
        <SectionHeader
          title="Recent Encounters"
          sub={`${boss.encounters.length} total pulls`}
        />
        {boss.encounters.length > 0 ? (
          <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
            {boss.encounters.slice(0, 20).map(enc => {
              const top = enc.participants[0];
              return (
                <Link
                  key={enc.id}
                  href={`/encounters/${enc.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={enc.outcome === "KILL" ? "outcome-kill" : enc.outcome === "WIPE" ? "outcome-wipe" : "outcome-unknown"}>
                      {enc.outcome}
                    </span>
                    <span className={`diff-badge ${enc.difficulty.endsWith("H") ? "heroic" : "normal"}`}>
                      {enc.difficulty}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {formatDuration(enc.durationSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-dim">
                    {top && (
                      <span className="text-text-secondary">
                        Top: <span className="text-text-primary font-medium">{top.player.name}</span>{" "}
                        <span className="tabular-nums">{formatDps(top.dps)} dps</span>
                      </span>
                    )}
                    <span>{new Date(enc.startedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No encounters recorded" />
        )}
      </section>
    </div>
  );
}
