import { Skeleton } from "@/components/ui/Skeleton";
import { DataPanel, PageShell } from "@/components/ui/PageLayout";

export default function GuildRosterLoading() {
  return (
    <PageShell>
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
