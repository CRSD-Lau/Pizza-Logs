import { getRecordedDurationSeconds } from "./utils";

export type ReportMetricView = "damage" | "healing" | "tank" | "all";

export interface ReportRoleEvidence {
  role?: string | null;
  spec?: string | null;
}

const roleViews: Readonly<Record<string, Exclude<ReportMetricView, "all">>> = {
  DPS: "damage", HEALER: "healing", TANK: "tank",
};

// Only recorded, unambiguous specializations supply missing role evidence.
// Feral and Death Knight specializations can span tank/damage roles in WotLK.
const specViews: Readonly<Record<string, Exclude<ReportMetricView, "all">>> = {
  holy: "healing", discipline: "healing", restoration: "healing", protection: "tank",
  balance: "damage", "beast mastery": "damage", marksmanship: "damage", survival: "damage",
  arcane: "damage", fire: "damage", retribution: "damage", shadow: "damage",
  assassination: "damage", combat: "damage", subtlety: "damage", elemental: "damage",
  enhancement: "damage", affliction: "damage", demonology: "damage", destruction: "damage",
  arms: "damage", fury: "damage",
  "balance druid": "damage",
  "restoration druid": "healing",
  "beast mastery hunter": "damage", "marksmanship hunter": "damage", "survival hunter": "damage",
  "arcane mage": "damage", "fire mage": "damage", "frost mage": "damage",
  "holy paladin": "healing", "protection paladin": "tank", "retribution paladin": "damage",
  "discipline priest": "healing", "holy priest": "healing", "shadow priest": "damage",
  "assassination rogue": "damage", "combat rogue": "damage", "subtlety rogue": "damage",
  "elemental shaman": "damage", "enhancement shaman": "damage", "restoration shaman": "healing",
  "affliction warlock": "damage", "demonology warlock": "damage", "destruction warlock": "damage",
  "arms warrior": "damage", "fury warrior": "damage", "protection warrior": "tank",
};

/** A scope only gets a focused default when every row has consistent evidence. */
export function getReportMetricView(evidence: readonly ReportRoleEvidence[]): ReportMetricView {
  let selected: ReportMetricView | undefined;
  for (const item of evidence) {
    const roleKey = item.role?.trim().toUpperCase() ?? "";
    const specKey = item.spec?.trim().toLowerCase() ?? "";
    const role = Object.hasOwn(roleViews, roleKey) ? roleViews[roleKey] : undefined;
    const spec = Object.hasOwn(specViews, specKey) ? specViews[specKey] : undefined;
    if (role && spec && role !== spec) return "all";
    const view = role ?? spec;
    if (!view || (selected && selected !== view)) return "all";
    selected = view;
  }
  return selected ?? "all";
}

export function parseShowAllMetrics(value?: string | string[]): boolean {
  return (Array.isArray(value) ? value[0] : value) === "all";
}

export function getReportRoleLabel(evidence: ReportRoleEvidence): string {
  const labels = { DPS: "Damage", HEALER: "Healing", TANK: "Tank", UNKNOWN: "Unknown" };
  const roleKey = evidence.role?.trim().toUpperCase() ?? "";
  return Object.hasOwn(labels, roleKey) ? labels[roleKey as keyof typeof labels] : "Unknown";
}

export function getReportDamageTakenPerSecond(
  amount: number | null | undefined,
  duration: { durationMs?: number | null; durationSeconds?: number | null },
): number | null {
  const seconds = getRecordedDurationSeconds(duration);
  return amount != null && Number.isFinite(amount) && amount >= 0 && seconds !== null
    ? amount / seconds : null;
}
