"use client";

import { useId, useState } from "react";
import { cn, formatCountLabel, formatInteger, formatPercent } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
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
  const totalLabel = metric === "hps" ? "Effective healing" : metric === "aps" ? "Absorbs" : metric === "ha" ? "Healing + absorbs" : "Damage";
  const rateLabel = metric === "ha" ? "Healing + absorbs /s" : metric.toUpperCase();

  return (
    <div>
      {/* Header */}
      <p className="px-3 py-2 text-xs text-text-secondary">{formatCountLabel(sorted.length, "player")} · Highest {rateLabel} first · Positions describe this list</p>
      <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim lg:grid">
        <span>Player</span>
        <span className="text-right">{totalLabel}</span>
        <span className="text-right">{rateLabel}</span>
        <span className="text-right">
          {metric === "aps" ? "Absorb hits" : metric === "ha" ? "Overall crit / absorbs" : "Overall crit"}
        </span>
        <span className="text-right">Share of total</span>
      </div>

      <div className="space-y-0.5">
        {sorted.map((p, idx) => {
          const val      = rate(p);
          const rawVal   = raw(p);
          const fillPct  = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const pct      = totalVal > 0 ? (val / totalVal) * 100 : null;
          const color    = getClassColor(p.player.class ?? p.player.name);
          const classIconUrl = getClassIconUrl(p.player.class);
          const isActive = selected === p.player.name;
          const absorbHits = absorbHitCount(p.absorbBreakdown);
          const absorbHitsLabel = absorbHits === null ? "Absorb hits unavailable" : formatCountLabel(absorbHits, "absorb hit");

          return (
            <div key={p.player.name}>
              <button
                type="button"
                className={cn(
                  getRevealClassName(),
                  "meter-row grid w-full grid-cols-2 items-center gap-x-3 gap-y-2 bg-bg-card px-3 py-3 text-left lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:gap-2 lg:py-2.5",
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
                <div className="relative z-10 col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                  <span className="shrink-0 text-right text-xs font-bold tabular-nums text-text-secondary"><span className="sr-only">Position </span><span aria-hidden="true">#</span>{formatInteger(idx + 1)}</span>
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
                <div className="relative z-10 min-w-0 text-left lg:text-right">
                  <span className="block text-xs text-text-secondary lg:hidden">{totalLabel}</span>
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    <NumericValue value={rawVal} />
                  </div>
                  {/* Boss-only damage sub-label — shown when adds inflated the total */}
                  {metric === "dps" && p.bossDmg !== undefined && p.bossDmg < rawVal * 0.98 && (
                    <div className="text-xs tabular-nums leading-tight text-text-dim">
                      <NumericValue value={p.bossDmg} /> boss damage
                    </div>
                  )}
                </div>

                {/* DPS/HPS */}
                <div className="relative z-10 min-w-0 text-right">
                  <span className="block text-xs text-text-secondary lg:hidden">{rateLabel}</span>
                  <div className="text-sm font-semibold tabular-nums text-text-primary">
                    <NumericValue value={val} kind="rate" />
                  </div>
                </div>

                {/* Hits + crit */}
                <div className="relative z-10 text-left lg:text-right">
                  <span className="text-xs text-text-secondary tabular-nums">
                    {p.deaths > 0 && <><span className="text-danger">{formatCountLabel(p.deaths, "death")}</span>{" · "}</>}
                    {metric === "aps"
                      ? absorbHitsLabel
                      : metric === "ha"
                        ? `${formatPercent(p.critPct)} overall crit · ${absorbHitsLabel}`
                        : `${formatPercent(p.critPct)} overall crit`}
                  </span>
                </div>

                {/* % of total */}
                <div className="relative z-10 text-right text-sm tabular-nums text-text-secondary">
                  <span className="block text-xs lg:hidden">Share of total</span>
                  <NumericValue value={pct} kind="percent" />
                </div>
              </button>

              {/* Expanded spell breakdown */}
              <div id={`${breakdownId}-${idx}`}>
                {isActive && metric === "aps" && isAbsorbBreakdown(p.absorbBreakdown) && (
                  <AbsorbBreakdown breakdown={p.absorbBreakdown} />
                )}
                {isActive && metric !== "aps" && isSpellBreakdown(p.spellBreakdown) && (
                  <SpellBreakdown
                    breakdown={p.spellBreakdown}
                    outputMetric={metric === "dps" ? "damage" : "healing"}
                  />
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

function absorbHitCount(value: unknown): number | null {
  if (!isAbsorbBreakdown(value)) return null;
  const entries = Object.values(value);
  if (entries.some(entry => !entry || !Number.isFinite(entry.hits) || entry.hits < 0)) return null;
  return entries.reduce((sum, entry) => sum + entry.hits, 0);
}

export function AbsorbBreakdown({ breakdown }: { breakdown: Record<string, AbsorbEntry> }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1].amount - a[1].amount);
  const maxAmount = Math.max(...entries.map(([, stats]) => stats.amount), 0);

  return (
    <div className="bg-bg-panel border border-gold-dim border-t-0 rounded-b px-3 py-2 mb-1 space-y-1 animate-fade-in-up">
      <p className="py-1 text-xs text-text-secondary">{formatCountLabel(entries.length, "shield ability", "shield abilities")} · Highest absorbs first</p>
      {entries.map(([spell, stats]) => {
        const pct = maxAmount > 0
          ? Math.min(100, Math.max(0, (stats.amount / maxAmount) * 100))
          : 0;

        return (
          <div key={spell} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-1 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
            <span className="min-w-0 break-words text-text-primary font-medium">{spell}</span>
            <div
              className="col-span-2 row-start-3 h-3 bg-bg-hover rounded-sm overflow-hidden lg:col-span-1 lg:row-start-auto"
              role="meter"
              aria-label={`${spell} relative absorb volume`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`${formatPercent(pct)} of the largest shield ability`}
            >
              <div className="h-full rounded-sm bg-school-holy" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-right tabular-nums text-text-secondary"><NumericValue value={stats.amount} /> absorbs</span>
            <span className="col-span-2 text-right text-xs tabular-nums text-text-secondary lg:col-span-1">
              {formatCountLabel(stats.hits, "hit")}{stats.ambiguousHits > 0 ? ` · ${formatCountLabel(stats.ambiguousHits, "mixed hit")}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function isSpellBreakdown(value: unknown): value is Record<string, SpellEntry> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function SpellBreakdown({
  breakdown,
  outputMetric,
}: {
  breakdown: Record<string, SpellEntry>;
  outputMetric: "damage" | "healing";
}) {
  const [visibleLimit, setVisibleLimit] = useState(15);
  const entries = Object.entries(breakdown)
    .filter(([, spell]) => spell[outputMetric] > 0)
    .sort((a, b) => b[1][outputMetric] - a[1][outputMetric]);
  const visibleEntries = entries.slice(0, visibleLimit);

  const maxSpell = Math.max(
    ...entries.map(([, spell]) => spell[outputMetric]),
    0,
  );

  return (
    <div className="bg-bg-panel border border-gold-dim border-t-0 rounded-b px-3 py-2 mb-1 space-y-1 animate-fade-in-up">
      <p className="py-1 text-xs text-text-secondary" role="status">Showing {formatInteger(visibleEntries.length)} of {formatCountLabel(entries.length, "spell")} · Highest {outputMetric} first</p>
      {visibleEntries.map(([spell, s]) => {
        const val = s[outputMetric];
        const pct = maxSpell > 0
          ? Math.min(100, Math.max(0, (val / maxSpell) * 100))
          : 0;
        const schoolColors: Record<number, string> = {
          1: "var(--color-school-physical)", 2: "var(--color-school-holy)", 4: "var(--color-school-fire)",
          8: "var(--color-school-nature)", 16: "var(--color-school-frost)", 32: "var(--color-school-shadow)", 64: "var(--color-school-arcane)",
        };
        const color = schoolColors[s.school] ?? "var(--color-text-dim)";

        return (
          <div key={spell} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-1 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
            <span className="min-w-0 break-words text-text-primary font-medium">{spell}</span>
            <div
              className="col-span-2 row-start-3 h-3 bg-bg-hover rounded-sm overflow-hidden lg:col-span-1 lg:row-start-auto"
              role="meter"
              aria-label={`${spell} relative ${outputMetric} volume`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`${formatPercent(pct)} of the largest ${outputMetric} ability`}
            >
              <div
                className="h-full rounded-sm"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="text-right tabular-nums text-text-secondary">
              <NumericValue value={val} /> {outputMetric}
            </span>
            <span className="col-span-2 text-right text-xs tabular-nums text-text-secondary lg:col-span-1">
              {formatCountLabel(s.hits, "total event")} · <NumericValue value={s.hits > 0 ? s.crits / s.hits * 100 : null} kind="percent" /> overall crit
            </span>
          </div>
        );
      })}
      {visibleEntries.length < entries.length && (
        <button type="button" onClick={() => setVisibleLimit(limit => limit + 15)} className="mt-2 inline-flex min-h-11 items-center rounded-sm border border-gold-dim px-3 text-sm font-semibold text-gold hover:border-gold">
          Show {formatCountLabel(Math.min(15, entries.length - visibleEntries.length), "more spell")}
        </button>
      )}
    </div>
  );
}
