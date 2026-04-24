"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";

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
