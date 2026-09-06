import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWeekBounds, formatCountLabel, formatDateUtc, formatInteger } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { db } from "@/lib/db";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildWeeklyBossKills } from "@/lib/weekly-stats";
import { PageHeader } from "@/components/ui/PageLayout";
import { countAttempts, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { DifficultyFilter } from "@/components/reports/DifficultyFilter";
import { difficultyFilterWhere, difficultyScopeLabel, parseDifficultyFilter, reportQueryString, type DifficultyFilterValue, type ReportSearchParams } from "@/lib/difficulty-filter";

import { buildPageMetadata } from "@/lib/page-metadata";

export const metadata = buildPageMetadata({
  title: "This Week",
  description: "This week's WotLK boss kills and top DPS and HPS attempts.",
  path: "/weekly",
});
export const dynamic = "force-dynamic";

async function getWeeklyData(includeShortPulls: boolean, difficulty: DifficultyFilterValue) {
  const { start, end } = getWeekBounds();

  const encounters = await db.encounter.findMany({
    where: { startedAt: { gte: start, lt: end }, ...difficultyFilterWhere(difficulty) },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: { select: { deaths: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const kills = encounters.filter(e => e.outcome === "KILL");
  const counts = countAttempts(encounters, { includeShortPulls });

  const [topDpsRows, topHpsRows] = await Promise.all([
    db.participant.findMany({
      where: { encounter: { startedAt: { gte: start, lt: end }, ...difficultyFilterWhere(difficulty) }, dps: { gt: 0 } },
      orderBy: { dps: "desc" },
      take: 10,
      include: {
        player: { select: { name: true, class: true } },
        encounter: { select: { id: true, startedAt: true, difficulty: true, boss: { select: { name: true, slug: true } } } },
      },
    }),
    db.participant.findMany({
      where: { encounter: { startedAt: { gte: start, lt: end }, ...difficultyFilterWhere(difficulty) }, hps: { gt: 100 } },
      orderBy: { hps: "desc" },
      take: 10,
      include: {
        player: { select: { name: true, class: true } },
        encounter: { select: { id: true, startedAt: true, difficulty: true, boss: { select: { name: true, slug: true } } } },
      },
    }),
  ]);

  const bossKills = buildWeeklyBossKills(kills);

  return {
    weekStart: start.toISOString(),
    totalKills: counts.kills,
    totalWipes: counts.wipes,
    totalPulls: counts.totalPulls,
    shortPulls: counts.shortPulls,
    bossesCleared: bossKills.length,
    topDps: topDpsRows.map(p => ({
      playerName: p.player.name,
      class: p.player.class,
      bossName: p.encounter.boss.name,
      bossSlug: p.encounter.boss.slug,
      difficulty: p.encounter.difficulty,
      encounterId: p.encounter.id,
      date: p.encounter.startedAt.toISOString(),
      dps: p.dps,
    })),
    topHps: topHpsRows.map(p => ({
      playerName: p.player.name,
      class: p.player.class,
      bossName: p.encounter.boss.name,
      bossSlug: p.encounter.boss.slug,
      difficulty: p.encounter.difficulty,
      encounterId: p.encounter.id,
      date: p.encounter.startedAt.toISOString(),
      hps: p.hps,
    })),
    bossKills,
  };
}

export default async function WeeklyPage({ searchParams }: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const difficulty = parseDifficultyFilter(query.difficulty);
  const querySuffix = reportQueryString(query, { difficulty: difficulty === "all" ? null : difficulty });
  let databaseAvailable = true;
  let data: Awaited<ReturnType<typeof getWeeklyData>>;

  try {
    data = await getWeeklyData(includeShortPulls, difficulty);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
    const { start } = getWeekBounds();
    data = {
      weekStart: start.toISOString(),
      totalKills: 0,
      totalWipes: 0,
      totalPulls: 0,
      shortPulls: 0,
      bossesCleared: 0,
      topDps: [],
      topHps: [],
      bossKills: [],
    };
  }
  const { start, end } = getWeekBounds();

  const weekLabel = `${formatDateUtc(start)} – ${formatDateUtc(end)}`;

  return (
    <div className="page-shell">
      <PageHeader
        title="Weekly Summary"
        description={<p>
          {databaseAvailable ? `${weekLabel} · UTC` : `${weekLabel} · temporarily unavailable`}
        </p>}
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="This week's results are temporarily unavailable. Please try again shortly." />
      )}

      {databaseAvailable && (
      <>
        <div className="space-y-3">
          <DifficultyFilter action="/weekly" id="weekly" difficulty={difficulty} searchParams={query} />
          <p className="text-sm text-text-secondary">{difficultyScopeLabel(difficulty)}. Rankings compare individual attempts across bosses.</p>
        </div>
        <StatGroup columns={4}>
          <StatCard label="Boss Kills" value={formatInteger(data.totalKills)} highlight />
          <StatCard label="Wipes" value={formatInteger(data.totalWipes)} />
          <StatCard label="Bosses Cleared" value={formatInteger(data.bossesCleared)} />
          <StatCard
            label="Kill Rate"
            value={<NumericValue value={data.totalKills + data.totalWipes > 0
              ? data.totalKills / (data.totalKills + data.totalWipes) * 100 : null} kind="percent" />}
            sub={data.totalKills + data.totalWipes > 0 ? "kills / counted kills and wipes" : "No kills or wipes"}
          />
        </StatGroup>

        <section>
          <SectionHeader title="Top DPS Attempts This Week" sub="Highest single-attempt DPS across recorded pulls. A player can appear more than once." />
          {data.topDps.length > 0 ? (
            <LeaderboardBar entries={data.topDps.map((e, i) => ({
              rank: i + 1,
              playerName: e.playerName,
              class: e.class ?? undefined,
              value: e.dps,
              bossName: e.bossName,
              bossSlug: e.bossSlug,
              difficulty: e.difficulty,
              encounterId: e.encounterId,
              date: e.date,
            }))} metric="dps" querySuffix={querySuffix} />
          ) : (
            <EmptyState title="No damage attempts for this selection" description="Choose another difficulty or upload this week's combat log." />
          )}
        </section>

        <section>
          <SectionHeader title="Top HPS Attempts This Week" sub="Highest single-attempt HPS across recorded pulls. A player can appear more than once." />
          {data.topHps.length > 0 ? (
            <LeaderboardBar entries={data.topHps.map((e, i) => ({
              rank: i + 1,
              playerName: e.playerName,
              class: e.class ?? undefined,
              value: e.hps,
              bossName: e.bossName,
              bossSlug: e.bossSlug,
              difficulty: e.difficulty,
              encounterId: e.encounterId,
              date: e.date,
            }))} metric="hps" querySuffix={querySuffix} />
          ) : (
            <EmptyState title="No qualifying healing attempts for this selection" />
          )}
        </section>

        {data.bossKills.length > 0 && (
          <section>
            <SectionHeader title="Boss Kills This Week" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.bossKills.map((b) => (
                <Link
                  key={b.slug}
                  href={`/bosses/${b.slug}${querySuffix}`}
                  className="flex items-center justify-between bg-bg-card border border-gold-dim rounded-sm px-4 py-3 hover:border-gold/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{b.name}</p>
                    <p className="text-xs text-text-dim">{b.raid}</p>
                  </div>
                  <span className="text-sm font-bold text-gold tabular-nums">{formatCountLabel(b.kills, "kill")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {data.totalPulls === 0 && data.shortPulls === 0 && (
          <EmptyState
            title="No data yet"
            description="Upload a combat log to see your weekly summary."
            action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
          />
        )}
      </>
      )}
    </div>
  );
}
