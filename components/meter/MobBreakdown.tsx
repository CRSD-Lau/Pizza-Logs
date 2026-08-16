"use client";

import { useId, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
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
      {title && (
        <div className="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2 border-b border-gold-dim px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim sm:grid">
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">% total</span>
        </div>
      )}
      {!title && (
        <div className="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim sm:grid">
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">% total</span>
        </div>
      )}

      <div className="space-y-0.5">
        {mobs.map((mob, index) => {
          const pct     = totalDamage > 0 ? Math.round((mob.totalDamage / totalDamage) * 100) : 0;
          const fillPct = maxDamage   > 0 ? (mob.totalDamage / maxDamage) * 100 : 0;
          const critPct = mob.hits    > 0 ? Math.round(mob.crits / mob.hits * 100) : 0;
          const isOpen  = selected === mob.name;

          return (
            <div key={mob.name}>
              <button
                type="button"
                className={cn(
                  getRevealClassName(),
                  "meter-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 bg-bg-card px-3 py-3 text-left sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] sm:gap-2 sm:py-2.5",
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

                <span className="relative z-10 text-sm font-semibold text-text-primary truncate">
                  {mob.name}
                </span>
                <span className="relative z-10 row-start-2 text-sm tabular-nums text-text-primary sm:row-start-auto sm:text-right">
                  {formatNumber(mob.totalDamage)}
                </span>
                <span className="relative z-10 hidden text-right text-xs tabular-nums text-text-secondary sm:block">
                  {mob.hits.toLocaleString()} hits · {critPct}% crit
                </span>
                <span className="relative z-10 col-start-2 row-start-1 text-right text-sm tabular-nums text-text-secondary sm:col-start-auto sm:row-start-auto">
                  {pct}%
                </span>
              </button>

              {/* Per-player drill-down */}
              <div id={`${breakdownId}-${index}`} hidden={!isOpen}>
              {isOpen && (
                <div className="mb-1 space-y-1 rounded-b border border-t-0 border-gold-dim bg-bg-panel px-3 py-2 animate-fade-in-up">
                  {mob.byPlayer
                    .sort((a, b) => b.damage - a.damage)
                    .map(p => {
                      const color      = getClassColor(p.playerClass ?? p.name);
                      const playerPct  = mob.totalDamage > 0 ? Math.round(p.damage / mob.totalDamage * 100) : 0;
                      const playerCrit = p.hits > 0 ? Math.round(p.crits / p.hits * 100) : 0;

                      return (
                        <div key={p.name} className="flex items-center gap-2 text-xs">
                          <span className="w-28 font-medium truncate" style={{ color }}>{p.name}</span>
                          <div className="flex-1 h-3 bg-bg-hover rounded-sm overflow-hidden">
                            <div
                              className="h-full rounded-sm"
                              style={{ width: `${playerPct}%`, background: color, opacity: 0.65 }}
                            />
                          </div>
                          <span className="w-14 text-right tabular-nums text-text-secondary">
                            {formatNumber(p.damage)}
                          </span>
                          <span className="hidden w-28 shrink-0 text-right tabular-nums text-text-dim sm:block">
                            {p.hits.toLocaleString()} hits · {playerCrit}% crit
                          </span>
                          <span className="w-8 shrink-0 text-right tabular-nums text-text-dim">{playerPct}%</span>
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
