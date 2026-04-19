"use client";

import { useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";

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

  const totalDamage = mobs.reduce((s, m) => s + m.totalDamage, 0);
  const maxDamage   = mobs[0]?.totalDamage ?? 1;

  if (mobs.length === 0) return null;

  return (
    <div>
      {title && (
        <div className="grid gap-2 px-3 py-1.5 text-[11px] font-semibold text-text-dim uppercase tracking-widest border-b border-gold-dim"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">% total</span>
        </div>
      )}
      {!title && (
        <div className="grid gap-2 px-3 py-1.5 text-[11px] font-semibold text-text-dim uppercase tracking-widest"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <span>Target</span>
          <span className="text-right">Damage</span>
          <span className="text-right">Hits / Crit%</span>
          <span className="text-right">% total</span>
        </div>
      )}

      <div className="space-y-0.5">
        {mobs.map(mob => {
          const pct     = totalDamage > 0 ? Math.round((mob.totalDamage / totalDamage) * 100) : 0;
          const fillPct = maxDamage   > 0 ? (mob.totalDamage / maxDamage) * 100 : 0;
          const critPct = mob.hits    > 0 ? Math.round(mob.crits / mob.hits * 100) : 0;
          const isOpen  = selected === mob.name;

          return (
            <div key={mob.name}>
              <div
                className={cn(
                  "meter-row grid gap-2 items-center px-3 py-2.5 bg-bg-card cursor-pointer",
                  isOpen && "active"
                )}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}
                onClick={() => setSelected(isOpen ? null : mob.name)}
              >
                {/* Bar fill */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "#b8952a", opacity: 0.1, width: `${fillPct}%` }}
                />

                <span className="relative z-10 text-sm font-semibold text-text-primary truncate">
                  {mob.name}
                </span>
                <span className="relative z-10 text-right text-sm tabular-nums text-text-primary">
                  {formatNumber(mob.totalDamage)}
                </span>
                <span className="relative z-10 text-right text-xs tabular-nums text-text-secondary">
                  {mob.hits.toLocaleString()} · {critPct}%c
                </span>
                <span className="relative z-10 text-right text-sm tabular-nums text-text-secondary">
                  {pct}%
                </span>
              </div>

              {/* Per-player drill-down */}
              {isOpen && (
                <div className="bg-bg-panel border border-gold-dim border-t-0 rounded-b px-3 py-2 mb-1 space-y-1 animate-fade-in-up">
                  {mob.byPlayer
                    .sort((a, b) => b.damage - a.damage)
                    .map(p => {
                      const color      = getClassColor(p.playerClass ?? p.name);
                      const playerPct  = mob.totalDamage > 0 ? Math.round(p.damage / mob.totalDamage * 100) : 0;
                      const playerCrit = p.hits > 0 ? Math.round(p.crits / p.hits * 100) : 0;

                      return (
                        <div key={p.name} className="flex items-center gap-2 text-xs">
                          <span className="w-28 font-medium truncate" style={{ color }}>{p.name}</span>
                          <div className="flex-1 h-3 bg-bg-hover rounded overflow-hidden">
                            <div
                              className="h-full rounded"
                              style={{ width: `${playerPct}%`, background: color, opacity: 0.65 }}
                            />
                          </div>
                          <span className="w-14 text-right tabular-nums text-text-secondary">
                            {formatNumber(p.damage)}
                          </span>
                          <span className="w-16 text-right tabular-nums text-text-dim">
                            {p.hits}h {playerCrit}%c
                          </span>
                          <span className="w-8 text-right tabular-nums text-text-dim">{playerPct}%</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
