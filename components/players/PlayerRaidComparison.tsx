"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlayerRaidComparisonChart } from "@/components/charts/PlayerRaidComparisonChart";
import { RAID_COMPARISON_METRICS, resolveRaidComparisonMetric, raidComparisonDifficultyLabel, type RaidComparisonData, type RaidComparisonMetric } from "@/lib/player-raid-comparison";
import { cn, formatCountLabel } from "@/lib/utils";

const fieldClass = "min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60";

export function PlayerRaidComparison({ data, playerName }: {
  data: RaidComparisonData;
  playerName: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const metric = resolveRaidComparisonMetric(searchParams.get("comparisonMetric"), data.runs);
  const raids = data.scopes.filter((scope, index, scopes) => scopes.findIndex(other => other.raidSlug === scope.raidSlug) === index);
  const difficulties = data.scopes.filter(scope => scope.raidSlug === data.raidSlug);
  const scope = data.scopes.find(item => item.raidSlug === data.raidSlug && item.difficulty === data.difficulty);

  function navigate(changes: Record<string, string | null>) {
    const query = new URLSearchParams(searchParams.toString());
    if (data.raidSlug) query.set("comparisonRaid", data.raidSlug);
    if (data.difficulty) query.set("comparisonDifficulty", data.difficulty);
    query.delete("comparisonFirst");
    query.delete("comparisonSecond");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  }

  function chooseMetric(value: RaidComparisonMetric) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("comparisonMetric", value);
    query.delete("comparisonFirst");
    query.delete("comparisonSecond");
    // All rates are already loaded. Next syncs this with useSearchParams
    // without another database request, and reloads/shared URLs keep the metric.
    window.history.replaceState(null, "", `${pathname}?${query}${window.location.hash}`);
  }

  if (data.scopes.length === 0) {
    return <p className="text-sm text-text-secondary">No successful boss kills recorded for {playerName} yet. Recorded raid kills will appear here for comparison.</p>;
  }

  return (
    <div className="min-w-0 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Choose the raid, player count, and normal or heroic mode for all recorded raids</legend>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-raid`} className="text-sm font-semibold text-text-secondary">Raid</label>
          <select id={`${id}-raid`} name="comparisonRaid" value={data.raidSlug ?? ""} className={fieldClass} onChange={event => {
            const nextRaid = event.target.value;
            const nextDifficulty = data.scopes.find(item => item.raidSlug === nextRaid && item.difficulty === data.difficulty)?.difficulty
              ?? data.scopes.find(item => item.raidSlug === nextRaid && (item.difficulty === "25" || item.difficulty === "10"))?.difficulty
              ?? data.scopes.find(item => item.raidSlug === nextRaid)?.difficulty;
            navigate({ comparisonRaid: nextRaid, comparisonDifficulty: nextDifficulty ?? null });
          }}>
            {raids.map(raid => <option key={raid.raidSlug} value={raid.raidSlug}>{raid.raidName}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-difficulty`} className="text-sm font-semibold text-text-secondary">Difficulty</label>
          <select id={`${id}-difficulty`} name="comparisonDifficulty" value={data.difficulty ?? ""} className={fieldClass} onChange={event => navigate({ comparisonDifficulty: event.target.value })}>
            {difficulties.map(item => <option key={item.difficulty} value={item.difficulty}>{raidComparisonDifficultyLabel(item.difficulty)}</option>)}
          </select>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-text-secondary">{data.runs.length === 1 ? "" : "All "}{formatCountLabel(data.runs.length, "recorded raid")} in this scope · Dates in UTC</p>
        <div className="grid min-w-0 max-w-full gap-1.5">
          <label htmlFor={`${id}-metric`} className="text-sm font-semibold text-text-secondary">Comparison metric</label>
          <select id={`${id}-metric`} value={metric} disabled={pending} onChange={event => chooseMetric(event.target.value as RaidComparisonMetric)} className={fieldClass}>
            {Object.entries(RAID_COMPARISON_METRICS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <p role="status" aria-live="polite" className={cn("text-sm text-text-secondary", !pending && "sr-only")}>{pending ? "Loading the selected raid comparison…" : "Raid comparison ready."}</p>
      {(data.difficulty === "25" || data.difficulty === "10") && <p className="text-sm text-text-secondary">Normal and heroic kills are included for {data.difficulty}-player raids. Each recorded boss value shows its actual difficulty.</p>}
      {data.difficulty === "UNKNOWN" && <p className="text-sm text-text-secondary">Difficulty is unknown for these records. Matching raid size and mode cannot be confirmed.</p>}
      {data.runs.length === 1 && <p className="text-sm text-text-secondary">One recorded raid in this scope. Showing its successful kills; a second recorded raid is needed to compare.</p>}

      {data.runs.length > 0 ? <PlayerRaidComparisonChart
        key={`${data.raidSlug}:${data.difficulty}:${data.runs.map(run => run.key).join(":")}`}
        runs={data.runs}
        raidSlug={data.raidSlug}
        playerName={playerName}
        metric={metric}
        scopeLabel={`${scope?.raidName ?? data.raidSlug} · ${raidComparisonDifficultyLabel(data.difficulty ?? "UNKNOWN")}`}
        includeShortPulls={searchParams.get("includeShortPulls") === "1"}
      /> : <p className="text-sm text-text-secondary">No successful boss kills are available in the selected raids.</p>}
      <p className="text-sm text-text-secondary">Successful kills only, including short kills. Every boss has a position in raid order; missing qualifying kills leave gaps. Difficulty, gear, roles, and fight conditions can affect these values.</p>
    </div>
  );
}
