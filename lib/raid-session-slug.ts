import { findRaidSessionAnalyticsIndex } from "./raid-session-analytics";

export interface RaidSessionStart {
  sessionIndex: number;
  startedAt: Date | string;
}

export interface RaidSessionRoute {
  sessionIndex: number;
  startedAt: Date;
  dateSlug: string;
  slug: string;
  dateOrdinal: number;
  legacySlug?: string;
  analyticsIndex?: string;
}

export interface RaidSessionResolution {
  route: RaidSessionRoute;
  isLegacyIndex: boolean;
  isLegacyDateSlug?: boolean;
}

const LEGACY_SESSION_INDEX = /^\d+$/;

export function buildRaidSessionRoutes(starts: RaidSessionStart[]): RaidSessionRoute[] {
  const earliestStartBySession = new Map<number, Date>();

  for (const start of starts) {
    if (!Number.isInteger(start.sessionIndex) || start.sessionIndex < 0) continue;

    const startedAt = start.startedAt instanceof Date
      ? new Date(start.startedAt.getTime())
      : new Date(start.startedAt);
    if (Number.isNaN(startedAt.getTime())) continue;

    const previous = earliestStartBySession.get(start.sessionIndex);
    if (!previous || startedAt.getTime() < previous.getTime()) {
      earliestStartBySession.set(start.sessionIndex, startedAt);
    }
  }

  const dateCounts = new Map<string, number>();

  return Array.from(earliestStartBySession.entries())
    .sort(([left], [right]) => left - right)
    .map(([sessionIndex, startedAt]) => {
      const dateSlug = startedAt.toISOString().slice(0, 10);
      const dateOrdinal = (dateCounts.get(dateSlug) ?? 0) + 1;
      dateCounts.set(dateSlug, dateOrdinal);

      return {
        sessionIndex,
        startedAt,
        dateSlug,
        slug: dateOrdinal === 1 ? dateSlug : `${dateSlug}-${dateOrdinal}`,
        dateOrdinal,
      };
    });
}

export function buildRaidSessionRoutesWithAnalytics(
  starts: RaidSessionStart[],
  sessionAnalytics: unknown,
): RaidSessionRoute[] {
  const combinedStarts = [...starts];
  const legacyStarts = [...starts];
  const analyticsIndexBySession = new Map<number, string>();
  const sessionIndexes = new Set(
    starts
      .filter(start => Number.isInteger(start.sessionIndex) && start.sessionIndex >= 0)
      .map(start => start.sessionIndex),
  );

  if (sessionAnalytics && typeof sessionAnalytics === "object" && !Array.isArray(sessionAnalytics)) {
    for (const [sessionIndexValue, analytics] of Object.entries(sessionAnalytics)) {
      if (!/^\d+$/.test(sessionIndexValue) || !analytics || typeof analytics !== "object") continue;
      const sessionIndex = Number(sessionIndexValue);
      if (!sessionIndexes.has(sessionIndex)) continue;
      const startedAt = "startedAt" in analytics ? analytics.startedAt : undefined;
      if (typeof startedAt !== "string" && !(startedAt instanceof Date)) continue;

      legacyStarts.push({
        sessionIndex,
        startedAt,
      });
    }

    for (const sessionIndex of sessionIndexes) {
      const analyticsMap = sessionAnalytics as Record<string, unknown>;
      const analyticsIndex = findRaidSessionAnalyticsIndex(starts, analyticsMap, sessionIndex);
      if (analyticsIndex === undefined) continue;
      const analytics = analyticsMap[analyticsIndex];
      if (!analytics || typeof analytics !== "object" || !("startedAt" in analytics)) continue;
      const startedAt = analytics.startedAt;
      if (typeof startedAt === "string" || startedAt instanceof Date) {
        combinedStarts.push({ sessionIndex, startedAt });
        analyticsIndexBySession.set(sessionIndex, analyticsIndex);
      }
    }
  }

  const legacyByIndex = new Map(buildRaidSessionRoutes(legacyStarts).map(route => [route.sessionIndex, route.slug]));
  return buildRaidSessionRoutes(combinedStarts).map(route => {
    const legacySlug = legacyByIndex.get(route.sessionIndex);
    const analyticsIndex = analyticsIndexBySession.get(route.sessionIndex);
    return {
      ...route,
      ...(analyticsIndex !== undefined ? { analyticsIndex } : {}),
      ...(legacySlug && legacySlug !== route.slug ? { legacySlug } : {}),
    };
  });
}

export function resolveRaidSessionParam(
  param: string,
  routes: RaidSessionRoute[],
): RaidSessionResolution | null {
  if (LEGACY_SESSION_INDEX.test(param)) {
    const sessionIndex = Number(param);
    const route = routes.find(candidate => candidate.sessionIndex === sessionIndex);
    return route ? { route, isLegacyIndex: true } : null;
  }

  const route = routes.find(candidate => candidate.slug === param);
  if (route) return { route, isLegacyIndex: false };
  const legacyRoutes = routes.filter(candidate => candidate.legacySlug === param);
  return legacyRoutes.length === 1
    ? { route: legacyRoutes[0], isLegacyIndex: false, isLegacyDateSlug: true }
    : null;
}

export function formatRaidDateLabel(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function formatRaidSessionTitle(route: RaidSessionRoute): string {
  const suffix = route.dateOrdinal > 1 ? ` ${route.dateOrdinal}` : "";
  return `${formatRaidDateLabel(route.startedAt)} Raid${suffix}`;
}

export function getRaidSessionPath(publicReportSlug: string, route: RaidSessionRoute): string {
  return `/raids/${publicReportSlug}/sessions/${route.slug}`;
}
