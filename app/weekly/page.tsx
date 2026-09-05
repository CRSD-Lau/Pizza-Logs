import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWeekBounds } from "@/lib/utils";
import { db } from "@/lib/db";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildWeeklyBossKills } from "@/lib/weekly-stats";
import { PageHeader } from "@/components/ui/PageLayout";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { countAttempts, parseIncludeShortPulls } from "@/lib/attempt-policy";

import { buildPageMetadata } from "@/lib/page-metadata";

export const metadata = buildPageMetadata({
  title: "This Week",
  description: "Review this week's WotLK boss kills, damage, healing, and raid performance.",
  path: "/weekly",
});
export const dynamic = "force-dynamic";

async function getWeeklyData(includeShortPulls: boolean) {
  const { start, end } = getWeekBounds();

  const encounters = await db.encounter.findMany({
    where: { startedAt: { gte: start, lt: end } },
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
      where: { encounter: { startedAt: { gte: start, lt: end } }, dps: { gt: 0 } },
      orderBy: { dps: "desc" },
      take: 10,
      include: {
        player: { select: { name: true, class: true } },
        encounter: { select: { difficulty: true, boss: { select: { name: true, slug: true } } } },
      },
    }),
    db.participant.findMany({
      where: { encounter: { startedAt: { gte: start, lt: end } }, hps: { gt: 100 } },
      orderBy: { hps: "desc" },
      take: 10,
      include: {
        player: { select: { name: true, class: true } },
        encounter: { select: { difficulty: true, boss: { select: { name: true, slug: true } } } },
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
      dps: p.dps,
    })),
    topHps: topHpsRows.map(p => ({
      playerName: p.player.name,
      class: p.player.class,
      bossName: p.encounter.boss.name,
      bossSlug: p.encounter.boss.slug,
      difficulty: p.encounter.difficulty,
      hps: p.hps,
    })),
    bossKills,
  };
}

export default async function WeeklyPage({ searchParams }: {
  searchParams: Promise<{ includeShortPulls?: string | string[] }>;
}) {
  const includeShortPulls = parseIncludeShortPulls((await searchParams).includeShortPulls);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  let databaseAvailable = true;
  let data: Awaited<ReturnType<typeof getWeeklyData>>;

  try {
    data = await getWeeklyData(includeShortPulls);
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

  const weekLabel = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="page-shell">
      <PageHeader
        title="Weekly Summary"
        description={<p>
          {databaseAvailable ? weekLabel : `${weekLabel} - database offline`}
        </p>}
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="Weekly stats need the Pizza Logs database. Start local Postgres to load this week's raids." />
      )}

      {databaseAvailable && (
      <>
        <ShortPullNotice shortPulls={data.shortPulls} includeShortPulls={includeShortPulls} basePath="/weekly" />
        <div className="grid grid-cols-2 items-stretch gap-y-2 rounded-sm bg-bg-panel/40 p-2 sm:grid-cols-5">
          <StatCard label="Boss Kills" value={data.totalKills} highlight className="col-span-2" />
          <StatCard label="Wipes" value={data.totalWipes} />
          <StatCard label="Bosses Cleared" value={data.bossesCleared} />
          <StatCard
            label="Kill Rate"
            value={data.totalKills + data.totalWipes > 0
              ? `${Math.round(data.totalKills / (data.totalKills + data.totalWipes) * 100)}%`
              : "-"}
          />
        </div>

        <section>
          <SectionHeader title="Top DPS This Week" sub="Best single-encounter DPS, kills only" />
          {data.topDps.length > 0 ? (
            <LeaderboardBar entries={data.topDps.map((e, i) => ({
              rank: i + 1,
              playerName: e.playerName,
              class: e.class ?? undefined,
              value: e.dps,
              bossName: e.bossName,
              bossSlug: e.bossSlug,
              difficulty: e.difficulty,
              encounterId: "",
              date: data.weekStart,
            }))} metric="dps" />
          ) : (
            <EmptyState title="No kills recorded this week" description="Upload a combat log to start tracking." />
          )}
        </section>

        <section>
          <SectionHeader title="Top HPS This Week" sub="Best single-encounter HPS, kills only" />
          {data.topHps.length > 0 ? (
            <LeaderboardBar entries={data.topHps.map((e, i) => ({
              rank: i + 1,
              playerName: e.playerName,
              class: e.class ?? undefined,
              value: e.hps,
              bossName: e.bossName,
              bossSlug: e.bossSlug,
              difficulty: e.difficulty,
              encounterId: "",
              date: data.weekStart,
            }))} metric="hps" />
          ) : (
            <EmptyState title="No healing data this week" />
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
                  <span className="text-xl font-bold text-gold tabular-nums">{b.kills}</span>
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
