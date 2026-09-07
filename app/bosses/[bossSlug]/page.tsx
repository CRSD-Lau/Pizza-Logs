import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/ui/PageLoading";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration, formatInteger, formatDateTimeUtc, getRecordedDurationSeconds } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { buildPageMetadata } from "@/lib/page-metadata";
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

async function getBoss(slug: string, difficulty: DifficultyFilterValue) {
  return db.boss.findUnique({
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
}

async function getBossData(boss: NonNullable<Awaited<ReturnType<typeof getBoss>>>, includeShortPulls: boolean, difficulty: DifficultyFilterValue) {
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
  const boss = await getBoss(bossSlug, difficulty);
  if (!boss) notFound();

  return (
    <Suspense fallback={<PageLoading message="Loading boss..." />}>
      <BossContent boss={boss} bossSlug={bossSlug} includeShortPulls={includeShortPulls} difficulty={difficulty} querySuffix={querySuffix} query={query} />
    </Suspense>
  );
}

async function BossContent({ boss, bossSlug, includeShortPulls, difficulty, querySuffix, query }: {
  boss: NonNullable<Awaited<ReturnType<typeof getBoss>>>;
  bossSlug: string;
  includeShortPulls: boolean;
  difficulty: DifficultyFilterValue;
  querySuffix: string;
  query: ReportSearchParams;
}) {
  const { dpsLeaders, hpsLeaders, counts, visibleEncounters } = await getBossData(boss, includeShortPulls, difficulty);

  const kills = boss.encounters.filter(e => e.outcome === "KILL");
  const fastestKill = kills.reduce<number | null>((fastest, encounter) => {
    const seconds = getRecordedDurationSeconds(encounter);
    return seconds === null ? fastest : fastest === null ? seconds : Math.min(fastest, seconds);
  }, null);

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

      <div className="space-y-3">
        <DifficultyFilter action={`/bosses/${bossSlug}`} id="boss" difficulty={difficulty} searchParams={query} />
        <p className="text-sm text-text-secondary">{difficultyScopeLabel(difficulty)}. Choose one difficulty to compare the same raid size and mode.</p>
      </div>
      <SectionNav label="Boss page sections" items={[
        { id: "boss-history", label: "Fight history" },
        { id: "boss-dps", label: "DPS rankings" },
        { id: "boss-hps", label: "HPS rankings" },
      ]} />

      {/* Stats */}
      <StatGroup columns={4}>
        <StatCard label="Total Kills" value={formatInteger(kills.length)} highlight />
        <StatCard label="Total Wipes" value={formatInteger(counts.wipes)} />
        <StatCard label="Fastest Kill" value={fastestKill !== null ? formatDuration(fastestKill) : <NumericValue value={null} />} sub={kills.length === 0 ? "No boss kills" : fastestKill === null ? "Kill duration unavailable" : "From known kill durations"} />
        <StatCard label="Total Pulls" value={formatInteger(counts.totalPulls)} />
      </StatGroup>

      {/* Kill counts by difficulty */}
      {visibleEncounters.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span className="text-text-secondary">Kills by difficulty</span>
          {DIFFICULTIES.filter(d => killsByDiff[d] > 0 || visibleEncounters.some(e => e.difficulty === d)).map(d => (
            <div key={d} className="flex items-center gap-2">
              <span className={`diff-badge ${d.endsWith("H") ? "heroic" : "normal"}`}>{d}</span>
              <span className="font-semibold text-text-primary tabular-nums">{formatInteger(killsByDiff[d] ?? 0)}</span>
              <span className="text-text-secondary">{killsByDiff[d] === 1 ? "kill" : "kills"}</span>
            </div>
          ))}
        </div>
      )}

      {/* DPS Leaderboard */}
      <AccordionSection id="boss-dps" title="DPS rankings" sub="All-time best single-attempt DPS on kills. One entry per player." count={dpsLeaders.length} defaultOpen={false}>
        {dpsLeaders.length > 0 ? (
          <LeaderboardBar
            metric="dps"
            showBoss={false}
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
            showBoss={false}
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
          sub={`Latest ${formatInteger(Math.min(visibleEncounters.length, 20))} of ${formatInteger(counts.totalPulls)} counted ${counts.totalPulls === 1 ? "attempt" : "attempts"} · Dates in UTC`}
        />
        {visibleEncounters.length > 0 ? (
          <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {visibleEncounters.slice(0, 20).map(enc => {
              const top = enc.participants[0];
              const duration = getRecordedDurationSeconds(enc);
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
                      {duration === null ? <NumericValue value={null} /> : formatDuration(duration)} duration
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-text-secondary">
                    {top && (
                      <span className="text-text-secondary">
                        Top: <span className="text-text-primary font-medium">{top.player.name}</span>{" "}
                        <span className="tabular-nums">{formatDps(top.dps)} DPS</span>
                      </span>
                    )}
                    <time dateTime={enc.startedAt.toISOString()}>{formatDateTimeUtc(enc.startedAt)}</time>
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
