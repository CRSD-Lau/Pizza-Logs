import { Skeleton } from "@/components/ui/Skeleton";

export default function GuildRosterLoading() {
  return (
    <div className="pt-10 space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="border border-gold-dim bg-bg-panel rounded p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
