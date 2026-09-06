import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildRaidComparisonRuns,
  buildRaidComparisonSessions,
  raidComparisonSessionKey,
  selectRaidComparisonSessions,
  type RaidComparisonData,
  type RaidComparisonParams,
  type RaidComparisonScope,
} from "@/lib/player-raid-comparison";

/**
 * Group the full stored history before selecting runs. Only the two selected
 * sessions load participant rates; blobs and other players' rows are excluded.
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
  const sessionGroups = await database.encounter.groupBy({
    by: ["uploadId", "sessionIndex"],
    where: { ...playerKills, ...scopeWhere },
    _min: { startedAt: true },
  });
  const sources = sessionGroups.flatMap(group => group._min.startedAt ? [{
    uploadId: group.uploadId, sessionIndex: group.sessionIndex, startedAt: group._min.startedAt,
  }] : []);
  const sessions = buildRaidComparisonSessions(sources);
  const selected = selectRaidComparisonSessions(sessions, params.first, params.second);
  const sourcesByKey = new Map(sources.map(source => [raidComparisonSessionKey(source.uploadId, source.sessionIndex), source]));
  const selectedSources = selected.flatMap(session => {
    const source = sourcesByKey.get(session.key);
    return source ? [source] : [];
  });

  const participants = selectedSources.length ? await database.participant.findMany({
    where: {
      playerId,
      encounter: {
        outcome: "KILL", ...scopeWhere,
        OR: selectedSources.map(source => ({ uploadId: source.uploadId, sessionIndex: source.sessionIndex })),
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
  }) : [];

  return {
    scopes, raidSlug: selectedScope.raidSlug, difficulty: selectedScope.difficulty,
    sessions, runs: buildRaidComparisonRuns(selected, participants),
  };
}
