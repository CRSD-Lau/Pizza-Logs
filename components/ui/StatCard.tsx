import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NumericValue } from "./NumericValue";

interface StatCardProps {
  label:      string;
  value:      React.ReactNode;
  sub?:       ReactNode;
  highlight?: boolean;
  className?: string;
}

const groupColumns = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
} as const;

export function StatGroup({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: keyof typeof groupColumns;
  className?: string;
}) {
  return (
    <div className={cn(
      "grid gap-px overflow-hidden rounded-sm border border-gold-dim bg-gold-dim [&>div]:row-span-3 [&>div]:grid [&>div]:grid-rows-subgrid [&>div]:gap-y-0 [&>div]:rounded-none [&>div]:border-0",
      groupColumns[columns],
      className,
    )}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, highlight, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-sm border border-gold-dim bg-bg-panel px-3 py-4 sm:px-4",
        className
      )}
    >
      <div className="mb-1.5 text-xs font-semibold uppercase leading-5 tracking-wide text-text-secondary">
        {label}
      </div>
      <div className={cn(
        "break-words text-2xl font-bold leading-tight tabular-nums sm:text-3xl",
        highlight ? "text-gold-light" : "text-text-primary"
      )}>
        {typeof value === "number" ? <NumericValue value={value} /> : value === "—" || value === null || value === undefined ? <NumericValue value={null} /> : value}
      </div>
      {sub && <div className="mt-1 text-sm leading-snug text-text-secondary">{sub}</div>}
    </div>
  );
}
