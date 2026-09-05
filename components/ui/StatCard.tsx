import { cn } from "@/lib/utils";
import { NumericValue } from "./NumericValue";

interface StatCardProps {
  label:      string;
  value:      React.ReactNode;
  sub?:       string;
  highlight?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, highlight, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 px-4 py-3",
        highlight
          ? "rounded-sm border border-gold-mid bg-bg-card/85 shadow-card"
          : "border-l border-gold-dim bg-transparent first:border-l-0",
        className
      )}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-dim">
        {label}
      </div>
      <div className={cn(
        "mb-1 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl",
        highlight ? "text-gold-light text-glow-gold" : "text-text-primary"
      )}>
        {typeof value === "number" ? <NumericValue value={value} /> : value === "—" || value === null || value === undefined ? <NumericValue value={null} /> : value}
      </div>
      {sub && <div className="text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}
