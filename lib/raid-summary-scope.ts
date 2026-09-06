export type RaidSummaryScope = "all" | "kills";

/** Only the explicit kills scope changes the default all-attempt summary. */
export function parseRaidSummaryScope(value: unknown): RaidSummaryScope {
  return value === "kills" ? "kills" : "all";
}

/** Keep report navigation canonical while preserving the independent count toggle. */
export function buildRaidSummaryQuery(scope: RaidSummaryScope, includeShortPulls: boolean): string {
  const params = new URLSearchParams();
  if (scope === "kills") params.set("scope", "kills");
  if (includeShortPulls) params.set("includeShortPulls", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}
