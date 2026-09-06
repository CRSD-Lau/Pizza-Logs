"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumericValue } from "@/components/ui/NumericValue";
import { buildRaidComparisonChart, type RaidComparisonRun } from "@/lib/player-raid-comparison";
import { cn, formatCompactNumber, formatCountLabel, formatInteger, formatRate } from "@/lib/utils";

type Metric = "DPS" | "HPS";
type ChartRow = ReturnType<typeof buildRaidComparisonChart>[number];
const VALUES_PAGE_SIZE = 25;
const DENSE_RUN_COUNT = 12;
const actionClass = "inline-flex min-h-11 items-center justify-center rounded-sm border border-gold-dim px-3 py-2 text-sm font-semibold text-gold-light hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-default disabled:text-text-secondary disabled:opacity-60";

function shortBossName(name: string) {
  if (name === "Gunship Battle") return "Gunship";
  if (name === "The Lich King") return "Lich King";
  return name.split(" ").at(-1) ?? name;
}

function RaidTooltip({ active, payload, label, rows, run, metric }: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
  label?: unknown;
  rows: ChartRow[];
  run?: RaidComparisonRun;
  metric: Metric;
}) {
  const row = payload?.find(entry => entry.payload)?.payload ?? rows.find(item => item.bossName === label);
  if (!active || !row || !run) return null;
  const fight = row.values[run.key];
  const value = fight?.[metric === "DPS" ? "dps" : "hps"];
  return (
    <div className="max-w-52 rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm shadow-lg sm:max-w-60" data-testid="highlighted-raid-tooltip" data-run-key={run.key}>
      <p className="mb-2 font-semibold text-gold-light">{row.bossName}</p>
      <p className="text-xs text-text-secondary">Highlighted raid</p>
      <p className="text-text-secondary"><time dateTime={run.startedAt}>{run.label}</time></p>
      <p className="font-semibold text-text-primary">{value == null ? "Unavailable" : `${formatRate(value)} ${metric}`}</p>
      {!fight && <p className="text-xs text-text-secondary">No recorded kill</p>}
      {fight && value == null && <p className="text-xs text-text-secondary">No valid recorded rate</p>}
      {fight?.spec && <p className="text-xs text-text-secondary">{fight.spec}</p>}
    </div>
  );
}

function RaidValuesTable({ runs, rows, playerName, scopeLabel, metric, includeShortPulls }: {
  runs: RaidComparisonRun[];
  rows: ChartRow[];
  playerName: string;
  scopeLabel: string;
  metric: Metric;
  includeShortPulls: boolean;
}) {
  const [page, setPage] = useState(0);
  const total = runs.length * rows.length;
  const pageCount = Math.max(1, Math.ceil(total / VALUES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * VALUES_PAGE_SIZE;
  const end = Math.min(total, start + VALUES_PAGE_SIZE);
  const metricKey = metric === "DPS" ? "dps" : "hps";
  const encounterSuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  // Only the current page becomes table rows. The chart still uses every run.
  const pageRows = Array.from({ length: end - start }, (_, offset) => {
    const index = start + offset;
    const run = runs[Math.floor(index / rows.length)];
    return { run, row: rows[index % rows.length] };
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">All recorded raids, newest first, then boss order. Table pages do not change the chart or hide raids.</p>
      <table className="w-full table-fixed text-sm" data-testid="raid-comparison-values-table">
        <caption className="sr-only">{playerName} · {scopeLabel}. {metric} for every raid and boss, including hidden lines. Dates are UTC. Missing kills and invalid rates remain unavailable; measured zero is shown.</caption>
        <thead><tr>
          <th scope="col" className="w-[35%] px-2 py-3 text-left align-bottom text-text-secondary">Raid</th>
          <th scope="col" className="w-[32%] px-2 py-3 text-left align-bottom text-text-secondary">Boss</th>
          <th scope="col" className="px-2 py-3 text-right align-bottom text-text-secondary">{metric}</th>
        </tr></thead>
        <tbody>{pageRows.map(({ run, row }) => {
          const fight = row.values[run.key];
          const value = fight?.[metricKey];
          return <tr key={`${run.key}:${row.bossSlug}`} className="border-t border-gold-dim">
            <th scope="row" className="break-words px-2 py-3 text-left align-top font-medium text-text-primary"><time dateTime={run.startedAt}>{run.label}</time></th>
            <td className="break-words px-2 py-3 text-left align-top text-text-primary">{row.bossName}</td>
            <td className="break-words px-2 py-1 text-right align-top">
              {fight ? <>
                <Link href={`/encounters/${encodeURIComponent(fight.encounterId)}${encounterSuffix}`} className="inline-flex min-h-11 max-w-full items-center justify-end rounded-sm py-2 text-gold-light hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" aria-label={`${row.bossName}, ${run.label}, ${value == null ? "unavailable" : formatRate(value)} ${metric}. View encounter.`}><NumericValue value={value} kind="rate" /></Link>
                {value == null && <span className="block text-xs text-text-secondary">No valid rate</span>}
                {fight.spec && <span className="block pb-2 text-xs text-text-secondary">{fight.spec}</span>}
              </> : <div className="py-2"><NumericValue value={null} kind="rate" /><span className="mt-1 block text-xs text-text-secondary">No recorded kill</span></div>}
            </td>
          </tr>;
        })}</tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Chart values pagination">
        <button type="button" aria-label="Previous values page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={actionClass}>Previous</button>
        <p role="status" aria-live="polite" className="text-center text-xs text-text-secondary">Rows {formatInteger(total ? start + 1 : 0)}–{formatInteger(end)} of {formatInteger(total)}<span className="block">Page {formatInteger(currentPage + 1)} of {formatInteger(pageCount)}</span></p>
        <button type="button" aria-label="Next values page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className={actionClass}>Next</button>
      </div>
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
  const [highlightedKey, setHighlightedKey] = useState(newestFirst[0]?.key ?? "");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  const metricKey = metric === "DPS" ? "dps" : "hps";
  const visibleRuns = runs.filter(run => !hidden[run.key]);
  const hasValues = rows.some(row => visibleRuns.some(run => row.values[run.key]?.[metricKey] != null));
  const highlightedRun = newestFirst.find(run => run.key === highlightedKey && !hidden[run.key]);
  const newestKey = newestFirst[0]?.key;
  const dense = runs.length > DENSE_RUN_COUNT;
  const isolatedByRun = useMemo(() => new Map(runs.map(run => {
    const isolated = new Set<number>();
    rows.forEach((row, index) => {
      if (row.values[run.key]?.[metricKey] == null) return;
      if (rows[index - 1]?.values[run.key]?.[metricKey] == null && rows[index + 1]?.values[run.key]?.[metricKey] == null) isolated.add(index);
    });
    return [run.key, isolated];
  })), [runs, rows, metricKey]);
  // Draw the selected line last so its values remain inspectable in dense histories.
  const drawOrder = [...newestFirst].reverse().filter(run => run.key !== highlightedRun?.key);
  if (highlightedRun) drawOrder.push(highlightedRun);

  function highlight(key: string) {
    setHighlightedKey(key);
    setHidden(current => ({ ...current, [key]: false }));
  }

  return (
    <div className="min-w-0 rounded-sm border border-gold-dim bg-bg-panel p-3 sm:p-4" data-testid="player-raid-comparison-chart" data-total-run-count={runs.length} data-visible-run-count={visibleRuns.length} data-highlighted-run-key={highlightedRun?.key ?? ""}>
      <h3 id={`${id}-title`} className="heading-cinzel text-sm font-semibold tracking-wide text-gold">{metric} by successful boss fight</h3>
      <p className="mt-1 text-sm text-text-secondary">{playerName} · {scopeLabel}</p>
      <p className="mt-1 text-xs text-text-secondary">{metric === "HPS" ? "Effective healing per second" : "Damage per second"} · Wipes excluded · Two decimals: K thousands, M millions</p>

      <div className="my-4 flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-sm">
          <label htmlFor={`${id}-highlight`} className="text-sm font-semibold text-text-secondary">Highlight raid</label>
          <select id={`${id}-highlight`} value={highlightedRun?.key ?? ""} onChange={event => highlight(event.target.value)} className="min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            {!highlightedRun && <option value="" disabled>Choose a raid to highlight</option>}
            {newestFirst.map(run => <option key={run.key} value={run.key}>{run.label}</option>)}
          </select>
        </div>
        <p className="text-sm text-text-secondary" role="status" aria-live="polite" data-testid="visible-raids-count">{formatInteger(visibleRuns.length)} of {formatCountLabel(runs.length, "raid")} shown</p>
      </div>
      <p className="mb-3 text-sm text-text-secondary">Highlighting a raid keeps the other lines visible. Hover a boss for the highlighted raid&apos;s value.</p>

      <figure aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="m-0 min-w-0">
        <p id={`${id}-description`} className="sr-only">{playerName}&apos;s {metric} on successful boss fights in {scopeLabel}. Every recorded raid is shown by default. Bosses follow raid order. Each dated line is one raid; unavailable values leave gaps. The highlighted raid uses a thicker line. The values disclosure includes every value, specialization, and source encounter.</p>
        {hasValues ? <ResponsiveContainer width="100%" height={300} minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 12 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gold-dim)" strokeOpacity={0.4} />
            <XAxis dataKey="bossName" tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "var(--color-gold-dim)" }} interval="preserveStartEnd" minTickGap={22} tickMargin={10} tickFormatter={shortBossName} />
            <YAxis width={64} domain={[0, "auto"]} tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={formatCompactNumber} />
            <Tooltip content={<RaidTooltip rows={rows} run={highlightedRun} metric={metric} />} filterNull={false} />
            {drawOrder.map(run => {
              const highlighted = run.key === highlightedRun?.key;
              const newest = run.key === newestKey;
              const color = highlighted || newest ? "var(--color-gold-light)" : "var(--color-gold)";
              const isolated = isolatedByRun.get(run.key)!;
              return <Line key={run.key} className="raid-comparison-line" data-run-key={run.key} name={run.label} dataKey={(row: ChartRow) => row.values[run.key]?.[metricKey] ?? null} type="monotone" stroke={color} strokeWidth={highlighted ? 2.75 : newest ? 1.75 : 1.25} strokeOpacity={highlighted ? 1 : newest ? 0.9 : 0.75} hide={!!hidden[run.key]} dot={dense && !highlighted && isolated.size === 0 ? false : props => {
                if (props.cx == null || props.cy == null || props.value == null || (dense && !highlighted && !isolated.has(props.index))) return null;
                return <circle key={`${run.key}:${props.index}`} className="recharts-line-dot" cx={props.cx} cy={props.cy} r={highlighted ? 4.5 : 3} fill={highlighted ? color : "var(--color-bg-panel)"} stroke={color} strokeWidth={1.5} data-run-key={run.key} data-boss-index={props.index} data-isolated={isolated.has(props.index) ? "true" : "false"} />;
              }} activeDot={highlighted ? { r: 6, fill: color, stroke: "var(--color-text-primary)", strokeWidth: 1.25 } : false} connectNulls={false} isAnimationActive={false} />;
            })}
          </LineChart>
        </ResponsiveContainer> : <div className="flex min-h-60 flex-col items-center justify-center gap-3 px-4 text-center">
          <p role="status" className="text-sm text-text-secondary">{visibleRuns.length === 0 ? "All raid lines are hidden." : `No valid recorded ${metric} values for the visible raids.`}</p>
          {visibleRuns.length === 0 && <button type="button" className={actionClass} onClick={() => setHidden({})}>Show all raids</button>}
        </div>}
      </figure>

      <details className="mt-3 border-t border-gold-dim text-sm" onToggle={event => setVisibilityOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-gold">Choose visible raids</summary>
        {visibilityOpen && <div className="space-y-2 pb-3">
          {visibleRuns.length > 0 && <button type="button" className={actionClass} onClick={() => setHidden({})}>Show all raids</button>}
          <div role="group" aria-label="Visible raid lines" className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {newestFirst.map(run => {
              const shown = !hidden[run.key];
              const highlighted = run.key === highlightedRun?.key;
              return <button key={run.key} type="button" data-run-key={run.key} aria-pressed={shown} aria-label={`${shown ? "Hide" : "Show"} raid ${run.label}`} onClick={() => setHidden(current => ({ ...current, [run.key]: !current[run.key] }))} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-sm py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                <span className={cn("w-6 shrink-0 border-t", highlighted ? "border-t-[3px] text-gold-light" : "text-gold")} aria-hidden="true" />
                <span className={cn("min-w-0 break-words", shown ? "text-text-primary" : "text-text-secondary line-through")}><time dateTime={run.startedAt}>{run.label}</time>{highlighted && <span className="ml-2 text-xs text-text-secondary">Highlighted</span>}</span>
              </button>;
            })}
          </div>
        </div>}
      </details>

      <details className="border-t border-gold-dim text-sm" onToggle={event => setValuesOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-gold">View {metric} chart values</summary>
        {valuesOpen && <RaidValuesTable runs={newestFirst} rows={rows} playerName={playerName} scopeLabel={scopeLabel} metric={metric} includeShortPulls={includeShortPulls} />}
      </details>
    </div>
  );
}
