import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const player = await db.player.findFirst({
    where: { name: decodedName },
    include: {
      milestones: {
        where: { supersededAt: null },
        orderBy: { rank: "asc" },
        include: { encounter: { include: { boss: true } } },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Recent participation
  const participants = await db.participant.findMany({
    where: { playerId: player.id },
    orderBy: { encounter: { startedAt: "desc" } },
    take: 50,
    include: {
      encounter: {
        include: {
          boss: { select: { name: true, slug: true, raid: true } },
        },
      },
    },
  });

  // Best DPS per boss
  const bestDpsPerBoss = await db.participant.groupBy({
    by: ["encounterId"],
    where: { playerId: player.id, dps: { gt: 0 } },
    _max: { dps: true },
  });

  // Best HPS per boss
  const bestHpsPerBoss = await db.participant.groupBy({
    by: ["encounterId"],
    where: { playerId: player.id, hps: { gt: 100 } },
    _max: { hps: true },
  });

  const totalDamage   = participants.reduce((a, p) => a + p.totalDamage, 0);
  const totalHealing  = participants.reduce((a, p) => a + p.totalHealing, 0);
  const totalDeaths   = participants.reduce((a, p) => a + p.deaths, 0);
  const killCount     = participants.filter(p => p.encounter.outcome === "KILL").length;
  const avgDps        = participants.length > 0
    ? participants.reduce((a, p) => a + p.dps, 0) / participants.length : 0;

  return NextResponse.json({
    player,
    stats: {
      totalEncounters: participants.length,
      killCount,
      wipeCount:  participants.length - killCount,
      totalDamage,
      totalHealing,
      totalDeaths,
      avgDps:     Math.round(avgDps),
    },
    recentParticipation: participants.slice(0, 20),
    milestones: player.milestones,
  });
}
