export interface SessionEncounterTime {
  sessionIndex: number;
  startedAt: Date | string;
}

function timestamp(value: unknown): number {
  return typeof value === "string" || value instanceof Date
    ? new Date(value).getTime()
    : NaN;
}

/** Match stored event windows to fights, including reports with older, shifted indexes. */
export function findRaidSessionAnalyticsIndex<T>(
  encounters: SessionEncounterTime[],
  analytics: Record<string, T>,
  sessionIndex: number,
): string | undefined {
  const starts = encounters.filter(encounter => encounter.sessionIndex === sessionIndex)
    .map(encounter => timestamp(encounter.startedAt));
  if (starts.length === 0 || starts.some(start => !Number.isFinite(start))) return undefined;
  const first = Math.min(...starts);
  const last = Math.max(...starts);
  const matches = Object.entries(analytics).filter(([key, value]) => {
    if (!/^\d+$/.test(key) || !value || typeof value !== "object") return false;
    const start = timestamp("startedAt" in value ? value.startedAt : undefined);
    const end = timestamp("endedAt" in value ? value.endedAt : undefined);
    return start <= first && end >= last && start <= end;
  });
  // Overlapping or missing windows cannot establish session identity safely.
  if (matches.length !== 1) return undefined;
  const [key, value] = matches[0];
  const window = value as { startedAt: unknown; endedAt: unknown };
  const start = timestamp(window.startedAt);
  const end = timestamp(window.endedAt);
  // Older encounter-only grouping could split one event window into two raids.
  // Do not display that entire window's totals independently for both groups.
  if (encounters.some(encounter => encounter.sessionIndex !== sessionIndex
    && timestamp(encounter.startedAt) >= start && timestamp(encounter.startedAt) <= end)) return undefined;
  return key;
}

export function findRaidSessionAnalytics<T>(
  encounters: SessionEncounterTime[],
  analytics: Record<string, T>,
  sessionIndex: number,
): T | undefined {
  const key = findRaidSessionAnalyticsIndex(encounters, analytics, sessionIndex);
  return key === undefined ? undefined : analytics[key];
}
