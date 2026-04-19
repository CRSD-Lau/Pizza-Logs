import { cn } from "@/lib/utils";

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
        "bg-bg-panel rounded border px-4 py-4",
        highlight
          ? "border-gold-dim shadow-gold-glow/20"
          : "border-gold-dim",
        className
      )}
    >
      <div className="text-[11px] font-semibold text-text-dim uppercase tracking-widest mb-2">
        {label}
      </div>
      <div className={cn(
        "text-2xl font-bold leading-none tabular-nums mb-1",
        highlight ? "text-gold-light text-glow-gold" : "text-text-primary"
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}
