import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const encounter = await db.encounter.findUnique({
    where: { id },
    include: {
      boss: true,
      upload: {
        select: {
          filename: true,
          guild:    { select: { name: true } },
          realm:    { select: { name: true, host: true } },
        },
      },
      participants: {
        orderBy: { dps: "desc" },
        include: { player: true },
      },
      milestones: {
        where: { supersededAt: null },
        include: { player: { select: { name: true } } },
      },
    },
  });

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(encounter);
}
