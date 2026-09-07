"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReportMetricView } from "@/lib/report-metric-view";

export function PlayerMetricControls({ showAll, defaultView }: {
  showAll: boolean;
  defaultView: ReportMetricView;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = new URLSearchParams(searchParams.toString());
  if (showAll) query.delete("metrics");
  else query.set("metrics", "all");
  const suffix = query.toString();
  const label = showAll ? "Show relevant metrics" : "Show all metrics";
  const descriptions: Record<ReportMetricView, string> = {
    damage: "Damage metrics lead from the recorded role and specialization.",
    healing: "Healing metrics lead from the recorded role and specialization. HPS excludes absorbs.",
    tank: "Tank metrics lead from the recorded role and specialization. Damage taken depends on the encounter and assignment.",
    all: "All summary metrics are shown because recorded roles or specializations are mixed, unknown or conflicting. Each fight shows its recorded role and specialization.",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-3xl text-sm text-text-secondary">{showAll ? "All metrics are shown. HPS is effective healing; APS and Healing + absorbs /s remain separate." : descriptions[defaultView]}</p>
      <Link href={`${pathname}${suffix ? `?${suffix}` : ""}`} scroll={false} prefetch={false}
        className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-gold-dim px-3 text-sm font-semibold text-gold hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
        {label}
      </Link>
    </div>
  );
}
