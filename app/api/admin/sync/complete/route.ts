import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const { jobId, success, error, result } = (body as Record<string, unknown>) ?? {};

  if (typeof jobId !== "string") {
    return NextResponse.json({ ok: false, error: "jobId required." }, { status: 400 });
  }

  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: success ? "DONE" : "FAILED",
      completedAt: new Date(),
      error: typeof error === "string" ? error : null,
      result: result !== undefined ? (result as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return NextResponse.json({ ok: true });
}
