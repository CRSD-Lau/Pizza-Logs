import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EncounterQuerySchema } from "@/lib/api-query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const query = EncounterQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid encounter filters or pagination." }, { status: 400 });
  const { boss: bossSlug, difficulty, outcome, player: playerName, take, skip } = query.data;

  const encounters = await db.encounter.findMany({
    where: {
      ...(bossSlug   ? { boss: { slug: bossSlug } } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(outcome    ? { outcome } : {}),
      ...(playerName ? { participants: { some: { player: { name: playerName } } } } : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    take,
    skip,
    include: {
      boss: { select: { name: true, slug: true, raid: true, raidSlug: true } },
      // Original filenames are operational metadata and can contain private labels.
      upload: { select: { realm: { select: { name: true } } } },
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
