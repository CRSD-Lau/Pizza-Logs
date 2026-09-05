import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWeekBounds } from "@/lib/utils";
import { sortByICCOrder } from "@/lib/constants/bosses";
import { weeklyAggregateQuery, type WeeklyAggregate } from "@/lib/report-aggregates";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const realmId = searchParams.get("realmId") ?? undefined;
  const includeShortPulls = parseIncludeShortPulls(searchParams.get("includeShortPulls"));

  const { start, end } = getWeekBounds();

  const [aggregates, uploads] = await Promise.all([
    db.$queryRaw<WeeklyAggregate[]>(weeklyAggregateQuery(start, end, realmId, includeShortPulls)),
    db.upload.count({
      where: {
        createdAt: { gte: start, lt: end },
        ...(realmId ? { realmId } : {}),
      },
    }),
  ]);

  const kills = aggregates.filter(e => e.outcome === "KILL");
  const wipes = aggregates.filter(e => e.outcome === "WIPE");

  // Top DPS this week
  const allParticipants = await db.participant.findMany({
    where: {
      encounter: {
        startedAt: { gte: start, lt: end },
        ...(realmId ? { upload: { realmId } } : {}),
      },
      dps: { gt: 0 },
    },
    orderBy: [{ dps: "desc" }, { id: "asc" }],
    take: 10,
    select: {
      dps: true,
      player: { select: { name: true, class: true } },
      encounter: {
        select: {
          difficulty: true,
          boss: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const topHps = await db.participant.findMany({
    where: {
      encounter: {
        startedAt: { gte: start, lt: end },
        ...(realmId ? { upload: { realmId } } : {}),
      },
      hps: { gt: 100 },
    },
    orderBy: [{ hps: "desc" }, { id: "asc" }],
    take: 10,
    select: {
      hps: true,
      player: { select: { name: true, class: true } },
      encounter: {
        select: {
          difficulty: true,
          boss: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const bossKills = sortByICCOrder(
    kills.map(({ name, slug, raid, count }) => ({ name, slug, raid, kills: count })),
    boss => boss.name,
  );

  return NextResponse.json({
    weekStart:    start.toISOString(),
    weekEnd:      end.toISOString(),
    totalKills:   kills.reduce((total, row) => total + row.count, 0),
    totalWipes:   wipes.reduce((total, row) => total + row.count, 0),
    shortPullCount: aggregates.reduce((total, row) => total + row.shortPullCount, 0),
    totalUploads: uploads,
    topDps:       allParticipants.map(p => ({
      playerName: p.player.name,
      class:      p.player.class,
      bossName:   p.encounter.boss.name,
      bossSlug:   p.encounter.boss.slug,
      difficulty: p.encounter.difficulty,
      dps:        p.dps,
    })),
    topHps: topHps.map(p => ({
      playerName: p.player.name,
      class:      p.player.class,
      bossName:   p.encounter.boss.name,
      bossSlug:   p.encounter.boss.slug,
      difficulty: p.encounter.difficulty,
      hps:        p.hps,
    })),
    bossKills,
  });
}
