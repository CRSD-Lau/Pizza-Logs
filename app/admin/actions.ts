"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function clearDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  // Re-verify admin secret server-side — don't just trust middleware ran
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const cookieStore = await cookies();
    const provided = cookieStore.get("x-admin-secret")?.value;
    if (provided !== secret) {
      return { ok: false, error: "Unauthorized" };
    }
  }

  await db.milestone.deleteMany();
  await db.participant.deleteMany();
  await db.encounter.deleteMany();
  await db.upload.deleteMany();
  await db.player.deleteMany();

  return { ok: true };
}
