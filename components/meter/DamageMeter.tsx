"use client";

import { useState } from "react";
import { cn, formatDps, formatNumber } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";

interface SpellEntry {
  damage:  number;
  healing: number;
  hits:    number;
  crits:   number;
  school:  number;
}

interface Participant {
  player:        { name: string; class?: string | null };
  totalDamage:   number;
  totalHealing:  number;
  dps:           number;
  hps:           number;
  deaths:        number;
  critPct:       number;
  role:          string;
  // Prisma returns JsonValue for Json fields — we cast at usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spellBreakdown?: any;
  /** Boss-only damage (pre-computed from targetBreakdown filtered to boss mob) */
  bossDmg?: number;
}

interface DamageMeterProps {
  participants: Participant[];
  metric?:      "dps" | "hps";
}

export function DamageMeter({ participants, metric = "dps" }: DamageMeterProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...participants].sort((a, b) =>
    metric === "hps" ? b.hps - a.hps : b.dps - a.dps
  );

  const maxVal = sorted[0] ? (metric === "hps" ? sorted[0].hps : sorted[0].dps) : 1;
  const totalVal = sorted.reduce((s, p) => s + (metric === "hps" ? p.hps : p.dps), 0);

  return (
    <div>
      {/* Header */}
      <div className="grid gap-2 px-3 py-1.5 text-[11px] font-semibold text-text-dim uppercase tracking-widest"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
        <span>Player</span>
        <span className="text-right">Damage</span>
        <span className="text-right">{metric.toUpperCase()}</span>
        <span className="text-right">Hits</span>
        <span className="text-right">% total</span>
      </div>

      <div className="space-y-0.5">
        {sorted.map((p, idx) => {
          const val      = metric === "hps" ? p.hps : p.dps;
          const rawVal   = metric === "hps" ? p.totalHealing : p.totalDamage;
          const fillPct  = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const pct      = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
          const color    = getClassColor(p.player.class ?? p.player.name);
          const isActive = selected === p.player.name;

          return (
            <div key={p.player.name}>
              <div
                className={cn(
                  "meter-row grid gap-2 items-center px-3 py-2.5 bg-bg-card",
                  isActive && "active"
                )}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}
                onClick={() => setSelected(isActive ? null : p.player.name)}
              >
                {/* Bar background fill */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: color, opacity: 0.12, width: `${fillPct}%` }}
                />

                {/* Player name */}
                <div className="flex items-center gap-2 relative z-10">
                  <span className="text-[11px] text-text-dim w-4 text-right font-bold">{idx + 1}</span>
                  <span
                    className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}22`, color }}
                  >
                    {(p.player.name).substring(0, 2).toUpperCase()}
                  </span>
                  <span className="text-[15px] font-semibold truncate" style={{ color }}>
                    {p.player.name}
                  </span>
                </div>

                {/* Damage */}
                <div className="text-right relative z-10">
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    {formatNumber(rawVal)}
                  </div>
                  {/* Boss-only damage sub-label — shown when adds inflated the total */}
                  {p.bossDmg !== undefined && p.bossDmg < rawVal * 0.98 && (
                    <div className="text-[10px] tabular-nums text-text-dim leading-tight">
                      {formatNumber(p.bossDmg)} boss
                    </div>
                  )}
                </div>

                {/* DPS/HPS */}
                <div className="text-right relative z-10">
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    {formatDps(val)}
                  </div>
                </div>

                {/* Hits + crit */}
                <div className="text-right relative z-10">
                  <span className="text-xs text-text-secondary tabular-nums">
                    {p.deaths > 0 && <span className="text-danger mr-1">☠{p.deaths}</span>}
                    {p.critPct.toFixed(0)}%c
                  </span>
                </div>

                {/* % of total */}
                <div className="text-right text-sm text-text-secondary tabular-nums relative z-10">
                  {pct}%
                </div>
              </div>

              {/* Expanded spell breakdown */}
              {isActive && p.spellBreakdown && (
                <SpellBreakdown breakdown={p.spellBreakdown} totalVal={rawVal} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpellBreakdown({
  breakdown,
  totalVal,
}: {
  breakdown: Record<string, SpellEntry>;
  totalVal:  number;
}) {
  const entries = Object.entries(breakdown)
    .sort((a, b) => (b[1].damage + b[1].healing) - (a[1].damage + a[1].healing))
    .slice(0, 15);

  const maxSpell = entries[0] ? (entries[0][1].damage || entries[0][1].healing) : 1;

  return (
    <div className="bg-bg-panel border border-gold-dim border-t-0 rounded-b px-3 py-2 mb-1 space-y-1 animate-fade-in-up">
      {entries.map(([spell, s]) => {
        const val  = s.damage || s.healing;
        const pct  = maxSpell > 0 ? (val / maxSpell) * 100 : 0;
        const schoolColors: Record<number, string> = {
          1: "#c0c8d8", 2: "#f0c040", 4: "#e06030",
          8: "#60c060", 16: "#80c8f0", 32: "#a070d0", 64: "#d080f0",
        };
        const color = schoolColors[s.school] ?? "#888";

        return (
          <div key={spell} className="flex items-center gap-2 text-xs">
            <span className="w-32 text-text-primary truncate font-medium">{spell}</span>
            <div className="flex-1 h-3 bg-bg-hover rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="w-14 text-right tabular-nums text-text-secondary">
              {formatNumber(val)}
            </span>
            <span className="w-12 text-right tabular-nums text-text-dim">
              {s.hits}h {Math.round(s.crits / Math.max(1, s.hits) * 100)}%c
            </span>
          </div>
        );
      })}
    </div>
  );
}
