import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const bossSlug   = searchParams.get("boss")       ?? undefined;
  const difficulty = searchParams.get("difficulty")  ?? undefined;
  const metric     = (searchParams.get("metric") ?? "dps") as "dps" | "hps";
  const take       = Math.min(Number(searchParams.get("take") ?? 25), 100);

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
    orderBy: { [field]: "desc" },
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
