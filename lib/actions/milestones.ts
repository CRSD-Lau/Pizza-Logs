import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getWeekBounds } from "@/lib/utils";

interface MilestoneCheck {
  playerId: string;
  playerName: string;
  encounterId: string;
  startedAt: Date;
  bossId: string;
  bossName: string;
  difficulty: string;
  metric: "DPS" | "HPS";
  value: number;
}

export interface AwardedMilestone {
  playerName: string;
  bossName: string;
  difficulty: string;
  metric: string;
  value: number;
  rank: number;
  type: string;
}

// Share four slots across uploads, leaving capacity in the ten-connection pool
// for report reads and upload persistence. Hand queued callers the released slot.
const MILESTONE_WORKERS = 4;
let activeMilestoneWorkers = 0;
const milestoneWaiters: (() => void)[] = [];

async function withMilestoneSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeMilestoneWorkers >= MILESTONE_WORKERS) {
    await new Promise<void>(resolve => milestoneWaiters.push(resolve));
  } else {
    activeMilestoneWorkers++;
  }
  try {
    return await work();
  } finally {
    const next = milestoneWaiters.shift();
    if (next) next();
    else activeMilestoneWorkers--;
  }
}

/** Award independent all-time and current-week achievements after persistence. */
export async function computeMilestones(
  checks: MilestoneCheck[],
  database: PrismaClient = db,
  now: Date = new Date(),
): Promise<AwardedMilestone[]> {
  const week = getWeekBounds(now);
  const inWeek = (check: MilestoneCheck) => check.startedAt >= week.start && check.startedAt < week.end;
  // One best candidate for each independent award scope. Historical personal
  // bests must not discard a lower value that leads the current week.
  const candidates = new Map<string, MilestoneCheck>();
  for (const check of checks) {
    if (!Number.isFinite(check.value) || check.value <= 0) continue;
    const key = [check.playerId, check.bossId, check.difficulty, check.metric].join("\0");
    for (const scope of ["all-time", ...(inWeek(check) ? ["weekly"] : [])]) {
      const scopedKey = `${key}\0${scope}`;
      const previous = candidates.get(scopedKey);
      if (!previous || check.value > previous.value
          || (check.value === previous.value && check.encounterId < previous.encounterId)) {
        candidates.set(scopedKey, check);
      }
    }
  }
  const unique = new Map([...candidates.values()].map(check => [
    [check.encounterId, check.playerId, check.metric].join("\0"), check,
  ]));
  async function runCheck(check: MilestoneCheck): Promise<AwardedMilestone[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await database.$transaction(async tx => {
          const field = check.metric === "DPS" ? "dps" : "hps";
          const encounter = { bossId: check.bossId, difficulty: check.difficulty, outcome: "KILL" as const };
          const result: AwardedMilestone[] = [];
          const betterPersonal = await tx.participant.findFirst({
            where: { playerId: check.playerId, encounter, [field]: { gt: check.value } },
            select: { id: true },
          });
          if (!betterPersonal) {
            // At most three distinct stronger players decide podium eligibility.
            // Equal values share rank; a player's attempts never self-compete.
            const strongerPlayers = await tx.participant.groupBy({
              by: ["playerId"],
              where: { playerId: { not: check.playerId }, encounter, [field]: { gt: check.value } },
              orderBy: { playerId: "asc" }, take: 3,
            });
            const rank = strongerPlayers.length + 1;
            if (rank <= 3) {
              const award = await storeAward(tx, check, "ALL_TIME_RANK", rank, now);
              if (award) result.push(award);
            }
          }

          if (inWeek(check)) {
            const strongerWeekly = await tx.participant.findFirst({
              where: { encounter: { ...encounter, startedAt: { gte: week.start, lt: week.end } },
                [field]: { gt: check.value } },
              select: { id: true },
            });
            if (!strongerWeekly) {
              const award = await storeAward(tx, check, "WEEKLY_BEST", 1, now, week);
              if (award) result.push(award);
            }
          }
          return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
        return result;
      } catch (error) {
        // Prisma's pg adapter can surface a serialization failure at COMMIT as
        // DriverAdapterError instead of wrapping it in a P2034 request error.
        const cause = error instanceof Error && error.name === "DriverAdapterError" ? error.cause : null;
        const retryable = (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
          || (cause !== null && typeof cause === "object" && "kind" in cause && cause.kind === "TransactionWriteConflict");
        if (!retryable || attempt >= 5) throw error;
        await new Promise(resolve => setTimeout(resolve, 25 * (2 ** attempt) + Math.random() * 25));
      }
    }
  }
  // Historical and weekly maxima for one award key must retain their original
  // order. Only independent keys run concurrently; results keep input order too.
  const groups = new Map<string, { check: MilestoneCheck; index: number }[]>();
  for (const [index, check] of [...unique.values()].entries()) {
    const key = [check.playerId, check.bossId, check.difficulty, check.metric].join("\0");
    const group = groups.get(key) ?? [];
    group.push({ check, index });
    groups.set(key, group);
  }
  const batches = [...groups.values()];
  const awarded: AwardedMilestone[][] = [];
  const failures: unknown[] = [];
  let nextBatch = 0;
  const worker = async () => {
    while (!failures.length) {
      const batch = batches[nextBatch++];
      if (!batch) return;
      await withMilestoneSlot(async () => {
        for (const { check, index } of batch) {
          if (failures.length) return;
          try {
            awarded[index] = await runCheck(check);
          } catch (error) {
            failures.push(error);
            return;
          }
        }
      });
    }
  };
  // Drain active work before reporting failure; do not leave award writes running
  // after the caller has returned its saved-report warning.
  await Promise.all(Array.from({ length: Math.min(MILESTONE_WORKERS, batches.length) }, worker));
  if (failures.length) throw failures[0];
  return awarded.flat();
}

async function storeAward(
  tx: Prisma.TransactionClient,
  check: MilestoneCheck,
  type: "ALL_TIME_RANK" | "WEEKLY_BEST",
  rank: number,
  now: Date,
  week?: { start: Date; end: Date },
): Promise<AwardedMilestone | null> {
  const existing = await tx.milestone.findFirst({
    where: {
      playerId: check.playerId, bossId: check.bossId, difficulty: check.difficulty,
      metric: check.metric, type, supersededAt: null,
      ...(week ? { achievedAt: { gte: week.start, lt: week.end } } : {}),
    },
    orderBy: [{ value: "desc" }, { rank: "asc" }, { id: "asc" }],
  });
  if (existing && existing.value >= check.value && existing.rank <= rank) return null;
  if (existing) await tx.milestone.update({ where: { id: existing.id }, data: { supersededAt: now } });
  await tx.milestone.create({
    data: {
      type, rank, playerId: check.playerId, encounterId: check.encounterId,
      bossId: check.bossId, difficulty: check.difficulty, metric: check.metric,
      value: check.value, achievedAt: now,
    },
  });
  return {
    playerName: check.playerName, bossName: check.bossName, difficulty: check.difficulty,
    metric: check.metric, value: check.value, rank, type,
  };
}
