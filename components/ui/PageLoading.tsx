import { GuildCrest } from "@/components/brand/GuildCrest";
import { DataPanel, PageShell } from "@/components/ui/PageLayout";
import { Skeleton } from "@/components/ui/Skeleton";

export function PageLoading({ message = "Loading page..." }: { message?: string }) {
  return (
    <PageShell>
      <div role="status" className="flex items-center gap-3 text-sm text-text-secondary">
        <GuildCrest surface="solid" />
        <p>{message}</p>
      </div>
      <div aria-hidden="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-72" />
      </div>
      <DataPanel className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} aria-hidden="true" className="h-10 w-full" />
        ))}
      </DataPanel>
    </PageShell>
  );
}
