import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bossAggregateQuery, type BossAggregate } from "@/lib/report-aggregates";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const raidSlug  = searchParams.get("raid") ?? undefined;
  const realmId   = searchParams.get("realmId") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;
  const includeShortPulls = parseIncludeShortPulls(searchParams.get("includeShortPulls"));

  // Transfer one aggregate per boss, independent of historical encounter count.
  const [bosses, aggregates] = await Promise.all([
    db.boss.findMany({
      where: raidSlug ? { raidSlug } : undefined,
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, raid: true, raidSlug: true },
    }),
    db.$queryRaw<BossAggregate[]>(bossAggregateQuery({ raidSlug, realmId, difficulty, includeShortPulls })),
  ]);
  const byBoss = new Map(aggregates.map(row => [row.bossId, row]));

  const result = bosses.map(boss => {
    const totals = byBoss.get(boss.id);

    return {
      id:          boss.id,
      name:        boss.name,
      slug:        boss.slug,
      raid:        boss.raid,
      raidSlug:    boss.raidSlug,
      killCount:   totals?.killCount ?? 0,
      wipeCount:   totals?.wipeCount ?? 0,
      totalPulls:  totals?.totalPulls ?? 0,
      shortPullCount: totals?.shortPullCount ?? 0,
      // As before, the best DPS includes kills, wipes and unknown outcomes.
      bestDps:     totals?.dps != null && totals.playerName != null
        ? { dps: totals.dps, playerName: totals.playerName } : null,
      fastestKill: totals?.fastestKill ?? null,
    };
  });

  return NextResponse.json(result);
}
