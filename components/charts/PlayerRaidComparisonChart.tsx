"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumericValue } from "@/components/ui/NumericValue";
import { buildRaidComparisonChart, type RaidComparisonRun } from "@/lib/player-raid-comparison";
import { cn, formatCompactNumber, formatDateUtc, formatRate } from "@/lib/utils";

type Metric = "DPS" | "HPS";
type ChartRow = ReturnType<typeof buildRaidComparisonChart>[number];

function shortBossName(name: string) {
  if (name === "Gunship Battle") return "Gunship";
  if (name === "The Lich King") return "Lich King";
  return name.split(" ").at(-1) ?? name;
}

function RaidTooltip({ active, payload, runs, metric, hidden }: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
  runs: RaidComparisonRun[];
  metric: Metric;
  hidden: Record<string, boolean>;
}) {
  const row = payload?.find(entry => entry.payload)?.payload;
  if (!active || !row) return null;
  const metricKey = metric === "DPS" ? "dps" : "hps";
  return (
    <div className="max-w-52 rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm shadow-lg sm:max-w-60">
      <p className="mb-2 font-semibold text-gold-light">{row.bossName}</p>
      {runs.filter(run => !hidden[run.key]).map(run => {
        const fight = row.values[run.key];
        const value = fight?.[metricKey];
        return <div key={run.key} className="mt-2 first:mt-0">
          <p className="text-text-secondary"><time dateTime={run.startedAt}>{run.label}</time></p>
          <p className="font-semibold text-text-primary">{value == null ? "Unavailable" : `${formatRate(value)} ${metric}`}</p>
          {!fight && <p className="text-xs text-text-secondary">No recorded kill</p>}
          {fight && value == null && <p className="text-xs text-text-secondary">No valid recorded rate</p>}
          {fight?.spec && <p className="text-xs text-text-secondary">{fight.spec}</p>}
        </div>;
      })}
    </div>
  );
}

export function PlayerRaidComparisonChart({ runs, playerName, metric, scopeLabel, includeShortPulls }: {
  runs: RaidComparisonRun[];
  playerName: string;
  metric: Metric;
  scopeLabel: string;
  includeShortPulls: boolean;
}) {
  const id = useId();
  const rows = useMemo(() => buildRaidComparisonChart(runs), [runs]);
  const newestFirst = useMemo(() => [...runs].sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt, "en") || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)), [runs]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const metricKey = metric === "DPS" ? "dps" : "hps";
  const visibleRuns = runs.filter(run => !hidden[run.key]);
  const hasValues = rows.some(row => visibleRuns.some(run => row.values[run.key]?.[metricKey] != null));
  const newestKey = newestFirst[0]?.key;
  const tiedStarts = runs.length > 1 && runs.every(run => run.startedAt === runs[0].startedAt);
  const encounterSuffix = includeShortPulls ? "?includeShortPulls=1" : "";

  return (
    <div className="min-w-0 rounded-sm border border-gold-dim bg-bg-panel p-3 sm:p-4" data-testid="player-raid-comparison-chart">
      <h3 id={`${id}-title`} className="heading-cinzel text-sm font-semibold tracking-wide text-gold">{metric} by successful boss fight</h3>
      <p className="mt-1 text-sm text-text-secondary">{playerName} · {scopeLabel}</p>
      <p className="mt-1 text-xs text-text-secondary">{metric === "HPS" ? "Effective healing per second" : "Damage per second"} · Wipes excluded · Two decimals: K thousands, M millions</p>

      <div className="my-3 flex flex-wrap gap-x-6 gap-y-1" role="group" aria-label="Show or hide a raid line">
        {newestFirst.map(run => {
          const newest = run.key === newestKey;
          const shown = !hidden[run.key];
          return <button key={run.key} type="button" aria-pressed={shown} aria-label={`${shown ? "Hide" : "Show"} raid ${run.label}`} onClick={() => setHidden(current => ({ ...current, [run.key]: !current[run.key] }))} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-sm py-2 text-left text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <span className={cn("relative inline-flex h-3 w-7 shrink-0 items-center", newest ? "text-gold-light" : "text-gold")} aria-hidden="true">
              <span className={cn("w-full border-t-2", !newest && "border-dashed")} />
              <span className={cn("absolute left-2.5 h-2 w-2 rounded-full border", newest ? "bg-gold-light" : "bg-bg-panel")} />
            </span>
            <span className={cn("min-w-0 break-words", !shown && "text-text-secondary line-through")}><time dateTime={run.startedAt}>{run.label}</time><span className="ml-2 text-xs text-text-secondary">{runs.length === 1 || tiedStarts ? "Recorded raid" : newest ? "Newer raid" : "Older raid"}</span></span>
          </button>;
        })}
      </div>

      <figure aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="m-0 min-w-0">
        <p id={`${id}-description`} className="sr-only">{playerName}&apos;s {metric} on successful boss fights in {scopeLabel}. Bosses follow raid order. Each dated line is one recorded raid; unavailable values leave gaps. Use the values disclosure for every value, specialization, and encounter link.</p>
        {hasValues ? <ResponsiveContainer width="100%" height={300} minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 12 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gold-dim)" strokeOpacity={0.4} />
            <XAxis dataKey="bossName" tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "var(--color-gold-dim)" }} interval="preserveStartEnd" minTickGap={22} tickMargin={10} tickFormatter={shortBossName} />
            <YAxis width={64} domain={[0, "auto"]} tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={formatCompactNumber} />
            <Tooltip content={<RaidTooltip runs={runs} metric={metric} hidden={hidden} />} filterNull={false} />
            {runs.map(run => {
              const newest = run.key === newestKey;
              const color = newest ? "var(--color-gold-light)" : "var(--color-gold)";
              return <Line key={run.key} name={run.label} dataKey={(row: ChartRow) => row.values[run.key]?.[metricKey] ?? null} type="monotone" stroke={color} strokeWidth={newest ? 2.5 : 1.75} strokeDasharray={newest ? undefined : "5 4"} strokeOpacity={newest ? 1 : 0.85} hide={!!hidden[run.key]} dot={{ r: newest ? 4.5 : 3.5, fill: newest ? color : "var(--color-bg-panel)", stroke: color, strokeWidth: 1.5 }} activeDot={{ r: 6, fill: color, stroke: "var(--color-text-primary)", strokeWidth: 1.25 }} connectNulls={false} isAnimationActive={false} />;
            })}
          </LineChart>
        </ResponsiveContainer> : <p role="status" className="flex min-h-60 items-center justify-center px-4 text-center text-sm text-text-secondary">{visibleRuns.length === 0 ? "Select a raid in the legend to show its line." : `No valid recorded ${metric} values for the visible raids.`}</p>}
      </figure>

      <details className="mt-3 border-t border-gold-dim text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-gold">View {metric} chart values</summary>
        <div role="region" aria-label={`${metric} values and source encounters`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-gold">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{playerName} · {scopeLabel}. {metric} by boss and recorded raid, including lines hidden in the chart. Dates are UTC. Unavailable values distinguish missing kills from invalid recorded rates.</caption>
            <thead><tr><th scope="col" className="w-[30%] px-2 py-3 text-left align-bottom text-text-secondary">Boss</th>{runs.map(run => <th key={run.key} scope="col" className="break-words px-2 py-3 text-right align-bottom font-semibold text-text-secondary"><time dateTime={run.startedAt}>{formatDateUtc(run.startedAt)}</time>{run.label.includes(" · ") && <span className="block text-xs">{run.label.split(" · ").slice(1).join(" · ")}</span>}<span className="block">{metric}</span></th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.bossSlug} className="border-t border-gold-dim">
              <th scope="row" className="break-words px-2 py-3 text-left align-top font-medium text-text-primary">{row.bossName}</th>
              {runs.map(run => {
                const fight = row.values[run.key];
                const value = fight?.[metricKey];
                return <td key={run.key} className="break-words px-2 py-1 text-right align-top">
                  {fight ? <>
                    <Link href={`/encounters/${encodeURIComponent(fight.encounterId)}${encounterSuffix}`} className="inline-flex min-h-11 max-w-full items-center justify-end rounded-sm py-2 text-gold-light hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" aria-label={`${row.bossName}, ${run.label}, ${value == null ? "unavailable" : formatRate(value)} ${metric}. View encounter.`}><NumericValue value={value} kind="rate" /></Link>
                    {value == null && <span className="block text-xs text-text-secondary">No valid rate</span>}
                    {fight.spec && <span className="block pb-2 text-xs text-text-secondary">{fight.spec}</span>}
                  </> : <div className="py-2"><NumericValue value={null} kind="rate" /><span className="mt-1 block text-xs text-text-secondary">No recorded kill</span></div>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
