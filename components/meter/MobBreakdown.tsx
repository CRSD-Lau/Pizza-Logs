"use client";

import { useId, useState } from "react";
import { cn, formatCountLabel } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { getClassColor } from "@/lib/constants/classes";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";

export interface MobEntry {
  name:        string;
  totalDamage: number;
  hits:        number;
  crits:       number;
  byPlayer:    PlayerDamage[];
}

export interface PlayerDamage {
  name:        string;
  playerClass: string | null | undefined;
  damage:      number;
  hits:        number;
  crits:       number;
}

interface MobBreakdownProps {
  mobs:  MobEntry[];
  title?: string;
}

export function MobBreakdown({ mobs, title }: MobBreakdownProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const breakdownId = useId();

  const totalDamage = mobs.reduce((s, m) => s + m.totalDamage, 0);
  const maxDamage   = mobs[0]?.totalDamage ?? 1;

  if (mobs.length === 0) return null;

  return (
    <div>
      <p className="px-3 py-2 text-xs text-text-secondary">{formatCountLabel(mobs.length, "target")} · Highest damage first</p>
      {title && (
        <div className="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2 border-b border-gold-dim px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim lg:grid">
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">Share of total</span>
        </div>
      )}
      {!title && (
        <div className="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim lg:grid">
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">Share of total</span>
        </div>
      )}

      <div className="space-y-0.5">
        {mobs.map((mob, index) => {
          const pct     = totalDamage > 0 ? (mob.totalDamage / totalDamage) * 100 : null;
          const fillPct = maxDamage   > 0 ? (mob.totalDamage / maxDamage) * 100 : 0;
          const critPct = mob.hits    > 0 ? mob.crits / mob.hits * 100 : null;
          const isOpen  = selected === mob.name;

          return (
            <div key={mob.name}>
              <button
                type="button"
                className={cn(
                  getRevealClassName(),
                  "meter-row grid w-full grid-cols-2 items-center gap-x-3 gap-y-2 bg-bg-card px-3 py-3 text-left lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-2 lg:py-2.5",
                  isOpen && "active"
                )}
                style={getRevealStyle(index)}
                onClick={() => setSelected(isOpen ? null : mob.name)}
                aria-expanded={isOpen}
                aria-controls={`${breakdownId}-${index}`}
              >
                {/* Bar fill */}
                <div
                  className="absolute inset-0 pointer-events-none bg-gold/10"
                  style={{ width: `${fillPct}%` }}
                />

                <span className="relative z-10 col-span-2 break-words text-sm font-semibold text-text-primary lg:col-span-1">
                  {mob.name}
                </span>
                <span className="relative z-10 text-sm tabular-nums text-text-primary lg:text-right">
                  <span className="block text-xs text-text-secondary lg:hidden">Damage</span>
                  <NumericValue value={mob.totalDamage} kind="number" />
                </span>
                <span className="relative z-10 col-span-2 row-start-3 text-xs tabular-nums text-text-secondary lg:col-span-1 lg:row-start-auto lg:text-right">
                  {formatCountLabel(mob.hits, "hit")} · <NumericValue value={critPct} kind="percent" /> crit
                </span>
                <span className="relative z-10 text-right text-sm tabular-nums text-text-secondary">
                  <span className="block text-xs lg:hidden">Share of total</span>
                  <NumericValue value={pct} kind="percent" />
                </span>
              </button>

              {/* Per-player drill-down */}
              <div id={`${breakdownId}-${index}`} hidden={!isOpen}>
              {isOpen && (
                <div className="mb-1 space-y-1 rounded-b border border-t-0 border-gold-dim bg-bg-panel px-3 py-2 animate-fade-in-up">
                  <p className="py-1 text-xs text-text-secondary">{formatCountLabel(mob.byPlayer.length, "player")} · Highest damage to this target first</p>
                  {[...mob.byPlayer]
                    .sort((a, b) => b.damage - a.damage)
                    .map(p => {
                      const color      = getClassColor(p.playerClass ?? p.name);
                      const playerPct  = mob.totalDamage > 0 ? p.damage / mob.totalDamage * 100 : null;
                      const playerCrit = p.hits > 0 ? p.crits / p.hits * 100 : null;

                      return (
                        <div key={p.name} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-1 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto_auto]">
                          <span className="min-w-0 break-words font-medium" style={{ color }}>{p.name}</span>
                          <div className="col-span-2 row-start-3 h-3 bg-bg-hover rounded-sm overflow-hidden lg:col-span-1 lg:row-start-auto">
                            <div
                              className="h-full rounded-sm"
                              style={{ width: `${playerPct ?? 0}%`, background: color, opacity: 0.65 }}
                            />
                          </div>
                          <span className="text-right tabular-nums text-text-secondary">
                            <NumericValue value={p.damage} kind="number" /> damage
                          </span>
                          <span className="text-xs tabular-nums text-text-secondary lg:text-right">
                            {formatCountLabel(p.hits, "hit")} · <NumericValue value={playerCrit} kind="percent" /> crit
                          </span>
                          <span className="text-right text-xs tabular-nums text-text-secondary"><NumericValue value={playerPct} kind="percent" /> of target</span>
                        </div>
                      );
                    })}
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
