import type { Metadata } from "next";
import { db } from "@/lib/db";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { sortBossesByICCOrder } from "@/lib/constants/bosses";

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
    <div className="pt-10 space-y-12">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
          Leaderboards
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          All-time top 10 DPS and HPS per boss — kills only, one entry per player
        </p>
      </div>

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
        <div className="space-y-16">
          {boards.map(({ boss, dpsEntries, hpsEntries }) => (
            <section key={boss.id} className="space-y-6">
              {/* Boss header */}
              <div className="border-b border-gold-dim pb-3">
                <Link
                  href={`/bosses/${boss.slug}`}
                  className="heading-cinzel text-lg font-bold text-gold hover:text-gold-light transition-colors"
                >
                  {boss.name}
                </Link>
                <span className="text-xs text-text-dim ml-3">{boss.raid}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
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
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
