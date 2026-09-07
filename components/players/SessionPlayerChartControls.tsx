"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SESSION_PLAYER_METRICS, getSessionPlayerMetricLabel, type SessionPlayerMetric } from "@/lib/session-player-chart";

export function SessionPlayerChartControls({ metric }: { metric: SessionPlayerMetric }) {
  const id = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3" aria-busy={pending}>
      <label htmlFor={id} className="text-sm font-semibold text-text-secondary">Chart metric</label>
      <select
        id={id}
        value={metric}
        disabled={pending}
        className="min-h-11 max-w-full rounded-sm border border-gold-dim bg-bg-panel px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-60"
        onChange={event => {
          const query = new URLSearchParams(searchParams.toString());
          query.set("chartMetric", event.target.value);
          startTransition(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
        }}
      >
        {SESSION_PLAYER_METRICS.map(option => <option key={option} value={option}>{getSessionPlayerMetricLabel(option)}</option>)}
      </select>
      <span className="text-sm text-text-secondary">Choose a metric to compare all players on the same basis.</span>
    </div>
  );
}
