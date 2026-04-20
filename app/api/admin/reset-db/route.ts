import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-reset-secret") !== "pizza-reset-now") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.milestone.deleteMany();
  await db.participant.deleteMany();
  await db.encounter.deleteMany();
  await db.upload.deleteMany();
  await db.player.deleteMany();
  return NextResponse.json({ ok: true, message: "DB cleared" });
}
