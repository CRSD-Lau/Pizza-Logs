import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const type = (body as Record<string, unknown>)?.type;
  if (type !== "ROSTER" && type !== "GEAR") {
    return NextResponse.json(
      { ok: false, error: "type must be ROSTER or GEAR" },
      { status: 400 }
    );
  }

  // Cancel any existing PENDING jobs of the same type to avoid queue buildup
  await db.syncJob.updateMany({
    where: { type, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const job = await db.syncJob.create({
    data: { type, status: "PENDING" },
  });

  return NextResponse.json({ ok: true, jobId: job.id, type: job.type });
}
