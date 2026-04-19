"use server";

import { db } from "@/lib/db";

const MILESTONE_RANKS = [1, 3, 5, 10, 25, 50, 100] as const;

interface MilestoneCheck {
  playerId:    string;
  playerName:  string;
  encounterId: string;
  bossId:      string;
  bossName:    string;
  difficulty:  string;
  metric:      "DPS" | "HPS";
  value:       number;
}

export interface AwardedMilestone {
  playerName: string;
  bossName:   string;
  difficulty: string;
  metric:     string;
  value:      number;
  rank:       number;
  type:       string;
}

/**
 * After inserting participants, call this to compute and store milestone records.
 * Returns newly awarded milestones for display in the upload response.
 */
export async function computeMilestones(
  checks: MilestoneCheck[]
): Promise<AwardedMilestone[]> {
  const awarded: AwardedMilestone[] = [];

  for (const check of checks) {
    if (check.value <= 0) continue;

    const field = check.metric === "DPS" ? "dps" : "hps";

    // Fetch current all-time top 100 for this boss/difficulty/metric
    const top100 = await db.participant.findMany({
      where: {
        encounter: {
          bossId:     check.bossId,
          difficulty: check.difficulty,
        },
        [field]: { gt: 0 },
      },
      orderBy: { [field]: "desc" },
      take: 100,
      select: { id: true, [field]: true, playerId: true, encounterId: true },
    });

    // Find where this value would rank
    const rank = top100.findIndex(p => (p as Record<string, unknown>)[field] as number < check.value) + 1 || top100.length + 1;

    if (rank > 100) continue; // Not top 100, skip

    // Determine milestone type bracket
    const bracket = MILESTONE_RANKS.find(r => rank <= r);
    if (!bracket) continue;

    // Check if player already has a milestone at the same or better rank
    const existing = await db.milestone.findFirst({
      where: {
        playerId:   check.playerId,
        bossId:     check.bossId,
        difficulty: check.difficulty,
        metric:     check.metric,
        supersededAt: null,
      },
      orderBy: { rank: "asc" },
    });

    // Supersede if new rank is better
    if (existing && existing.rank <= rank && existing.value >= check.value) {
      continue; // No improvement
    }

    if (existing) {
      await db.milestone.update({
        where: { id: existing.id },
        data:  { supersededAt: new Date() },
      });
    }

    await db.milestone.create({
      data: {
        type:       "ALL_TIME_RANK",
        rank,
        playerId:   check.playerId,
        encounterId:check.encounterId,
        bossId:     check.bossId,
        difficulty: check.difficulty,
        metric:     check.metric,
        value:      check.value,
      },
    });

    // Weekly milestone
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weeklyBest = await db.participant.findFirst({
      where: {
        encounter: {
          bossId:     check.bossId,
          difficulty: check.difficulty,
          startedAt: { gte: weekStart },
        },
        [field]: { gt: 0 },
      },
      orderBy: { [field]: "desc" },
      take: 1,
    });

    if (!weeklyBest || (weeklyBest as Record<string, unknown>)[field] as number <= check.value) {
      const existingWeekly = await db.milestone.findFirst({
        where: {
          playerId:   check.playerId,
          bossId:     check.bossId,
          difficulty: check.difficulty,
          metric:     check.metric,
          type:       "WEEKLY_BEST",
          supersededAt: null,
          achievedAt: { gte: weekStart },
        },
      });
      if (!existingWeekly) {
        await db.milestone.create({
          data: {
            type:       "WEEKLY_BEST",
            rank:       1,
            playerId:   check.playerId,
            encounterId:check.encounterId,
            bossId:     check.bossId,
            difficulty: check.difficulty,
            metric:     check.metric,
            value:      check.value,
          },
        });
      }
    }

    awarded.push({
      playerName: check.playerName,
      bossName:   check.bossName,
      difficulty: check.difficulty,
      metric:     check.metric,
      value:      check.value,
      rank,
      type:       "ALL_TIME_RANK",
    });
  }

  return awarded;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysToWed = day < 3 ? day + 4 : day - 3;
  d.setUTCDate(d.getUTCDate() - daysToWed);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}
