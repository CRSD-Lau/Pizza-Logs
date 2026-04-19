import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWeekBounds } from "@/lib/utils";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const realmId = searchParams.get("realmId") ?? undefined;

  const { start, end } = getWeekBounds();

  const [encounters, uploads] = await Promise.all([
    db.encounter.findMany({
      where: {
        startedAt: { gte: start, lt: end },
        ...(realmId ? { upload: { realmId } } : {}),
      },
      include: {
        boss: { select: { name: true, slug: true, raid: true } },
        participants: {
          orderBy: { dps: "desc" },
          take: 1,
          include: { player: { select: { name: true, class: true } } },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
    db.upload.count({
      where: {
        createdAt: { gte: start, lt: end },
        ...(realmId ? { realmId } : {}),
      },
    }),
  ]);

  const kills = encounters.filter(e => e.outcome === "KILL");
  const wipes = encounters.filter(e => e.outcome === "WIPE");

  // Top DPS this week
  const allParticipants = await db.participant.findMany({
    where: {
      encounter: {
        startedAt: { gte: start, lt: end },
        ...(realmId ? { upload: { realmId } } : {}),
      },
      dps: { gt: 0 },
    },
    orderBy: { dps: "desc" },
    take: 10,
    include: {
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
    orderBy: { hps: "desc" },
    take: 10,
    include: {
      player: { select: { name: true, class: true } },
      encounter: {
        select: {
          difficulty: true,
          boss: { select: { name: true, slug: true } },
        },
      },
    },
  });

  // Boss kill counts
  const bossKills = Object.values(
    kills.reduce<Record<string, { name: string; slug: string; raid: string; kills: number }>>((acc, enc) => {
      const key = enc.boss.slug;
      if (!acc[key]) acc[key] = { name: enc.boss.name, slug: enc.boss.slug, raid: enc.boss.raid, kills: 0 };
      acc[key].kills++;
      return acc;
    }, {})
  ).sort((a, b) => b.kills - a.kills);

  return NextResponse.json({
    weekStart:    start.toISOString(),
    weekEnd:      end.toISOString(),
    totalKills:   kills.length,
    totalWipes:   wipes.length,
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
