"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCompactNumber, formatRate } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import type { SessionPlayerMetric } from "@/lib/session-player-chart";

export interface ChartPoint {
  bossName: string;
  [playerName: string]: number | string | null;
}

export interface PlayerLine {
  name:      string;
  isSubject: boolean;
  color:     string;
}

interface Props {
  data:    ChartPoint[];
  players: PlayerLine[];
  metric:  SessionPlayerMetric;
}

type TooltipPayload = {
  value: number | null;
  name?: string;
  color?: string;
};

type TooltipEntry = {
  value: number;
  name: string;
  color: string;
};

function isTooltipEntry(entry: TooltipPayload): entry is TooltipEntry {
  return entry.value != null && !!entry.name && !!entry.color;
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  metric: SessionPlayerMetric;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   "var(--color-bg-card)",
      border:       "1px solid color-mix(in srgb, var(--color-gold) 30%, transparent)",
      borderRadius: "4px",
      padding:      "8px 12px",
      fontSize:     12,
    }}>
      <p style={{ color: "var(--color-gold)", fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload
        .filter(isTooltipEntry)
        .sort((a, b) => b.value - a.value)
        .map((e) => (
          <p key={e.name} style={{ color: e.color, margin: "2px 0" }}>
            <span style={{ fontWeight: 600 }}>{e.name}</span>
            {": "}
            {formatRate(e.value)} {metric}
          </p>
        ))
      }
    </div>
  );
}

export function SessionLineChart({ data, players, metric }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
    <p className="text-sm text-text-secondary">{metric} by encounter. Values use two decimals: K for thousands, M for millions.</p>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-gold) 7%, transparent)" />
        <XAxis
          dataKey="bossName"
          tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }}
          tickLine={false}
          axisLine={{ stroke: "color-mix(in srgb, var(--color-gold) 15%, transparent)" }}
          interval="preserveStartEnd"
          minTickGap={18}
          tickMargin={8}
          tickFormatter={(v: string) => {
            if (v === "Gunship Battle") return "Gunship";
            if (v === "The Lich King") return "Lich King";
            const words = v.split(" ");
            return words.length > 1 ? words[words.length - 1] : v;
          }}
        />
        <YAxis
          tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatCompactNumber(v)}
          width={80}
        />
        <Tooltip content={<CustomTooltip metric={metric} />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value: string, entry: { color?: string }) => (
            <span style={{ color: entry.color ?? "var(--color-text-secondary)" }}>{value}</span>
          )}
        />
        {players.map(p => (
          <Line
            key={p.name}
            type="monotone"
            dataKey={p.name}
            stroke={p.color}
            strokeWidth={p.isSubject ? 2.5 : 1.5}
            strokeOpacity={p.isSubject ? 1 : 0.78}
            dot={{
              r: p.isSubject ? 4.5 : 3,
              fill: p.color,
              stroke: "var(--color-bg-panel)",
              strokeWidth: 1.25,
            }}
            activeDot={{
              r: p.isSubject ? 6 : 4.5,
              fill: p.color,
              stroke: "var(--color-text-primary)",
              strokeWidth: 1.25,
            }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    <details className="border-y border-gold-dim text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-gold">View {metric} chart values</summary>
      <div role="region" aria-label={`${metric} chart values`} tabIndex={0} className="overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-gold">
        <table className="w-full text-sm">
          <caption className="sr-only">{metric} values by encounter and player, with two decimals and K/M units. Unavailable means no recorded value.</caption>
          <thead><tr><th scope="col" className="px-3 py-2 text-left">Encounter</th>{players.map(player => <th key={player.name} scope="col" className="px-3 py-2 text-right">{player.name}</th>)}</tr></thead>
          <tbody>{data.map((point, index) => <tr key={`${point.bossName}-${index}`} className="border-t border-gold-dim">
            <th scope="row" className="px-3 py-2 text-left font-medium">{point.bossName}</th>
            {players.map(player => <td key={player.name} className="whitespace-nowrap px-3 py-2 text-right tabular-nums"><NumericValue value={typeof point[player.name] === "number" ? point[player.name] as number : null} kind="rate" /></td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    </div>
  );
}
