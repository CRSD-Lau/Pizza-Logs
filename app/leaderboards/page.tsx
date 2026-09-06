import { db } from "@/lib/db";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { AverageLeaderboards } from "@/components/charts/AverageLeaderboards";
import { getAverageLeaderboards } from "@/lib/average-leaderboards";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { sortBossesByICCOrder } from "@/lib/constants/bosses";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { DifficultyFilter } from "@/components/reports/DifficultyFilter";
import { difficultyFilterWhere, difficultyScopeLabel, parseDifficultyFilter, reportQueryString, type DifficultyFilterValue, type ReportSearchParams } from "@/lib/difficulty-filter";

import { buildPageMetadata } from "@/lib/page-metadata";
import { formatCountLabel } from "@/lib/utils";

export const metadata = buildPageMetadata({
  title: "Leaderboards",
  description: "Compare average DPS and HPS across logged boss attempts, or browse each boss's best kill records.",
  path: "/leaderboards",
});
export const dynamic = "force-dynamic";

async function getLeaderboardBoards(difficulty: DifficultyFilterValue, requestedBoss: string | undefined) {
  const bossesWithAttempts = await db.boss.findMany({
    where:   { encounters: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select:  { id: true, name: true, slug: true, raid: true },
  });
  const orderedBosses = sortBossesByICCOrder(bossesWithAttempts);
  const selectedBoss = orderedBosses.some(boss => boss.slug === requestedBoss) ? requestedBoss! : "";
  const visibleBosses = selectedBoss ? orderedBosses.filter(boss => boss.slug === selectedBoss) : orderedBosses;

  const [averages, boards] = await Promise.all([
    getAverageLeaderboards(db, difficulty, selectedBoss ? visibleBosses[0].id : undefined),
    Promise.all(
    visibleBosses.map(async boss => {
      const [dpsRows, hpsRows] = await Promise.all([
        db.participant.findMany({
          where:    { encounter: { bossId: boss.id, outcome: "KILL", ...difficultyFilterWhere(difficulty) }, dps: { gt: 0 } },
          orderBy:  { dps: "desc" },
          take:     10,
          distinct: ["playerId"],
          include: {
            player:    { select: { name: true, class: true } },
            encounter: { select: { id: true, difficulty: true, startedAt: true } },
          },
        }),
        db.participant.findMany({
          where:    { encounter: { bossId: boss.id, outcome: "KILL", ...difficultyFilterWhere(difficulty) }, hps: { gt: 100 } },
          orderBy:  { hps: "desc" },
          take:     10,
          distinct: ["playerId"],
          include: {
            player:    { select: { name: true, class: true } },
            encounter: { select: { id: true, difficulty: true, startedAt: true } },
          },
        }),
      ]);

      const dpsEntries = dpsRows.map((r, i) => ({
        rank:        i + 1,
        playerName:  r.player.name,
        class:       r.player.class,
        value:       r.dps,
        bossName:    boss.name,
        bossSlug:    boss.slug,
        difficulty:  r.encounter.difficulty,
        encounterId: r.encounter.id,
        date:        r.encounter.startedAt.toISOString(),
      }));

      const hpsEntries = hpsRows.map((r, i) => ({
        rank:        i + 1,
        playerName:  r.player.name,
        class:       r.player.class,
        value:       r.hps,
        bossName:    boss.name,
        bossSlug:    boss.slug,
        difficulty:  r.encounter.difficulty,
        encounterId: r.encounter.id,
        date:        r.encounter.startedAt.toISOString(),
      }));

      return { boss, dpsEntries, hpsEntries };
    })
    ),
  ]);

  return { averages, bosses: orderedBosses, selectedBoss, boards: boards.filter(b => b.dpsEntries.length > 0 || b.hpsEntries.length > 0) };
}

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const query = await searchParams;
  const difficulty = parseDifficultyFilter(query.difficulty);
  const requestedBoss = Array.isArray(query.boss) ? query.boss[0] : query.boss;
  const querySuffix = reportQueryString(query, { difficulty: difficulty === "all" ? null : difficulty, boss: null });
  let databaseAvailable = true;
  let data: Awaited<ReturnType<typeof getLeaderboardBoards>> = { averages: { dps: [], hps: [] }, boards: [], bosses: [], selectedBoss: "" };

  try {
    data = await getLeaderboardBoards(difficulty, requestedBoss);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }
  const { boards, bosses, selectedBoss } = data;

  return (
    <PageShell>
      <PageHeader
        title="Leaderboards"
        description={
          <p>
          All-time averages across logged attempts, plus each boss&apos;s top 10 DPS and HPS kill records.
          </p>
        }
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="Rankings are temporarily unavailable. Please try again shortly." />
      )}

      {databaseAvailable && (
        <div className="space-y-3">
          <DifficultyFilter action="/leaderboards" id="leaderboards" difficulty={difficulty} searchParams={query} bosses={bosses} boss={selectedBoss} />
          <p className="text-sm text-text-secondary">{difficultyScopeLabel(difficulty)}. Choose one difficulty to compare the same raid size and mode.</p>
        </div>
      )}

      {databaseAvailable && <AverageLeaderboards {...data.averages} />}

      {databaseAvailable && (boards.length === 0 ? (
        <EmptyState
          title="No kill records for this selection"
          description="Choose another boss or difficulty, or upload a log containing a boss kill."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        <div className="divide-y divide-gold-dim border-y border-gold-dim">
          {boards.map(({ boss, dpsEntries, hpsEntries }, index) => (
            <AccordionSection
              key={boss.id}
              id={`boss-${boss.slug}`}
              title={boss.name}
              sub={`${boss.raid} · ${formatCountLabel(dpsEntries.length, "DPS entry", "DPS entries")} · ${formatCountLabel(hpsEntries.length, "HPS entry", "HPS entries")}`}
              defaultOpen={index === 0}
            >
              <div className={`grid gap-6 px-2 pb-4 pt-3 sm:px-4 ${dpsEntries.length > 0 && hpsEntries.length > 0 ? "md:grid-cols-2" : ""}`}>
                {/* DPS */}
                {dpsEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-widest">
                      Top DPS
                    </p>
                    <LeaderboardBar entries={dpsEntries} metric="dps" querySuffix={querySuffix} showBoss={false} />
                  </div>
                )}

                {/* HPS */}
                {hpsEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-widest">
                      Top HPS
                    </p>
                    <LeaderboardBar entries={hpsEntries} metric="hps" querySuffix={querySuffix} showBoss={false} />
                  </div>
                )}
              </div>
              <Link href={`/bosses/${boss.slug}${querySuffix}#boss-history`} className="mx-2 mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-gold hover:text-gold-light sm:mx-4">
                View {boss.name} history &rarr;
              </Link>
            </AccordionSection>
          ))}
        </div>
      ))}
    </PageShell>
  );
}
