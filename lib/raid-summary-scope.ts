export type RaidSummaryScope = "all" | "kills";
export type RaidMetricView = "damage" | "healing" | "all";

export function parseRaidMetricView(value: unknown): RaidMetricView {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "healing" || first === "all" ? first : "damage";
}

/** Only the explicit kills scope changes the default all-attempt summary. */
export function parseRaidSummaryScope(value: unknown): RaidSummaryScope {
  return value === "kills" ? "kills" : "all";
}

/** Keep report navigation canonical while preserving the independent count toggle. */
export function buildRaidSummaryQuery(scope: RaidSummaryScope, includeShortPulls: boolean, metricView: RaidMetricView = "damage"): string {
  const params = new URLSearchParams();
  if (scope === "kills") params.set("scope", "kills");
  if (includeShortPulls) params.set("includeShortPulls", "1");
  if (metricView !== "damage") params.set("raidMetrics", metricView);
  const query = params.toString();
  return query ? `?${query}` : "";
}
