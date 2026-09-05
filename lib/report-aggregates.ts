import { Prisma } from "@/generated/prisma/client";
import { shortPullSql } from "./attempt-policy.server";

export type BossAggregate = {
  bossId: string;
  killCount: number;
  wipeCount: number;
  totalPulls: number;
  shortPullCount: number;
  fastestKill: number | null;
  dps: number | null;
  playerName: string | null;
};

export function bossAggregateQuery(filters: {
  raidSlug?: string;
  realmId?: string;
  difficulty?: string;
  includeShortPulls?: boolean;
}) {
  const includeShortPulls = filters.includeShortPulls ?? false;
  return Prisma.sql`
    WITH selected AS (
      SELECT e.id, e."bossId", e.outcome, e."durationSeconds", ${shortPullSql()} AS "isShortPull"
      FROM encounters e
      JOIN uploads u ON u.id = e."uploadId"
      JOIN bosses b ON b.id = e."bossId"
      WHERE TRUE
        ${filters.raidSlug ? Prisma.sql`AND b."raidSlug" = ${filters.raidSlug}` : Prisma.empty}
        ${filters.realmId ? Prisma.sql`AND u."realmId" = ${filters.realmId}` : Prisma.empty}
        ${filters.difficulty ? Prisma.sql`AND e.difficulty = ${filters.difficulty}` : Prisma.empty}
    ), totals AS (
      SELECT "bossId", COUNT(*) FILTER (WHERE ${includeShortPulls} OR NOT "isShortPull")::int AS "totalPulls",
        COUNT(*) FILTER (WHERE outcome = 'KILL')::int AS "killCount",
        COUNT(*) FILTER (WHERE outcome = 'WIPE' AND (${includeShortPulls} OR NOT "isShortPull"))::int AS "wipeCount",
        COUNT(*) FILTER (WHERE "isShortPull")::int AS "shortPullCount",
        MIN("durationSeconds") FILTER (WHERE outcome = 'KILL') AS "fastestKill"
      FROM selected GROUP BY "bossId"
    ), best AS (
      SELECT DISTINCT ON (e."bossId") e."bossId", p.dps, player.name AS "playerName"
      FROM selected e
      JOIN participants p ON p."encounterId" = e.id
      JOIN players player ON player.id = p."playerId"
      ORDER BY e."bossId", p.dps DESC, e.id ASC, p.id ASC
    )
    SELECT totals.*, best.dps, best."playerName"
    FROM totals LEFT JOIN best ON best."bossId" = totals."bossId"
  `;
}

export type WeeklyAggregate = {
  name: string;
  slug: string;
  raid: string;
  outcome: "KILL" | "WIPE" | "UNKNOWN";
  count: number;
  shortPullCount: number;
};

export function weeklyAggregateQuery(start: Date, end: Date, realmId?: string, includeShortPulls = false) {
  return Prisma.sql`
    WITH selected AS (
      SELECT e.id, e."bossId", e.outcome, e."startedAt", ${shortPullSql()} AS "isShortPull"
      FROM encounters e
      JOIN uploads u ON u.id = e."uploadId"
      WHERE e."startedAt" >= ${start} AND e."startedAt" < ${end}
        ${realmId ? Prisma.sql`AND u."realmId" = ${realmId}` : Prisma.empty}
    )
    SELECT b.name, b.slug, b.raid, e.outcome,
      COUNT(*) FILTER (WHERE ${includeShortPulls} OR NOT e."isShortPull")::int AS count,
      COUNT(*) FILTER (WHERE e."isShortPull")::int AS "shortPullCount"
    FROM selected e
    JOIN bosses b ON b.id = e."bossId"
    GROUP BY b.id, b.name, b.slug, b.raid, e.outcome
    ORDER BY MAX(e."startedAt") DESC, b.slug ASC, e.outcome ASC
  `;
}
