import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration } from "@/lib/utils";
import { RAIDS } from "@/lib/constants/bosses";
import { cn } from "@/lib/utils";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { countAttempts, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { DifficultyFilter } from "@/components/reports/DifficultyFilter";
import { difficultyFilterWhere, difficultyScopeLabel, parseDifficultyFilter, reportQueryString, type DifficultyFilterValue, type ReportSearchParams } from "@/lib/difficulty-filter";

import { buildPageMetadata } from "@/lib/page-metadata";

export const metadata = buildPageMetadata({
  title: "Bosses",
  description: "Explore WotLK boss history, kill totals, and performance rankings.",
  path: "/bosses",
});
export const dynamic = "force-dynamic";

const BOSS_GRID_COLUMNS = "2fr 60px 60px 60px 120px 100px";
const EMPTY_VALUE = "\u2014";

async function getBossStats(includeShortPulls: boolean, difficulty: DifficultyFilterValue) {
  const bosses = await db.boss.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      encounters: {
        where: difficultyFilterWhere(difficulty),
        select: {
          id:              true,
          outcome:         true,
          difficulty:      true,
          durationSeconds: true,
          durationMs:      true,
          participants: {
            orderBy: { dps: "desc" },
            take:    1,
            select:  { dps: true, player: { select: { name: true } } },
          },
        },
      },
    },
  });

  // The ranking query deliberately keeps just the top DPS actor. Classifying
  // an attempt requires death evidence from every participant instead.
  const wipeEvidence = await db.encounter.findMany({
    where: { outcome: "WIPE", ...difficultyFilterWhere(difficulty) },
    select: { id: true, participants: { select: { deaths: true } } },
  });
  const deathsByEncounter = new Map(wipeEvidence.map(encounter => [encounter.id, encounter.participants]));

  return bosses.map(b => {
    const counts = countAttempts(b.encounters.map(encounter => ({
      ...encounter,
      participants: deathsByEncounter.get(encounter.id),
    })), { includeShortPulls });
    const kills = b.encounters.filter(e => e.outcome === "KILL");
    const bestKill = kills.reduce<{ dps: number; playerName: string } | null>((best, enc) => {
      const top = enc.participants[0];
      if (!top) return best;
      if (!best || top.dps > best.dps) return { dps: top.dps, playerName: top.player.name };
      return best;
    }, null);
    const fastestKill = kills.reduce<number | null>(
      (m, e) => m === null ? e.durationSeconds : Math.min(m, e.durationSeconds),
      null
    );
    return {
      id:         b.id,
      name:       b.name,
      slug:       b.slug,
      raid:       b.raid,
      raidSlug:   b.raidSlug,
      killCount:  counts.kills,
      wipeCount:  counts.wipes,
      unknownCount: counts.unknown,
      totalPulls: counts.totalPulls,
      shortPulls: counts.shortPulls,
      bestKill,
      fastestKill,
    };
  });
}

export default async function BossesPage({ searchParams }: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const difficulty = parseDifficultyFilter(query.difficulty);
  const querySuffix = reportQueryString(query, { difficulty: difficulty === "all" ? null : difficulty });
  let databaseAvailable = true;
  let bosses: Awaited<ReturnType<typeof getBossStats>> = [];

  try {
    bosses = await getBossStats(includeShortPulls, difficulty);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }
  const byRaid = RAIDS.map(r => ({
    ...r,
    bosses: bosses.filter(b => b.raidSlug === r.slug),
  })).filter(r => r.bosses.length > 0);

  const activeBosses = bosses.filter(b => b.totalPulls > 0);
  const activeRaids = byRaid
    .map(raid => ({ ...raid, bosses: raid.bosses.filter(boss => boss.totalPulls > 0) }))
    .filter(raid => raid.bosses.length > 0);
  const inactiveRaids = byRaid
    .map(raid => ({ ...raid, bosses: raid.bosses.filter(boss => boss.totalPulls === 0) }))
    .filter(raid => raid.bosses.length > 0);
  const inactiveBossCount = inactiveRaids.reduce((sum, raid) => sum + raid.bosses.length, 0);

  return (
    <PageShell>
      <PageHeader
        title="Bosses"
        description={
          <p>
          {databaseAvailable
            ? `Fight history and kill performance across ${activeBosses.length} bosses with counted attempts`
            : "Boss results are temporarily unavailable"}
          </p>
        }
      />

      {databaseAvailable && (
        <>
        <DifficultyFilter action="/bosses" id="bosses" difficulty={difficulty} searchParams={query} />
        <p className="text-sm text-text-secondary">{difficultyScopeLabel(difficulty)}. Top DPS and fastest kills use successful attempts.</p>
        <ShortPullNotice
          shortPulls={bosses.reduce((sum, boss) => sum + boss.shortPulls, 0)}
          includeShortPulls={includeShortPulls}
          basePath={`/bosses${querySuffix}`}
        />
        </>
      )}

      {!databaseAvailable && (
        <DatabaseUnavailable description="Boss results are temporarily unavailable. Please try again shortly." />
      )}

      {databaseAvailable && (byRaid.length === 0 ? (
        <EmptyState
          title="No encounters yet"
          description="Upload a combat log to start building your leaderboards."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        <>
        {activeRaids.map(raid => (
          <section key={raid.slug}>
            <SectionHeader title={raid.name} />
            <div className="space-y-2 md:space-y-0.5">
              <div
                className="hidden gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim md:grid"
                style={{ gridTemplateColumns: BOSS_GRID_COLUMNS }}
              >
                <span>Boss</span>
                <span className="text-right">Kills</span>
                <span className="text-right">Wipes</span>
                <span className="text-right">Outcome</span>
                <span className="text-right">Top DPS</span>
                <span className="text-right">Fastest Kill</span>
              </div>
              {raid.bosses.map((b, index) => {
                const statusLabel = b.killCount > 0 ? "Kill" : b.wipeCount > 0 ? "Wipe" : b.unknownCount > 0 ? "Unknown" : EMPTY_VALUE;
                const statusClassName = cn(
                  "text-xs font-semibold",
                  b.killCount > 0 ? "text-success" : b.wipeCount > 0 ? "text-danger" : "text-text-dim"
                );
                const topDps = b.bestKill
                  ? `${formatDps(b.bestKill.dps)} ${b.bestKill.playerName}`
                  : EMPTY_VALUE;

                return (
                  <Link
                    key={b.slug}
                    href={`/bosses/${b.slug}${querySuffix}`}
                    aria-label={`${b.name} boss summary`}
                    className={getRevealClassName({
                      boss: true,
                      className:
                        "group block overflow-hidden bg-bg-card rounded-sm border border-transparent px-4 py-4 hover:border-gold-dim transition-colors md:grid md:gap-3 md:items-center md:py-3",
                    })}
                    style={getRevealStyle(index, { gridTemplateColumns: BOSS_GRID_COLUMNS })}
                  >
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 text-sm font-semibold text-text-primary group-hover:text-gold-light transition-colors">
                          {b.name}
                        </span>
                        <span className={statusClassName}>{statusLabel}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <BossMobileMetric label="Kills" value={b.killCount} valueClassName="text-success" />
                        <BossMobileMetric label="Wipes" value={b.wipeCount} valueClassName="text-danger" />
                        <BossMobileMetric
                          label="Fastest"
                          value={b.fastestKill !== null ? formatDuration(b.fastestKill) : EMPTY_VALUE}
                          valueClassName="text-text-secondary"
                        />
                      </div>

                      <div className="rounded-sm border border-gold-dim/70 bg-bg-panel/70 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-widest text-text-dim">
                          Top DPS
                        </div>
                        <div className="mt-0.5 truncate text-sm text-text-primary tabular-nums">
                          {topDps}
                        </div>
                      </div>
                    </div>

                    <span className="hidden md:block text-sm font-semibold text-text-primary group-hover:text-gold-light transition-colors">
                      {b.name}
                    </span>
                    <span className="hidden md:block text-right font-bold text-success tabular-nums text-sm">
                      {b.killCount}
                    </span>
                    <span className="hidden md:block text-right text-text-dim tabular-nums text-sm">
                      {b.wipeCount}
                    </span>
                    <span className={cn("hidden md:block text-right", statusClassName)}>
                      {statusLabel}
                    </span>
                    <span className="hidden md:block text-right text-sm">
                      {b.bestKill ? (
                        <span className="tabular-nums text-text-primary font-medium">
                          {formatDps(b.bestKill.dps)}{" "}
                          <span className="text-text-dim text-xs">{b.bestKill.playerName}</span>
                        </span>
                      ) : EMPTY_VALUE}
                    </span>
                    <span className="hidden md:block text-right text-sm tabular-nums text-text-secondary">
                      {b.fastestKill !== null ? formatDuration(b.fastestKill) : EMPTY_VALUE}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {inactiveBossCount > 0 && (
          <details className="group border-y border-gold-dim">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-bg-panel/45 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="heading-cinzel block font-semibold text-gold-light">Bosses without counted attempts in this selection</span>
                <span className="mt-1 block text-sm text-text-dim">{inactiveBossCount} bosses hidden until needed</span>
              </span>
              <span className="text-xl text-text-dim transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>
            <div className="grid gap-x-8 gap-y-6 px-2 pb-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
              {inactiveRaids.map(raid => (
                <div key={raid.slug}>
                  <h2 className="heading-cinzel mb-2 text-sm font-semibold text-gold">{raid.name}</h2>
                  <div className="divide-y divide-gold-dim/70 border-y border-gold-dim/70">
                    {raid.bosses.map(boss => (
                      <Link key={boss.slug} href={`/bosses/${boss.slug}${querySuffix}`} className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm text-text-secondary hover:text-gold-light">
                        <span>{boss.name}</span>
                        <span className="text-text-dim" aria-hidden="true">&rarr;</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        </>
      ))}
    </PageShell>
  );
}

function BossMobileMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName: string;
}) {
  return (
    <div className="min-w-0 px-2 py-1 text-center">
      <div className={cn("truncate text-sm font-bold tabular-nums", valueClassName)}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-text-dim">{label}</div>
    </div>
  );
}
