import type { PrismaClient } from "@/generated/prisma/client";
import { difficultyFilterWhere, type DifficultyFilterValue } from "@/lib/difficulty-filter";

export const MIN_AVERAGE_FIGHTS = 10;

export interface AverageLeaderboardEntry {
  playerId: string;
  playerName: string;
  class: string | null;
  realm: string | null;
  value: number;
  fights: number;
}

// Aggregate stored rates, not totals/duration: every appearance has equal weight.
// Keep zero-output appearances in the denominator and limit only after grouping.
export async function getAverageLeaderboards(
  database: Pick<PrismaClient, "participant" | "player">,
  difficulty: DifficultyFilterValue,
  bossId?: string,
): Promise<{ dps: AverageLeaderboardEntry[]; hps: AverageLeaderboardEntry[] }> {
  const common = {
    by: ["playerId"] as ["playerId"],
    where: { encounter: {
      ...difficultyFilterWhere(difficulty),
      ...(bossId ? { bossId } : {}),
      OR: [
        { durationMs: { gt: 0 } },
        { durationMs: 0, durationSeconds: { gt: 0 } },
      ],
    } },
    _avg: { dps: true as const, hps: true as const },
    _count: { id: true as const },
    take: 3,
  };
  const [dps, hps] = await Promise.all([
    database.participant.groupBy({
      ...common,
      having: { id: { _count: { gte: MIN_AVERAGE_FIGHTS } }, dps: { _avg: { gt: 0 } } },
      orderBy: [{ _avg: { dps: "desc" } }, { _count: { id: "desc" } }, { playerId: "asc" }],
    }),
    database.participant.groupBy({
      ...common,
      having: { id: { _count: { gte: MIN_AVERAGE_FIGHTS } }, hps: { _avg: { gt: 0 } } },
      orderBy: [{ _avg: { hps: "desc" } }, { _count: { id: "desc" } }, { playerId: "asc" }],
    }),
  ]);
  const ids = [...new Set([...dps, ...hps].map(row => row.playerId))];
  const players = ids.length ? await database.player.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, class: true, realm: { select: { name: true } } },
  }) : [];
  const byId = new Map(players.map(player => [player.id, player]));
  const entries = (rows: typeof dps, metric: "dps" | "hps") => rows.flatMap(row => {
    const player = byId.get(row.playerId);
    return player ? [{
      playerId: player.id, playerName: player.name, class: player.class,
      realm: player.realm?.name ?? null, value: row._avg[metric]!, fights: row._count.id,
    }] : [];
  });
  return { dps: entries(dps, "dps"), hps: entries(hps, "hps") };
}
