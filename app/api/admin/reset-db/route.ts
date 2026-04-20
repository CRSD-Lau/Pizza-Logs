import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  await db.milestone.deleteMany();
  await db.participant.deleteMany();
  await db.encounter.deleteMany();
  await db.upload.deleteMany();
  await db.player.deleteMany();
  await db.guild.deleteMany();
  await db.realm.deleteMany();
  return NextResponse.json({ ok: true, msg: "DB cleared" });
}
