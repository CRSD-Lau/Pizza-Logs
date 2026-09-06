"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlayerRaidComparisonChart } from "@/components/charts/PlayerRaidComparisonChart";
import { DIFFICULTY_FILTERS } from "@/lib/difficulty-filter";
import type { RaidComparisonData } from "@/lib/player-raid-comparison";
import { cn, formatCountLabel } from "@/lib/utils";

const fieldClass = "min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60";

function difficultyLabel(value: string) {
  return DIFFICULTY_FILTERS.find(option => option.value === value)?.label ?? value;
}

export function PlayerRaidComparison({ data, playerName }: {
  data: RaidComparisonData;
  playerName: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const metric = searchParams.get("comparisonMetric") === "HPS" ? "HPS" : "DPS";
  const raids = data.scopes.filter((scope, index, scopes) => scopes.findIndex(other => other.raidSlug === scope.raidSlug) === index);
  const difficulties = data.scopes.filter(scope => scope.raidSlug === data.raidSlug);
  const scope = data.scopes.find(item => item.raidSlug === data.raidSlug && item.difficulty === data.difficulty);
  const first = data.runs[0]?.key ?? "";
  const second = data.runs[1]?.key ?? "";

  function navigate(changes: Record<string, string | null>) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("comparisonMetric", metric);
    if (data.raidSlug) query.set("comparisonRaid", data.raidSlug);
    if (data.difficulty) query.set("comparisonDifficulty", data.difficulty);
    if (first) query.set("comparisonFirst", first);
    if (second) query.set("comparisonSecond", second);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  }

  function chooseMetric(value: "DPS" | "HPS") {
    const query = new URLSearchParams(searchParams.toString());
    query.set("comparisonMetric", value);
    // Both rates are already loaded. Next syncs this with useSearchParams
    // without another database request, and reloads/shared URLs keep the metric.
    window.history.replaceState(null, "", `${pathname}?${query}${window.location.hash}`);
  }

  if (data.scopes.length === 0) {
    return <p className="text-sm text-text-secondary">No successful boss kills recorded for {playerName} yet. Recorded raid kills will appear here for comparison.</p>;
  }

  return (
    <div className="min-w-0 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Choose the raid, difficulty, and two recorded raids to compare</legend>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-raid`} className="text-sm font-semibold text-text-secondary">Raid</label>
          <select id={`${id}-raid`} name="comparisonRaid" value={data.raidSlug ?? ""} className={fieldClass} onChange={event => {
            const nextRaid = event.target.value;
            const nextDifficulty = data.scopes.find(item => item.raidSlug === nextRaid && item.difficulty === data.difficulty)?.difficulty
              ?? data.scopes.find(item => item.raidSlug === nextRaid)?.difficulty;
            navigate({ comparisonRaid: nextRaid, comparisonDifficulty: nextDifficulty ?? null, comparisonFirst: null, comparisonSecond: null });
          }}>
            {raids.map(raid => <option key={raid.raidSlug} value={raid.raidSlug}>{raid.raidName}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-difficulty`} className="text-sm font-semibold text-text-secondary">Difficulty</label>
          <select id={`${id}-difficulty`} name="comparisonDifficulty" value={data.difficulty ?? ""} className={fieldClass} onChange={event => navigate({ comparisonDifficulty: event.target.value, comparisonFirst: null, comparisonSecond: null })}>
            {difficulties.map(item => <option key={item.difficulty} value={item.difficulty}>{difficultyLabel(item.difficulty)}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-first`} className="text-sm font-semibold text-text-secondary">First raid</label>
          <select id={`${id}-first`} name="comparisonFirst" value={first} className={fieldClass} onChange={event => navigate({ comparisonFirst: event.target.value })}>
            {data.sessions.map(session => <option key={session.key} value={session.key} disabled={session.key === second}>{session.label}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-second`} className="text-sm font-semibold text-text-secondary">Second raid</label>
          <select id={`${id}-second`} name="comparisonSecond" value={second} disabled={pending || data.sessions.length < 2} className={fieldClass} onChange={event => navigate({ comparisonSecond: event.target.value })}>
            {!second && <option value="">No second raid recorded</option>}
            {data.sessions.map(session => <option key={session.key} value={session.key} disabled={session.key === first}>{session.label}</option>)}
          </select>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-text-secondary">{formatCountLabel(data.sessions.length, "recorded raid")} in this scope · Dates in UTC</p>
        <div role="group" aria-label="Metric" className="inline-flex gap-1">
          {(["DPS", "HPS"] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} disabled={pending} onClick={() => chooseMetric(value)} className={cn(
            "min-h-11 min-w-14 rounded-sm border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60",
            metric === value ? "border-gold bg-bg-panel text-gold-light" : "border-gold-dim text-text-secondary hover:border-gold hover:text-gold-light",
          )}>{value}</button>)}
        </div>
      </div>

      <p role="status" aria-live="polite" className={cn("text-sm text-text-secondary", !pending && "sr-only")}>{pending ? "Loading the selected raid comparison…" : "Raid comparison ready."}</p>
      {data.difficulty === "UNKNOWN" && <p className="text-sm text-text-secondary">Difficulty is unknown for these records. Matching raid size and mode cannot be confirmed.</p>}
      {data.runs.length === 1 && <p className="text-sm text-text-secondary">One recorded raid in this scope. Showing its successful kills; a second recorded raid is needed to compare.</p>}

      {data.runs.length > 0 ? <PlayerRaidComparisonChart
        key={`${data.raidSlug}:${data.difficulty}:${data.runs.map(run => run.key).join(":")}`}
        runs={data.runs}
        playerName={playerName}
        metric={metric}
        scopeLabel={`${scope?.raidName ?? data.raidSlug} · ${difficultyLabel(data.difficulty ?? "UNKNOWN")}`}
        includeShortPulls={searchParams.get("includeShortPulls") === "1"}
      /> : <p className="text-sm text-text-secondary">No successful boss kills are available in the selected raids.</p>}
      <p className="text-sm text-text-secondary">Successful kills only, including short kills. Bosses follow raid order; missing kills leave gaps. Gear, roles, and fight conditions can affect these values.</p>
    </div>
  );
}
