"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getWarmaneCharacterGear } from "@/lib/warmane-armory";

async function verifyAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true; // no secret configured → open
  const cookieStore = await cookies();
  const provided = cookieStore.get("x-admin-secret")?.value;
  return provided === secret;
}

export async function clearDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verifyAdmin())) return { ok: false, error: "Unauthorized" };

  await db.milestone.deleteMany();
  await db.participant.deleteMany();
  await db.encounter.deleteMany();
  await db.upload.deleteMany();
  await db.player.deleteMany();

  return { ok: true };
}

export async function deleteUpload(
  uploadId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verifyAdmin())) return { ok: false, error: "Unauthorized" };

  // Delete in FK order: milestones → participants → encounters → upload
  // Players are shared across uploads; only delete players that have no remaining
  // participants after we remove this upload's data.
  const enc = await db.encounter.findMany({
    where:  { uploadId },
    select: { id: true },
  });
  const encIds = enc.map(e => e.id);

  await db.milestone.deleteMany({ where: { encounterId: { in: encIds } } });
  await db.participant.deleteMany({ where: { encounterId: { in: encIds } } });
  await db.encounter.deleteMany({ where: { uploadId } });
  await db.upload.delete({ where: { id: uploadId } });

  return { ok: true };
}

export async function seedArmoryGearCache(
  limit = 25,
): Promise<{ ok: true; attempted: number; cached: number; failed: number } | { ok: false; error: string }> {
  if (!(await verifyAdmin())) return { ok: false, error: "Unauthorized" };

  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const players = await db.player.findMany({
    orderBy: { name: "asc" },
    take: safeLimit,
    include: { realm: { select: { name: true } } },
  });

  let cached = 0;
  let failed = 0;

  for (const player of players) {
    const result = await getWarmaneCharacterGear(player.name, player.realm?.name ?? "Lordaeron");
    if (result.ok && !result.stale) {
      cached++;
    } else {
      failed++;
    }
  }

  return {
    ok: true,
    attempted: players.length,
    cached,
    failed,
  };
}
