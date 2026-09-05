export interface SessionPlayerRow {
  name: string;
  href: string | null;
  color: string;
  totalDamage: number;
  dps: number | null;
  heal: number;
  healPerSecond: number | null;
  damageTaken: number;
  dtps: number | null;
}

export type SessionPlayerSortKey = "name" | "totalDamage" | "dps" | "heal"
  | "healPerSecond" | "damageTaken" | "dtps";
export type SessionPlayerSortDirection = "asc" | "desc";
export interface SessionPlayerSort {
  key: SessionPlayerSortKey;
  direction: SessionPlayerSortDirection;
}

export function nextSessionPlayerSort(
  current: SessionPlayerSort,
  key: SessionPlayerSortKey,
): SessionPlayerSort {
  return {
    key,
    direction: current.key === key
      ? current.direction === "asc" ? "desc" : "asc"
      : key === "name" ? "asc" : "desc",
  };
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" })
    || (left < right ? -1 : left > right ? 1 : 0);
}

/** Sort raw values; missing rates remain last in either direction. */
export function sortSessionPlayers(
  rows: readonly SessionPlayerRow[],
  { key, direction }: SessionPlayerSort,
): SessionPlayerRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (key === "name") return sign * compareNames(left.name, right.name);
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue === null || rightValue === null) {
      if (leftValue !== rightValue) return leftValue === null ? 1 : -1;
    } else {
      const difference = sign * (leftValue - rightValue);
      if (difference !== 0) return difference;
    }
    return compareNames(left.name, right.name);
  });
}
