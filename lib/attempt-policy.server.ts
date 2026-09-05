import { Prisma } from "@/generated/prisma/client";
import { SHORT_PULL_LIMIT_MS } from "./attempt-policy";

/** Same evidence as isShortPull, evaluated by PostgreSQL without loading JSON. */
export function shortPullWhere(): Prisma.EncounterWhereInput {
  return {
    outcome: "WIPE",
    OR: [
      { durationMs: { gt: 0, lt: SHORT_PULL_LIMIT_MS } },
      { durationMs: 0, durationSeconds: { gt: 0, lt: SHORT_PULL_LIMIT_MS / 1000 } },
    ],
    participants: { some: {}, every: { deaths: 0 } },
  };
}

export function countedAttemptWhere(
  { includeShortPulls = false }: { includeShortPulls?: boolean } = {},
): Prisma.EncounterWhereInput {
  return includeShortPulls ? {} : { NOT: shortPullWhere() };
}

/** The calling aggregate must bind its encounter table to the fixed alias e. */
export function shortPullSql() {
  return Prisma.sql`(
    e.outcome = 'WIPE'
    AND ((e."durationMs" > 0 AND e."durationMs" < ${SHORT_PULL_LIMIT_MS})
      OR (e."durationMs" = 0 AND e."durationSeconds" > 0 AND e."durationSeconds" < ${SHORT_PULL_LIMIT_MS / 1000}))
    AND EXISTS (SELECT 1 FROM participants evidence WHERE evidence."encounterId" = e.id)
    AND NOT EXISTS (SELECT 1 FROM participants evidence
      WHERE evidence."encounterId" = e.id AND evidence.deaths IS DISTINCT FROM 0)
  )`;
}
