import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const bossSlug   = searchParams.get("boss")       ?? undefined;
  const difficulty = searchParams.get("difficulty")  ?? undefined;
  const outcome    = searchParams.get("outcome")     ?? undefined;
  const playerName = searchParams.get("player")      ?? undefined;
  const take       = Math.min(Number(searchParams.get("take") ?? 50), 200);
  const skip       = Number(searchParams.get("skip") ?? 0);

  const encounters = await db.encounter.findMany({
    where: {
      ...(bossSlug   ? { boss: { slug: bossSlug } } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(outcome    ? { outcome: outcome as "KILL" | "WIPE" | "UNKNOWN" } : {}),
      ...(playerName ? { participants: { some: { player: { name: playerName } } } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take,
    skip,
    include: {
      boss: { select: { name: true, slug: true, raid: true, raidSlug: true } },
      upload: { select: { filename: true, realm: { select: { name: true } } } },
      participants: {
        orderBy: { dps: "desc" },
        take: 5,
        select: {
          dps:    true,
          hps:    true,
          role:   true,
          player: { select: { name: true, class: true } },
        },
      },
    },
  });

  return NextResponse.json(encounters);
}
