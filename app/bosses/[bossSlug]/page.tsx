import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/page-metadata";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { countAttempts, isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { PageHeader } from "@/components/ui/PageLayout";
import { SectionNav } from "@/components/ui/SectionNav";
import { DifficultyFilter } from "@/components/reports/DifficultyFilter";
import { difficultyFilterWhere, difficultyScopeLabel, parseDifficultyFilter, reportQueryString, type DifficultyFilterValue, type ReportSearchParams } from "@/lib/difficulty-filter";

interface Props {
  params: Promise<{ bossSlug: string }>;
  searchParams: Promise<ReportSearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bossSlug } = await params;
  const boss = await db.boss.findUnique({
    where: { slug: bossSlug },
    select: { name: true, raid: true },
  });
  const title = boss?.name ?? "Boss";
  return buildPageMetadata({
    title,
    description: boss
      ? `View ${boss.name} kills, wipes, DPS, and HPS rankings from ${boss.raid}.`
      : "View WotLK boss attempts and rankings.",
    path: `/bosses/${encodeURIComponent(bossSlug)}`,
  });
}

async function getBossData(slug: string, includeShortPulls: boolean, difficulty: DifficultyFilterValue) {
  const boss = await db.boss.findUnique({
    where: { slug },
    include: {
      encounters: {
        where: difficultyFilterWhere(difficulty),
        orderBy: { startedAt: "desc" },
        include: {
          participants: {
            orderBy: { dps: "desc" },
            take: 1,
            select: { dps: true, player: { select: { name: true, class: true } } },
          },
        },
      },
    },
  });
  if (!boss) return null;

  const wipeEvidence = await db.encounter.findMany({
    where: { bossId: boss.id, outcome: "WIPE", ...difficultyFilterWhere(difficulty) },
    select: { id: true, participants: { select: { deaths: true } } },
  });
  const deathsByEncounter = new Map(wipeEvidence.map(encounter => [encounter.id, encounter.participants]));
  const attempts = boss.encounters.map(encounter => ({
    ...encounter,
    participants: deathsByEncounter.get(encounter.id),
  }));
  const counts = countAttempts(attempts, { includeShortPulls });
  const shortPullIds = new Set(attempts.filter(isShortPull).map(encounter => encounter.id));
  const visibleEncounters = boss.encounters.filter(encounter => includeShortPulls || !shortPullIds.has(encounter.id));

  // All-time DPS leaderboard (kills only)
  const dpsLeaders = await db.participant.findMany({
    where: { encounter: { bossId: boss.id, outcome: "KILL", ...difficultyFilterWhere(difficulty) }, dps: { gt: 0 } },
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
    where: { encounter: { bossId: boss.id, outcome: "KILL", ...difficultyFilterWhere(difficulty) }, hps: { gt: 100 } },
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

  return { boss, dpsLeaders, hpsLeaders, counts, visibleEncounters };
}

export default async function BossPage({ params, searchParams }: Props) {
  const { bossSlug } = await params;
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const difficulty = parseDifficultyFilter(query.difficulty);
  const querySuffix = reportQueryString(query, { difficulty: difficulty === "all" ? null : difficulty });
  const data = await getBossData(bossSlug, includeShortPulls, difficulty);
  if (!data) notFound();

  const { boss, dpsLeaders, hpsLeaders, counts, visibleEncounters } = data;

  const kills = boss.encounters.filter(e => e.outcome === "KILL");
  const fastestKill = kills.reduce<number | null>(
    (m, e) => m === null ? e.durationSeconds : Math.min(m, e.durationSeconds), null
  );

  const DIFFICULTIES = ["10N", "25N", "10H", "25H", "UNKNOWN"];
  const killsByDiff = DIFFICULTIES.reduce<Record<string, number>>((acc, d) => {
    acc[d] = kills.filter(e => e.difficulty === d).length;
    return acc;
  }, {});

  return (
    <div className="page-shell">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center text-sm text-text-secondary">
        <Link href={`/bosses${querySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">Bosses</Link>
        <span className="mx-2">›</span>
        <span>{boss.raid}</span>
        <span className="mx-2">›</span>
        <span className="text-text-secondary">{boss.name}</span>
      </nav>

      {/* Header */}
      <PageHeader title={boss.name} description={<p>{boss.raid} · Fight history and kill rankings</p>} />

      <DifficultyFilter action={`/bosses/${bossSlug}`} id="boss" difficulty={difficulty} searchParams={query} />
      <p className="text-sm text-text-secondary">{difficultyScopeLabel(difficulty)}. Choose one difficulty to compare the same raid size and mode.</p>
      <SectionNav label="Boss page sections" items={[
        { id: "boss-history", label: "Fight history" },
        { id: "boss-dps", label: "DPS rankings" },
        { id: "boss-hps", label: "HPS rankings" },
      ]} />
      <ShortPullNotice shortPulls={counts.shortPulls} includeShortPulls={includeShortPulls} basePath={`/bosses/${bossSlug}${querySuffix}`} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Kills"    value={kills.length} highlight />
        <StatCard label="Total Wipes"    value={counts.wipes} />
        <StatCard label="Fastest Kill"   value={fastestKill !== null ? formatDuration(fastestKill) : "—"} />
        <StatCard label="Total Pulls"    value={counts.totalPulls} />
      </div>

      {/* Kill counts by difficulty */}
      {visibleEncounters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.filter(d => killsByDiff[d] > 0 || visibleEncounters.some(e => e.difficulty === d)).map(d => (
            <div key={d} className="bg-bg-card border border-gold-dim rounded-sm px-4 py-2 text-center">
              <div className={`diff-badge mb-1 ${d.endsWith("H") ? "heroic" : "normal"}`}>{d}</div>
              <div className="text-xl font-bold text-text-primary tabular-nums">{killsByDiff[d] ?? 0}</div>
              <div className="text-sm text-text-secondary">kills</div>
            </div>
          ))}
        </div>
      )}

      {/* DPS Leaderboard */}
      <AccordionSection id="boss-dps" title="DPS rankings" sub="All-time best single-attempt DPS on kills. One entry per player." count={dpsLeaders.length} defaultOpen={false}>
        {dpsLeaders.length > 0 ? (
          <LeaderboardBar
            metric="dps"
            querySuffix={querySuffix}
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
          <EmptyState title="No damage rankings for this selection" description="Choose another difficulty or upload a log containing a kill of this boss." />
        )}
      </AccordionSection>

      {/* HPS Leaderboard */}
      <AccordionSection id="boss-hps" title="HPS rankings" sub="All-time best single-attempt HPS on kills. One entry per player." count={hpsLeaders.length} defaultOpen={false}>
        {hpsLeaders.length > 0 ? (
          <LeaderboardBar
            metric="hps"
            querySuffix={querySuffix}
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
        ) : <EmptyState title="No qualifying healing rankings for this selection" />}
      </AccordionSection>

      {/* Recent encounters */}
      <section id="boss-history" className="scroll-mt-40">
        <SectionHeader
          title="Fight history"
          sub={`Latest ${Math.min(visibleEncounters.length, 20)} of ${counts.totalPulls} counted attempts · Dates in UTC`}
        />
        {visibleEncounters.length > 0 ? (
          <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {visibleEncounters.slice(0, 20).map(enc => {
              const top = enc.participants[0];
              return (
                <Link
                  key={enc.id}
                  href={`/encounters/${enc.id}${querySuffix}`}
                  className="flex min-h-11 flex-col gap-3 px-4 py-3 hover:bg-bg-hover transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-3">
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
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-text-secondary">
                    {top && (
                      <span className="text-text-secondary">
                        Top: <span className="text-text-primary font-medium">{top.player.name}</span>{" "}
                        <span className="tabular-nums">{formatDps(top.dps)} dps</span>
                      </span>
                    )}
                    <span>{new Date(enc.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title={counts.shortPulls > 0 ? "No counted encounters" : "No encounters recorded"} />
        )}
      </section>
    </div>
  );
}
