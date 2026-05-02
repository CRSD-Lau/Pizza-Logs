import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const agentId = req.headers.get("x-agent-id") ?? "unknown";

  const job = await db.syncJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { triggeredAt: "asc" },
  });

  if (!job) return NextResponse.json({ ok: true, job: null });

  // Atomic claim: update only succeeds if status is still PENDING
  const claimed = await db.syncJob
    .update({
      where: { id: job.id, status: "PENDING" },
      data: { status: "IN_PROGRESS", startedAt: new Date(), agentId },
    })
    .catch(() => null);

  if (!claimed) return NextResponse.json({ ok: true, job: null });

  return NextResponse.json({ ok: true, job: { id: claimed.id, type: claimed.type } });
}
