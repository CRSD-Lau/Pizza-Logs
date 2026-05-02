import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [lastRoster, lastGear, pendingCount, inProgressJob] = await Promise.all([
    db.syncJob.findFirst({
      where: { type: "ROSTER", status: { in: ["DONE", "FAILED"] } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true, error: true, result: true, agentId: true },
    }),
    db.syncJob.findFirst({
      where: { type: "GEAR", status: { in: ["DONE", "FAILED"] } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true, error: true, result: true, agentId: true },
    }),
    db.syncJob.count({ where: { status: "PENDING" } }),
    db.syncJob.findFirst({
      where: { status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { type: true, startedAt: true, agentId: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    roster: lastRoster ?? null,
    gear: lastGear ?? null,
    pendingCount,
    inProgress: inProgressJob ?? null,
  });
}
