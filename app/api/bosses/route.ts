import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const raidSlug  = searchParams.get("raid") ?? undefined;
  const realmId   = searchParams.get("realmId") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;

  // Fetch all bosses with encounter counts and best DPS
  const bosses = await db.boss.findMany({
    where: raidSlug ? { raidSlug } : undefined,
    orderBy: { sortOrder: "asc" },
    include: {
      encounters: {
        where: {
          ...(difficulty ? { difficulty } : {}),
          ...(realmId    ? { upload: { realmId } } : {}),
        },
        select: {
          id:              true,
          outcome:         true,
          difficulty:      true,
          durationSeconds: true,
          participants: {
            orderBy: { dps: "desc" },
            take: 1,
            select: { dps: true, player: { select: { name: true } } },
          },
        },
      },
    },
  });

  const result = bosses.map(boss => {
    const kills = boss.encounters.filter(e => e.outcome === "KILL");
    const wipes = boss.encounters.filter(e => e.outcome === "WIPE");
    const bestDps = boss.encounters.reduce<{ dps: number; playerName: string } | null>(
      (best, enc) => {
        const top = enc.participants[0];
        if (!top) return best;
        if (!best || top.dps > best.dps) return { dps: top.dps, playerName: top.player.name };
        return best;
      },
      null
    );
    const fastestKill = kills.reduce<number | null>(
      (min, enc) => min === null ? enc.durationSeconds : Math.min(min, enc.durationSeconds),
      null
    );

    return {
      id:          boss.id,
      name:        boss.name,
      slug:        boss.slug,
      raid:        boss.raid,
      raidSlug:    boss.raidSlug,
      killCount:   kills.length,
      wipeCount:   wipes.length,
      totalPulls:  boss.encounters.length,
      bestDps,
      fastestKill,
    };
  });

  return NextResponse.json(result);
}
