"use client";

import { useState } from "react";
import { cn, formatDps, formatNumber } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";

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
  totalAbsorbs:  number;
  dps:           number;
  hps:           number;
  aps:           number;
  deaths:        number;
  critPct:       number;
  role:          string;
  spellBreakdown?: unknown;
  absorbBreakdown?: unknown;
  /** Boss-only damage (pre-computed from targetBreakdown filtered to boss mob) */
  bossDmg?: number;
}

interface DamageMeterProps {
  participants: Participant[];
  metric?:      "dps" | "hps" | "aps" | "ha";
}

export function DamageMeter({ participants, metric = "dps" }: DamageMeterProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const rate = (participant: Participant) => metric === "ha"
    ? participant.hps + participant.aps
    : participant[metric];
  const raw = (participant: Participant) => metric === "hps"
    ? participant.totalHealing
    : metric === "aps"
      ? participant.totalAbsorbs
      : metric === "ha"
        ? participant.totalHealing + participant.totalAbsorbs
      : participant.totalDamage;
  const sorted = [...participants].sort((a, b) => rate(b) - rate(a));

  const maxVal = sorted[0] ? rate(sorted[0]) : 1;
  const totalVal = sorted.reduce((sum, participant) => sum + rate(participant), 0);

  return (
    <div>
      {/* Header */}
      <div className="grid gap-2 px-3 py-1.5 text-[11px] font-semibold text-text-dim uppercase tracking-widest"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
        <span>Player</span>
        <span className="text-right">{metric === "hps" ? "Healing" : metric === "aps" ? "Absorbs" : metric === "ha" ? "Heal + Absorb" : "Damage"}</span>
        <span className="text-right">{metric === "ha" ? "H+A PS" : metric.toUpperCase()}</span>
        <span className="text-right">Hits</span>
        <span className="text-right">% total</span>
      </div>

      <div className="space-y-0.5">
        {sorted.map((p, idx) => {
          const val      = rate(p);
          const rawVal   = raw(p);
          const fillPct  = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const pct      = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
          const color    = getClassColor(p.player.class ?? p.player.name);
          const isActive = selected === p.player.name;

          return (
            <div key={p.player.name}>
              <div
                className={cn(
                  getRevealClassName(),
                  "meter-row grid gap-2 items-center px-3 py-2.5 bg-bg-card",
                  isActive && "active"
                )}
                style={getRevealStyle(idx, { gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" })}
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
                    className="w-5 h-5 rounded-sm text-[9px] font-bold flex items-center justify-center shrink-0"
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
                  {metric === "dps" && p.bossDmg !== undefined && p.bossDmg < rawVal * 0.98 && (
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
                    {metric === "aps"
                      ? absorbHitCount(p.absorbBreakdown)
                      : metric === "ha"
                        ? `${p.critPct.toFixed(0)}%c / ${absorbHitCount(p.absorbBreakdown)}`
                        : `${p.critPct.toFixed(0)}%c`}
                  </span>
                </div>

                {/* % of total */}
                <div className="text-right text-sm text-text-secondary tabular-nums relative z-10">
                  {pct}%
                </div>
              </div>

              {/* Expanded spell breakdown */}
              {isActive && metric === "aps" && isAbsorbBreakdown(p.absorbBreakdown) && (
                <AbsorbBreakdown breakdown={p.absorbBreakdown} />
              )}
              {isActive && metric !== "aps" && isSpellBreakdown(p.spellBreakdown) && (
                <SpellBreakdown breakdown={p.spellBreakdown} />
              )}
              {isActive && metric === "ha" && isAbsorbBreakdown(p.absorbBreakdown) && (
                <AbsorbBreakdown breakdown={p.absorbBreakdown} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AbsorbEntry = { amount: number; hits: number; ambiguousHits: number };

function isAbsorbBreakdown(value: unknown): value is Record<string, AbsorbEntry> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function absorbHitCount(value: unknown): string {
  if (!isAbsorbBreakdown(value)) return "0h";
  return `${Object.values(value).reduce((sum, entry) => sum + entry.hits, 0)}h`;
}

function AbsorbBreakdown({ breakdown }: { breakdown: Record<string, AbsorbEntry> }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1].amount - a[1].amount);
  const maxAmount = entries[0]?.[1].amount ?? 1;

  return (
    <div className="bg-bg-panel border border-gold-dim border-t-0 rounded-b px-3 py-2 mb-1 space-y-1 animate-fade-in-up">
      {entries.map(([spell, stats]) => (
        <div key={spell} className="flex items-center gap-2 text-xs">
          <span className="w-40 text-text-primary truncate font-medium">{spell}</span>
          <div className="flex-1 h-3 bg-bg-hover rounded-sm overflow-hidden">
            <div className="h-full rounded-sm bg-holy" style={{ width: `${stats.amount / maxAmount * 100}%` }} />
          </div>
          <span className="w-16 text-right tabular-nums text-text-secondary">{formatNumber(stats.amount)}</span>
          <span className="w-20 text-right tabular-nums text-text-dim">
            {stats.hits} hits{stats.ambiguousHits > 0 ? `, ${stats.ambiguousHits} mixed` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function isSpellBreakdown(value: unknown): value is Record<string, SpellEntry> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function SpellBreakdown({
  breakdown,
}: {
  breakdown: Record<string, SpellEntry>;
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
            <div className="flex-1 h-3 bg-bg-hover rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
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
