/** A report-counting policy only; stored outcomes and combat metrics stay intact. */
export const SHORT_PULL_LIMIT_MS = 60_000;

export type AttemptEvidence = {
  outcome: string;
  durationMs?: number | null;
  durationSeconds?: number | null;
  participants?: readonly { deaths?: number | null }[] | null;
};

export function parseIncludeShortPulls(value: unknown): boolean {
  return value === "1";
}

export function isShortPull(encounter: AttemptEvidence): boolean {
  if (encounter.outcome !== "WIPE") return false;
  const { durationMs, durationSeconds, participants } = encounter;
  let milliseconds: number;
  if (durationMs != null && durationMs !== 0) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return false;
    milliseconds = durationMs;
  } else {
    if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
    milliseconds = durationSeconds * 1000;
  }
  if (!(milliseconds > 0 && milliseconds < SHORT_PULL_LIMIT_MS)) return false;
  // Missing participants are missing evidence, rather than proof of no deaths.
  if (!Array.isArray(participants) || participants.length === 0) return false;
  for (const participant of participants) {
    if (participant?.deaths !== 0) return false;
  }
  return true;
}

export function countAttempts(
  encounters: readonly AttemptEvidence[],
  { includeShortPulls = false }: { includeShortPulls?: boolean } = {},
) {
  const counts = { kills: 0, wipes: 0, unknown: 0, totalPulls: 0, shortPulls: 0 };
  for (const encounter of encounters) {
    const short = isShortPull(encounter);
    if (short) counts.shortPulls += 1;
    if (short && !includeShortPulls) continue;
    counts.totalPulls += 1;
    if (encounter.outcome === "KILL") counts.kills += 1;
    else if (encounter.outcome === "WIPE") counts.wipes += 1;
    else if (encounter.outcome === "UNKNOWN") counts.unknown += 1;
  }
  return counts;
}
