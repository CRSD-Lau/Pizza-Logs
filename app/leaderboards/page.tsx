import type { Metadata } from "next";
import { db } from "@/lib/db";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { sortBossesByICCOrder } from "@/lib/constants/bosses";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";

export const metadata: Metadata = { title: "Leaderboards" };
export const dynamic = "force-dynamic";

async function getLeaderboardBoards() {
  const bossesWithKills = await db.boss.findMany({
    where:   { encounters: { some: { outcome: "KILL" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select:  { id: true, name: true, slug: true, raid: true },
  });
  const orderedBosses = sortBossesByICCOrder(bossesWithKills);

  const boards = await Promise.all(
    orderedBosses.map(async boss => {
      const [dpsRows, hpsRows] = await Promise.all([
        db.participant.findMany({
          where:    { encounter: { bossId: boss.id, outcome: "KILL" }, dps: { gt: 0 } },
          orderBy:  { dps: "desc" },
          take:     10,
          distinct: ["playerId"],
          include: {
            player:    { select: { name: true, class: true } },
            encounter: { select: { id: true, difficulty: true, startedAt: true } },
          },
        }),
        db.participant.findMany({
          where:    { encounter: { bossId: boss.id, outcome: "KILL" }, hps: { gt: 100 } },
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
  );

  return boards.filter(b => b.dpsEntries.length > 0 || b.hpsEntries.length > 0);
}

export default async function LeaderboardsPage() {
  let databaseAvailable = true;
  let boards: Awaited<ReturnType<typeof getLeaderboardBoards>> = [];

  try {
    boards = await getLeaderboardBoards();
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }

  return (
    <PageShell>
      <PageHeader
        title="Leaderboards"
        description={
          <p>
          All-time top 10 DPS and HPS per boss — kills only, one entry per player
          </p>
        }
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="Leaderboards need the Pizza Logs database. Start local Postgres to load rankings." />
      )}

      {databaseAvailable && (boards.length === 0 ? (
        <EmptyState
          title="No leaderboard data yet"
          description="Upload a combat log to populate the leaderboards."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        <div className="divide-y divide-gold-dim border-y border-gold-dim">
          {boards.map(({ boss, dpsEntries, hpsEntries }, index) => (
            <details
              key={boss.id}
              open={index === 0}
              className={getRevealClassName({ boss: true, className: "group" })}
              style={getRevealStyle(index)}
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-bg-panel/50 focus-visible:bg-bg-panel/50 sm:px-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="heading-cinzel block truncate text-base font-bold text-gold transition-colors group-open:text-gold-light sm:text-lg">
                  {boss.name}
                  </span>
                  <span className="mt-1 block text-sm text-text-dim">{boss.raid} · {dpsEntries.length} DPS · {hpsEntries.length} HPS</span>
                </span>
                <span className="text-xl text-text-dim transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>

              <div className="grid gap-8 px-2 pb-8 pt-3 md:grid-cols-2 sm:px-4">
                {/* DPS */}
                {dpsEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-widest">
                      Top DPS
                    </p>
                    <LeaderboardBar entries={dpsEntries} metric="dps" />
                  </div>
                )}

                {/* HPS */}
                {hpsEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-widest">
                      Top HPS
                    </p>
                    <LeaderboardBar entries={hpsEntries} metric="hps" />
                  </div>
                )}
              </div>
              <Link href={`/bosses/${boss.slug}`} className="mx-2 mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-gold hover:text-gold-light sm:mx-4">
                View {boss.name} history &rarr;
              </Link>
            </details>
          ))}
        </div>
      ))}
    </PageShell>
  );
}
