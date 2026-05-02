"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { syncGuildRoster } from "@/lib/warmane-guild-roster";

async function verifyAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true; // no secret configured → open
  const cookieStore = await cookies();
  const provided = cookieStore.get("x-admin-secret")?.value;
  return provided === secret;
}

export async function clearDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verifyAdmin())) return { ok: false, error: "Unauthorized" };

  // Retention policy:
  //   CLEARED  – volatile upload-derived data: weekly_summaries, uploads (cascade → encounters → participants → milestones)
  //   RETAINED – persistent profile/cache data: players, armory_gear_cache, guild_roster_members, realms, guilds, bosses
  await db.weeklySummary.deleteMany();
  // Cascade path: uploads → encounters (onDelete: Cascade) → participants + milestones (onDelete: Cascade)
  await db.upload.deleteMany();

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

export async function triggerSync(
  type: "ROSTER" | "GEAR"
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  try {
    await db.syncJob.updateMany({
      where: { type, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    const job = await db.syncJob.create({
      data: { type, status: "PENDING" },
    });

    return { ok: true, jobId: job.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function syncGuildRosterFromAdmin(): Promise<
  | { ok: true; count: number; skipped?: boolean }
  | { ok: false; error: string }
> {
  if (!(await verifyAdmin())) return { ok: false, error: "Unauthorized" };

  const result = await syncGuildRoster({ force: true });
  if (!result.ok) {
    return {
      ok: false,
      error: "Roster sync is temporarily unavailable from Warmane.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/guild-roster");

  return result;
}
