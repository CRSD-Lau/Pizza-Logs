import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildRaidComparisonRuns,
  buildRaidComparisonSessions,
  type RaidComparisonData,
  type RaidComparisonParams,
  type RaidComparisonScope,
} from "@/lib/player-raid-comparison";

/**
 * Load every recorded run in one exact raid/difficulty scope. Only the subject's
 * lean kill rates are selected; blobs and other players' rows are excluded.
 */
export async function getPlayerRaidComparison(
  database: Pick<PrismaClient, "encounter" | "boss" | "participant">,
  playerId: string,
  params: RaidComparisonParams = {},
): Promise<RaidComparisonData> {
  const playerKills = { outcome: "KILL" as const, participants: { some: { playerId } } };
  const scopeGroups = await database.encounter.groupBy({
    by: ["bossId", "difficulty"],
    where: playerKills,
    _max: { startedAt: true },
  });
  if (!scopeGroups.length) return { scopes: [], raidSlug: "", difficulty: "", sessions: [], runs: [] };

  const bosses = await database.boss.findMany({
    where: { id: { in: [...new Set(scopeGroups.map(group => group.bossId))] } },
    select: { id: true, raid: true, raidSlug: true },
  });
  const bossesById = new Map(bosses.map(boss => [boss.id, boss]));
  const groupedScopes = new Map<string, { scope: RaidComparisonScope; latest: number }>();
  for (const group of scopeGroups) {
    const boss = bossesById.get(group.bossId);
    if (!boss || !group._max.startedAt) continue;
    const key = JSON.stringify([boss.raidSlug, group.difficulty]);
    const latest = group._max.startedAt.getTime();
    const previous = groupedScopes.get(key);
    if (!previous || latest > previous.latest) groupedScopes.set(key, {
      scope: { raidSlug: boss.raidSlug, raidName: boss.raid, difficulty: group.difficulty }, latest,
    });
  }
  const scopes = [...groupedScopes.values()].sort((left, right) => right.latest - left.latest
    || left.scope.raidSlug.localeCompare(right.scope.raidSlug, "en")
    || left.scope.difficulty.localeCompare(right.scope.difficulty, "en"))
    .map(entry => entry.scope);
  const selectedScope = scopes.find(scope => scope.raidSlug === params.raid && scope.difficulty === params.difficulty)
    ?? scopes.find(scope => scope.raidSlug === params.raid)
    ?? (!params.raid ? scopes.find(scope => scope.difficulty === params.difficulty) : undefined)
    ?? scopes[0];
  if (!selectedScope) return { scopes, raidSlug: "", difficulty: "", sessions: [], runs: [] };

  const scopeWhere = { difficulty: selectedScope.difficulty, boss: { raidSlug: selectedScope.raidSlug } };
  const participants = await database.participant.findMany({
    where: {
      playerId,
      encounter: {
        outcome: "KILL", ...scopeWhere,
      },
    },
    select: {
      dps: true, hps: true, spec: true,
      encounter: { select: {
        id: true, uploadId: true, sessionIndex: true, startedAt: true, outcome: true,
        durationMs: true, durationSeconds: true,
        boss: { select: { slug: true, name: true, sortOrder: true } },
      } },
    },
    orderBy: [{ encounter: { startedAt: "asc" } }, { encounter: { id: "asc" } }],
  });
  const sessions = buildRaidComparisonSessions(participants.map(({ encounter }) => ({
    uploadId: encounter.uploadId, sessionIndex: encounter.sessionIndex, startedAt: encounter.startedAt,
  })));

  return {
    scopes, raidSlug: selectedScope.raidSlug, difficulty: selectedScope.difficulty,
    sessions, runs: buildRaidComparisonRuns(sessions, participants),
  };
}
