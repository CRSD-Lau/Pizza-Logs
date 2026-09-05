import { cn, formatInteger, formatPercent, formatRate, isDisplayNumber } from "@/lib/utils";

/** Shared visible and assistive text for an unavailable measurement versus a measured zero. */
export function NumericValue({ value, kind = "integer", className }: {
  value: number | null | undefined;
  kind?: "integer" | "rate" | "percent";
  className?: string;
}) {
  if (!isDisplayNumber(value)) {
    return <span className={className}><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></span>;
  }
  const format = kind === "percent" ? formatPercent : kind === "rate" ? formatRate : formatInteger;
  return <span className={cn("tabular-nums", className)}>{format(value)}</span>;
}
