import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-bg-hover", className)}
      {...props}
    />
  );
}

export function SkeletonMeterRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded bg-bg-card border border-gold-dim mb-1">
      <Skeleton className="w-5 h-4" />
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="w-32 h-4" />
      <div className="flex-1" />
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-12 h-4" />
    </div>
  );
}
