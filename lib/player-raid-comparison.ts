import { formatDateUtc, getRecordedDurationSeconds } from "@/lib/utils";
import { WOTLK_BOSSES } from "@/lib/constants/bosses";
import { DIFFICULTY_FILTERS } from "@/lib/difficulty-filter";
import { getReportMetricView } from "@/lib/report-metric-view";

export const RAID_COMPARISON_METRICS = {
  DPS: { key: "dps", label: "DPS", description: "Damage per second" },
  HPS: { key: "hps", label: "HPS", description: "Effective healing per second, excluding absorbs" },
  APS: { key: "aps", label: "APS", description: "Attributed absorbs per second" },
  HA: { key: "ha", label: "Healing + absorbs /s", description: "Effective healing plus attributed absorbs per second" },
  DTPS: { key: "dtps", label: "DTPS", description: "Damage taken per second; assignments and fight conditions affect this value" },
} as const;
export type RaidComparisonMetric = keyof typeof RAID_COMPARISON_METRICS;

export function resolveRaidComparisonMetric(value: string | null, runs: RaidComparisonRun[]): RaidComparisonMetric {
  if (value && Object.hasOwn(RAID_COMPARISON_METRICS, value)) return value as RaidComparisonMetric;
  const view = getReportMetricView(runs.flatMap(run => run.fights));
  return view === "healing" ? "HA" : view === "tank" ? "DTPS" : "DPS";
}

export interface RaidComparisonScope {
  raidSlug: string;
  raidName: string;
  difficulty: string;
}

export interface RaidComparisonSession {
  key: string;
  label: string;
  startedAt: string;
}

export interface RaidComparisonFight {
  encounterId: string;
  bossSlug: string;
  bossName: string;
  bossOrder: number;
  difficulty: string;
  dps: number | null;
  hps: number | null;
  aps?: number | null;
  ha?: number | null;
  dtps?: number | null;
  role?: string | null;
  spec: string | null;
}

export interface RaidComparisonRun extends RaidComparisonSession {
  fights: RaidComparisonFight[];
}

export interface RaidComparisonData {
  scopes: RaidComparisonScope[];
  raidSlug: string;
  difficulty: string;
  sessions: RaidComparisonSession[];
  runs: RaidComparisonRun[];
}

export interface RaidComparisonParams {
  raid?: string;
  difficulty?: string;
}

export interface RaidComparisonSessionSource {
  uploadId: string;
  sessionIndex: number;
  startedAt: Date | string;
}

export interface RaidComparisonParticipantSource {
  dps: number | null;
  hps: number | null;
  aps?: number | null;
  damageTaken?: number | null;
  role?: string | null;
  spec: string | null;
  encounter: {
    id: string;
    uploadId: string;
    sessionIndex: number;
    startedAt: Date | string;
    outcome: string;
    difficulty: string;
    durationMs?: number | null;
    durationSeconds?: number | null;
    boss: { slug: string; name: string; sortOrder: number };
  };
}

export interface RaidComparisonChartValue {
  difficulty: string;
  dps: number | null;
  hps: number | null;
  aps?: number | null;
  ha?: number | null;
  dtps?: number | null;
  role?: string | null;
  encounterId: string;
  spec: string | null;
}

export interface RaidComparisonChartRow {
  bossSlug: string;
  bossName: string;
  bossOrder: number;
  values: Record<string, RaidComparisonChartValue | null>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Combined scopes are local to this view; exact difficulty labels remain unchanged. */
export function raidComparisonDifficultyLabel(value: string): string {
  if (value === "10" || value === "25") return `${value}-player · Normal + heroic`;
  return DIFFICULTY_FILTERS.find(option => option.value === value)?.label ?? value;
}

/** Identify a stored run without conflating uploads or same-day sessions. */
export function raidComparisonSessionKey(uploadId: string, sessionIndex: number): string {
  return `${uploadId}:${sessionIndex}`;
}

/** Dates refer to the first matching successful kill, not upload creation time. */
export function buildRaidComparisonSessions(sources: RaidComparisonSessionSource[]): RaidComparisonSession[] {
  const byKey = new Map<string, RaidComparisonSession>();
  for (const source of sources) {
    const date = new Date(source.startedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const key = raidComparisonSessionKey(source.uploadId, source.sessionIndex);
    const startedAt = date.toISOString();
    const previous = byKey.get(key);
    if (!previous || startedAt < previous.startedAt) byKey.set(key, { key, label: "", startedAt });
  }

  const chronological = [...byKey.values()].sort((left, right) =>
    compareText(left.startedAt, right.startedAt) || compareText(left.key, right.key));
  const dates = new Map<string, number>();
  for (const session of chronological) {
    const date = session.startedAt.slice(0, 10);
    dates.set(date, (dates.get(date) ?? 0) + 1);
  }
  const ordinals = new Map<string, number>();
  for (const session of chronological) {
    const date = session.startedAt.slice(0, 10);
    const ordinal = (ordinals.get(date) ?? 0) + 1;
    ordinals.set(date, ordinal);
    session.label = `${formatDateUtc(session.startedAt)} UTC${dates.get(date)! > 1 ? ` · raid ${ordinal}` : ""}`;
  }

  return chronological.sort((left, right) =>
    compareText(right.startedAt, left.startedAt) || compareText(left.key, right.key));
}

function storedRate(value: number | null, hasDuration: boolean): number | null {
  return hasDuration && value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Preserve the earliest successful kill for each boss, including short kills.
 * A later faster or valid-rate kill never replaces an earlier recorded kill.
 */
export function buildRaidComparisonRuns(
  sessions: RaidComparisonSession[],
  participants: RaidComparisonParticipantSource[],
): RaidComparisonRun[] {
  const fightsBySession = new Map(sessions.map(session => [session.key, new Map<string, RaidComparisonFight>()]));
  const ordered = participants.filter(participant => participant.encounter.outcome === "KILL"
    && Number.isFinite(new Date(participant.encounter.startedAt).getTime()))
    .sort((left, right) => new Date(left.encounter.startedAt).getTime() - new Date(right.encounter.startedAt).getTime()
      || compareText(left.encounter.id, right.encounter.id));

  for (const participant of ordered) {
    const encounter = participant.encounter;
    const fights = fightsBySession.get(raidComparisonSessionKey(encounter.uploadId, encounter.sessionIndex));
    if (!fights || fights.has(encounter.boss.slug)) continue;
    const duration = getRecordedDurationSeconds(encounter);
    const hasDuration = duration !== null;
    const hps = storedRate(participant.hps, hasDuration);
    const aps = storedRate(participant.aps ?? null, hasDuration);
    fights.set(encounter.boss.slug, {
      encounterId: encounter.id,
      bossSlug: encounter.boss.slug,
      bossName: encounter.boss.name,
      bossOrder: encounter.boss.sortOrder,
      difficulty: encounter.difficulty,
      dps: storedRate(participant.dps, hasDuration),
      hps,
      aps,
      ha: hps !== null && aps !== null ? hps + aps : null,
      dtps: duration !== null && participant.damageTaken != null
        ? storedRate(participant.damageTaken / duration, true) : null,
      role: participant.role ?? null,
      spec: participant.spec,
    });
  }

  return sessions.map(session => ({
    ...session,
    fights: [...fightsBySession.get(session.key)!.values()].sort((left, right) =>
      left.bossOrder - right.bossOrder || compareText(left.bossSlug, right.bossSlug)),
  }));
}

/** Keep canonical raid slots even without recorded kills; custom raids use their observed bosses. */
export function buildRaidComparisonChart(runs: RaidComparisonRun[], raidSlug?: string): RaidComparisonChartRow[] {
  const bosses = new Map<string, Pick<RaidComparisonFight, "bossSlug" | "bossName" | "bossOrder">>();
  for (const boss of WOTLK_BOSSES.filter(boss => boss.raidSlug === raidSlug)) {
    bosses.set(boss.slug, { bossSlug: boss.slug, bossName: boss.name, bossOrder: boss.sortOrder });
  }
  const fightsByRun = new Map(runs.map(run => [run.key, new Map(run.fights.map(fight => [fight.bossSlug, fight]))]));
  for (const run of runs) {
    for (const fight of run.fights) {
      if (!bosses.has(fight.bossSlug)) bosses.set(fight.bossSlug, {
        bossSlug: fight.bossSlug, bossName: fight.bossName, bossOrder: fight.bossOrder,
      });
    }
  }
  return [...bosses.values()]
    .sort((left, right) => left.bossOrder - right.bossOrder || compareText(left.bossSlug, right.bossSlug))
    .map(boss => ({
      ...boss,
      values: Object.fromEntries(runs.map(run => {
        const fight = fightsByRun.get(run.key)!.get(boss.bossSlug);
        return [run.key, fight ? {
          difficulty: fight.difficulty, dps: fight.dps, hps: fight.hps, aps: fight.aps,
          ha: fight.ha, dtps: fight.dtps, role: fight.role, encounterId: fight.encounterId, spec: fight.spec,
        } : null];
      })),
    }));
}
