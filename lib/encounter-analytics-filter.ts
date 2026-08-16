export interface EncounterAnalyticsFilterRow {
  id: string;
  player: string;
  ability: string;
  value: string;
  occurrences: string;
}

export interface EncounterAnalyticsFilterResult {
  rows: EncounterAnalyticsFilterRow[];
  playerValid: boolean;
  abilityValid: boolean;
  combinationValid: boolean;
}

function normalizeFilterValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedQuery = normalizeFilterValue(query);
  return normalizedQuery.length === 0
    || normalizeFilterValue(value).includes(normalizedQuery);
}

export function getEncounterAnalyticsFilterOptions(
  rows: EncounterAnalyticsFilterRow[],
  field: "player" | "ability",
): string[] {
  return [...new Set(rows.map(row => row[field]))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function getContextualEncounterAnalyticsFilterOptions(
  rows: EncounterAnalyticsFilterRow[],
  field: "player" | "ability",
  oppositeQuery: string,
): string[] {
  const oppositeField = field === "player" ? "ability" : "player";
  return getEncounterAnalyticsFilterOptions(
    rows.filter(row => matchesQuery(row[oppositeField], oppositeQuery)),
    field,
  );
}

export function filterEncounterAnalyticsRows(
  rows: EncounterAnalyticsFilterRow[],
  playerQuery: string,
  abilityQuery: string,
): EncounterAnalyticsFilterResult {
  const playerOptions = getEncounterAnalyticsFilterOptions(rows, "player");
  const abilityOptions = getEncounterAnalyticsFilterOptions(rows, "ability");
  const playerValid = playerOptions.some(option => matchesQuery(option, playerQuery))
    || normalizeFilterValue(playerQuery).length === 0;
  const abilityValid = abilityOptions.some(option => matchesQuery(option, abilityQuery))
    || normalizeFilterValue(abilityQuery).length === 0;
  const filteredRows = playerValid && abilityValid
    ? rows.filter(row => (
        matchesQuery(row.player, playerQuery)
        && matchesQuery(row.ability, abilityQuery)
      ))
    : [];

  return {
    rows: filteredRows,
    playerValid,
    abilityValid,
    combinationValid: !playerValid || !abilityValid || filteredRows.length > 0,
  };
}
