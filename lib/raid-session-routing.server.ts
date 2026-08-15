import { cache } from "react";
import { db } from "@/lib/db";
import {
  buildRaidSessionRoutesWithAnalytics,
  resolveRaidSessionParam,
  type RaidSessionResolution,
  type RaidSessionRoute,
} from "@/lib/raid-session-slug";

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
  uploadId: string,
  param: string,
): Promise<RaidSessionResolution | null> {
  return resolveRaidSessionParam(param, await getRaidSessionRoutes(uploadId));
}

export async function getRaidSessionRouteByIndex(
  uploadId: string,
  sessionIndex: number,
): Promise<RaidSessionRoute | null> {
  const routes = await getRaidSessionRoutes(uploadId);
  return routes.find(route => route.sessionIndex === sessionIndex) ?? null;
}
