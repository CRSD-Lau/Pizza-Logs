"use client";

import { useId, useState } from "react";
import { cn, formatDps, formatNumber } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
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
  const breakdownId = useId();

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
      <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim sm:grid">
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
          const classIconUrl = getClassIconUrl(p.player.class);
          const isActive = selected === p.player.name;

          return (
            <div key={p.player.name}>
              <button
                type="button"
                className={cn(
                  getRevealClassName(),
                  "meter-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 bg-bg-card px-3 py-3 text-left sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] sm:gap-2 sm:py-2.5",
                  isActive && "active"
                )}
                style={getRevealStyle(idx)}
                onClick={() => setSelected(isActive ? null : p.player.name)}
                aria-expanded={isActive}
                aria-controls={`${breakdownId}-${idx}`}
              >
                {/* Bar background fill */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: color, opacity: 0.12, width: `${fillPct}%` }}
                />

                {/* Player name */}
                <div className="relative z-10 flex min-w-0 items-center gap-2">
                  <span className="w-4 text-right text-xs font-bold text-text-dim">{idx + 1}</span>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-xs border text-[9px] font-bold"
                    style={{ background: `${color}22`, color }}
                  >
                    {classIconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Static WoW class icon host.
                      <img src={classIconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (p.player.name).substring(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="text-[15px] font-semibold truncate" style={{ color }}>
                    {p.player.name}
                  </span>
                </div>

                {/* Damage */}
                <div className="relative z-10 row-start-2 text-left sm:row-start-auto sm:text-right">
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    {formatNumber(rawVal)}
                  </div>
                  {/* Boss-only damage sub-label — shown when adds inflated the total */}
                  {metric === "dps" && p.bossDmg !== undefined && p.bossDmg < rawVal * 0.98 && (
                    <div className="text-xs tabular-nums leading-tight text-text-dim">
                      {formatNumber(p.bossDmg)} boss
                    </div>
                  )}
                </div>

                {/* DPS/HPS */}
                <div className="relative z-10 col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    {formatDps(val)}
                  </div>
                </div>

                {/* Hits + crit */}
                <div className="relative z-10 hidden text-right sm:block">
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
                <div className="relative z-10 col-start-2 row-start-2 text-right text-sm tabular-nums text-text-secondary sm:col-start-auto sm:row-start-auto">
                  {pct}%
                </div>
              </button>

              {/* Expanded spell breakdown */}
              <div id={`${breakdownId}-${idx}`}>
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
          <span className="w-16 shrink-0 text-right tabular-nums text-text-secondary">{formatNumber(stats.amount)}</span>
          <span className="hidden w-20 shrink-0 text-right tabular-nums text-text-dim sm:block">
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
          1: "var(--color-school-physical)", 2: "var(--color-school-holy)", 4: "var(--color-school-fire)",
          8: "var(--color-school-nature)", 16: "var(--color-school-frost)", 32: "var(--color-school-shadow)", 64: "var(--color-school-arcane)",
        };
        const color = schoolColors[s.school] ?? "var(--color-text-dim)";

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
            <span className="hidden w-12 text-right tabular-nums text-text-dim sm:block">
              {s.hits}h {Math.round(s.crits / Math.max(1, s.hits) * 100)}%c
            </span>
          </div>
        );
      })}
    </div>
  );
}
