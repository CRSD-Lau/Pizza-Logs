import { Skeleton } from "@/components/ui/Skeleton";
import { DataPanel, PageShell } from "@/components/ui/PageLayout";
import { GuildCrest } from "@/components/brand/GuildCrest";

export default function GuildRosterLoading() {
  return (
    <PageShell>
      <div role="status" className="flex items-center gap-3 text-sm text-text-secondary">
        <GuildCrest />
        <p>Loading guild roster...</p>
      </div>
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-72" />
      </div>
      <DataPanel className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </DataPanel>
    </PageShell>
  );
}
