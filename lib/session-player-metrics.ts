import type { ReportMetricView } from "./report-metric-view";

export interface SessionPlayerSummaryEntry {
  outcome: string;
  duration: number | null;
  dps: number | null;
  hps: number | null;
  aps: number | null;
  totalDamage: number | null;
  totalHealing: number | null;
  totalAbsorbs: number | null;
  damageTaken: number | null;
  deaths: number;
}

export interface SessionPlayerSummaryMetric {
  label: string;
  value: number | null;
  kind: "number" | "rate" | "integer";
  sub: string;
}

/** Preserve the report's all-pull totals/bests and equally weighted kill averages. */
export function getSessionPlayerSummaryMetrics(entries: readonly SessionPlayerSummaryEntry[], view: ReportMetricView): SessionPlayerSummaryMetric[] {
  const kills = entries.filter(entry => entry.outcome === "KILL");
  const sum = (values: readonly (number | null)[]) => values.length && values.every(value => value !== null && Number.isFinite(value))
    ? values.reduce<number>((total, value) => total + value!, 0) : null;
  const best = (values: readonly (number | null)[]) => {
    const recorded = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return recorded.length ? Math.max(...recorded) : null;
  };
  const average = (values: readonly (number | null)[]) => {
    const total = sum(values);
    return total === null ? null : total / values.length;
  };
  const combined = (healing: number | null, absorbs: number | null) => healing !== null && absorbs !== null ? healing + absorbs : null;
  const metrics: SessionPlayerSummaryMetric[] = [];
  if (view === "tank" || view === "all") {
    const timedEntries = entries.filter(entry => entry.duration !== null && Number.isFinite(entry.duration) && entry.duration > 0 && entry.damageTaken !== null && Number.isFinite(entry.damageTaken));
    const timedDamage = sum(timedEntries.map(entry => entry.damageTaken));
    const timedDuration = timedEntries.reduce((total, entry) => total + entry.duration!, 0);
    metrics.push(
      { label: "Damage taken", value: sum(entries.map(entry => entry.damageTaken)), kind: "number", sub: "all recorded pulls" },
      { label: "DTPS", value: timedDamage !== null && timedDuration > 0 ? timedDamage / timedDuration : null, kind: "rate", sub: "across pulls with recorded duration" },
    );
  }
  if (view === "damage" || view === "tank" || view === "all") {
    metrics.push(
      { label: "Damage", value: sum(entries.map(entry => entry.totalDamage)), kind: "number", sub: "all recorded pulls" },
      { label: "Best DPS", value: best(entries.map(entry => entry.dps)), kind: "rate", sub: "single pull" },
      { label: "Avg DPS", value: average(kills.map(entry => entry.dps)), kind: "rate", sub: "on kills" },
    );
  }
  if (view === "healing" || view === "all") {
    metrics.push(
      { label: "Effective healing", value: sum(entries.map(entry => entry.totalHealing)), kind: "number", sub: "all recorded pulls" },
      { label: "Best HPS", value: best(entries.map(entry => entry.hps)), kind: "rate", sub: "effective healing · single pull" },
      { label: "Avg HPS", value: average(kills.map(entry => entry.hps)), kind: "rate", sub: "effective healing · on kills" },
      { label: "Absorbs", value: sum(entries.map(entry => entry.totalAbsorbs)), kind: "number", sub: "all recorded pulls" },
      { label: "Best APS", value: best(entries.map(entry => entry.aps)), kind: "rate", sub: "single pull" },
      { label: "Healing + absorbs", value: sum(entries.map(entry => combined(entry.totalHealing, entry.totalAbsorbs))), kind: "number", sub: "all recorded pulls" },
      { label: "Best Healing + absorbs /s", value: best(entries.map(entry => combined(entry.hps, entry.aps))), kind: "rate", sub: "single pull" },
    );
  }
  metrics.push({ label: "Deaths", value: sum(entries.map(entry => entry.deaths)), kind: "integer", sub: "all recorded pulls" });
  return metrics;
}
