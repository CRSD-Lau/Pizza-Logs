import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeaderboardQuerySchema } from "@/lib/api-query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const query = LeaderboardQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid leaderboard filters or pagination." }, { status: 400 });
  const { boss: bossSlug, difficulty, metric, take } = query.data;

  const field = metric === "hps" ? "hps" : "dps";

  const rows = await db.participant.findMany({
    where: {
      [field]: { gt: metric === "hps" ? 100 : 0 },
      encounter: {
        ...(bossSlug   ? { boss: { slug: bossSlug } } : {}),
        ...(difficulty ? { difficulty } : {}),
        outcome: "KILL",
      },
    },
    orderBy: [{ [field]: "desc" }, { playerId: "asc" }, { id: "asc" }],
    take,
    distinct: ["playerId"],
    include: {
      player: { select: { name: true, class: true } },
      encounter: {
        select: {
          id:              true,
          difficulty:      true,
          durationSeconds: true,
          startedAt:       true,
          boss:            { select: { name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json(
    rows.map((r, i) => ({
      rank:        i + 1,
      playerName:  r.player.name,
      class:       r.player.class,
      value:       (r as Record<string, unknown>)[field] as number,
      bossName:    r.encounter.boss.name,
      bossSlug:    r.encounter.boss.slug,
      difficulty:  r.encounter.difficulty,
      duration:    r.encounter.durationSeconds,
      date:        r.encounter.startedAt,
      encounterId: r.encounter.id,
    }))
  );
}
