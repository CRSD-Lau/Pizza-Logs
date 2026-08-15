import { cache } from "react";
import { db } from "@/lib/db";
import {
  buildRaidSessionRoutesWithAnalytics,
  resolveRaidSessionParam,
  type RaidSessionResolution,
  type RaidSessionRoute,
} from "@/lib/raid-session-slug";

export interface RaidUploadIdentity {
  uploadId: string;
  publicSlug: string;
}

export interface ResolvedRaidSession extends RaidSessionResolution, RaidUploadIdentity {
  isLegacyUploadId: boolean;
}

export const resolveRaidUpload = cache(async (raidRef: string): Promise<RaidUploadIdentity | null> => {
  const upload = await db.upload.findFirst({
    where: {
      OR: [
        { publicSlug: raidRef },
        { id: raidRef },
      ],
    },
    select: { id: true, publicSlug: true },
  });

  return upload ? { uploadId: upload.id, publicSlug: upload.publicSlug } : null;
});

export const getRaidSessionRoutes = cache(async (uploadId: string): Promise<RaidSessionRoute[]> => {
  const upload = await db.upload.findUnique({
    where: { id: uploadId },
    select: {
      sessionAnalytics: true,
      encounters: {
        orderBy: [{ sessionIndex: "asc" }, { startedAt: "asc" }],
        select: { sessionIndex: true, startedAt: true },
      },
    },
  });
  if (!upload) return [];

  return buildRaidSessionRoutesWithAnalytics(upload.encounters, upload.sessionAnalytics);
});

export async function resolveRaidSession(
  raidRef: string,
  param: string,
): Promise<ResolvedRaidSession | null> {
  const upload = await resolveRaidUpload(raidRef);
  if (!upload) return null;

  const resolution = resolveRaidSessionParam(param, await getRaidSessionRoutes(upload.uploadId));
  if (!resolution) return null;

  return {
    ...resolution,
    ...upload,
    isLegacyUploadId: raidRef !== upload.publicSlug,
  };
}

export async function getRaidSessionRouteByIndex(
  uploadId: string,
  sessionIndex: number,
): Promise<RaidSessionRoute | null> {
  const routes = await getRaidSessionRoutes(uploadId);
  return routes.find(route => route.sessionIndex === sessionIndex) ?? null;
}
