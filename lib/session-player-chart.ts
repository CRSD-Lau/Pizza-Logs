import { getReportDamageTakenPerSecond, type ReportMetricView } from "./report-metric-view";
import { getRecordedDurationSeconds } from "./utils";

export const SESSION_PLAYER_METRICS = ["DPS", "HPS", "APS", "Healing + absorbs /s", "DTPS"] as const;
export type SessionPlayerMetric = typeof SESSION_PLAYER_METRICS[number];

/** Explicit choices survive navigation; role evidence only supplies the initial metric. */
export function resolveSessionPlayerMetric(value: string | string[] | undefined, view: ReportMetricView): SessionPlayerMetric {
  const choice = Array.isArray(value) ? value[0] : value;
  if (SESSION_PLAYER_METRICS.some(metric => metric === choice)) return choice as SessionPlayerMetric;
  return view === "healing" ? "Healing + absorbs /s" : view === "tank" ? "DTPS" : "DPS";
}

export function getSessionPlayerMetricLabel(metric: SessionPlayerMetric): string {
  return metric === "HPS" ? "Effective HPS" : metric;
}

export type SessionPlayerChartEncounter = {
  outcome: string;
  durationMs?: number | null;
  durationSeconds?: number | null;
  boss: { name: string };
  participants: Array<{
    dps: number | null;
    hps: number | null;
    aps?: number | null;
    damageTaken?: number | null;
    player: { name: string };
  }>;
};

export type SessionPlayerChartPoint = {
  bossName: string;
  [playerName: string]: number | string | null;
};

function recordedRate(value: number | null | undefined, hasDuration: boolean): number | null {
  return hasDuration && value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

export function buildSessionPlayerMetricChart({
  encounters,
  playerNames,
  metric,
}: {
  encounters: SessionPlayerChartEncounter[];
  playerNames: string[];
  metric: SessionPlayerMetric;
}): SessionPlayerChartPoint[] {
  return encounters
    .filter((encounter) => encounter.outcome === "KILL")
    .map((encounter) => {
      const point: SessionPlayerChartPoint = { bossName: encounter.boss.name };
      const hasDuration = getRecordedDurationSeconds(encounter) !== null;
      for (const playerName of playerNames) {
        const participant = encounter.participants.find((part) => part.player.name === playerName);
        if (!participant) {
          point[playerName] = null;
        } else if (metric === "DTPS") {
          point[playerName] = recordedRate(getReportDamageTakenPerSecond(participant.damageTaken, encounter), hasDuration);
        } else if (metric === "Healing + absorbs /s") {
          const hps = recordedRate(participant.hps, hasDuration);
          const aps = recordedRate(participant.aps, hasDuration);
          point[playerName] = hps !== null && aps !== null ? recordedRate(hps + aps, hasDuration) : null;
        } else {
          const field = metric === "DPS" ? "dps" : metric === "HPS" ? "hps" : "aps";
          point[playerName] = recordedRate(participant[field], hasDuration);
        }
      }
      return point;
    });
}
