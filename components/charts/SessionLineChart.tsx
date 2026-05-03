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
import { formatNumber } from "@/lib/utils";

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
  metric:  "DPS" | "HPS";
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
  metric: "DPS" | "HPS";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   "#1a1a24",
      border:       "1px solid rgba(200,168,75,0.3)",
      borderRadius: "4px",
      padding:      "8px 12px",
      fontSize:     12,
    }}>
      <p style={{ color: "#c8a84b", fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload
        .filter(isTooltipEntry)
        .sort((a, b) => b.value - a.value)
        .map((e) => (
          <p key={e.name} style={{ color: e.color, margin: "2px 0" }}>
            <span style={{ fontWeight: 600 }}>{e.name}</span>
            {" — "}
            {e.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {metric}
          </p>
        ))
      }
    </div>
  );
}

export function SessionLineChart({ data, players, metric }: Props) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,168,75,0.07)" />
        <XAxis
          dataKey="bossName"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(200,168,75,0.15)" }}
          interval={0}
          tickFormatter={(v: string) => {
            // Abbreviate long boss names to last word
            const words = v.split(" ");
            return words.length > 2 ? words[words.length - 1] : v;
          }}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatNumber(v)}
          width={52}
        />
        <Tooltip content={<CustomTooltip metric={metric} />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value: string, entry: { color?: string }) => (
            <span style={{ color: entry.color ?? "#9ca3af" }}>{value}</span>
          )}
        />
        {players.map(p => (
          <Line
            key={p.name}
            type="monotone"
            dataKey={p.name}
            stroke={p.color}
            strokeWidth={p.isSubject ? 2.5 : 1.5}
            strokeOpacity={p.isSubject ? 1 : 0.55}
            dot={{ r: p.isSubject ? 4 : 2.5, fill: p.color, strokeWidth: 0 }}
            activeDot={{ r: p.isSubject ? 6 : 4, strokeWidth: 0 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
