import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-reset-secret");
  if (secret !== "pizza-reset-now") {
    return new Response("Forbidden", { status: 403 });
  }

  await db.milestone.deleteMany();
  await db.participant.deleteMany();
  await db.encounter.deleteMany();
  await db.upload.deleteMany();
  await db.guild.deleteMany();
  await db.player.deleteMany();
  await db.realm.deleteMany();

  return Response.json({ ok: true, message: "DB cleared" });
}
