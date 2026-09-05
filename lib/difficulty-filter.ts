export const DIFFICULTY_FILTERS = [
  { value: "all", label: "All difficulties" },
  { value: "10N", label: "10-player normal (10N)" },
  { value: "10H", label: "10-player heroic (10H)" },
  { value: "25N", label: "25-player normal (25N)" },
  { value: "25H", label: "25-player heroic (25H)" },
  { value: "UNKNOWN", label: "Unknown difficulty" },
] as const;

export type DifficultyFilterValue = typeof DIFFICULTY_FILTERS[number]["value"];
export type ReportSearchParams = Record<string, string | string[] | undefined>;

export function parseDifficultyFilter(value: string | string[] | undefined): DifficultyFilterValue {
  const first = Array.isArray(value) ? value[0] : value;
  return DIFFICULTY_FILTERS.find(option => option.value === first)?.value ?? "all";
}

export function difficultyFilterWhere(difficulty: DifficultyFilterValue): { difficulty?: string } {
  return difficulty === "all" ? {} : { difficulty };
}

export function difficultyScopeLabel(difficulty: DifficultyFilterValue): string {
  return difficulty === "all" ? "All difficulties pooled"
    : `${DIFFICULTY_FILTERS.find(option => option.value === difficulty)!.label} only`;
}

export function reportQueryString(searchParams: ReportSearchParams, overrides: Record<string, string | null> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  for (const [key, value] of Object.entries(overrides)) {
    query.delete(key);
    if (value !== null) query.set(key, value);
  }
  return query.size ? `?${query}` : "";
}
