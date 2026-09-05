import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";
import { countedAttemptWhere, shortPullWhere } from "@/lib/attempt-policy.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const { name } = await params;
  const decodedName = name;
  const includeShortPulls = parseIncludeShortPulls(new URL(request.url).searchParams.get("includeShortPulls"));

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

  const counted = countedAttemptWhere({ includeShortPulls });
  const [totals, killCount, wipeCount, shortPullCount, totalEncounters] = await Promise.all([
    db.participant.aggregate({ where: { playerId: player.id },
      _count: true, _sum: { totalDamage: true, totalHealing: true, totalAbsorbs: true, deaths: true },
      _avg: { dps: true, aps: true } }),
    db.participant.count({ where: { playerId: player.id, encounter: { outcome: "KILL" } } }),
    db.participant.count({ where: { playerId: player.id, encounter: { outcome: "WIPE", ...counted } } }),
    db.participant.count({ where: { playerId: player.id, encounter: shortPullWhere() } }),
    db.participant.count({ where: { playerId: player.id, encounter: counted } }),
  ]);

  return NextResponse.json({
    player,
    stats: {
      totalEncounters,
      totalRecordedEncounters: totals._count,
      killCount,
      wipeCount,
      shortPullCount,
      totalDamage: totals._sum.totalDamage ?? 0,
      totalHealing: totals._sum.totalHealing ?? 0,
      totalAbsorbs: totals._sum.totalAbsorbs ?? 0,
      totalDeaths: totals._sum.deaths ?? 0,
      avgDps: Math.round(totals._avg.dps ?? 0),
      avgAps: Math.round(totals._avg.aps ?? 0),
    },
    recentParticipation: participants.slice(0, 20),
    milestones: player.milestones,
  });
}
