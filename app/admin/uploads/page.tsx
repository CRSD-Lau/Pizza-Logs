import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildRaidSessionRoutesWithAnalytics, getRaidSessionPath } from "@/lib/raid-session-slug";
import { cn, formatBytes, formatCountLabel, formatDateTimeUtc, formatInteger } from "@/lib/utils";
import { buildDirectoryHref, getDirectoryPagination, parseDirectoryPage, type DirectoryQueryValue } from "@/lib/directory-pagination";

export const metadata: Metadata = { title: "Admin Upload History" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminUploadsPage({ searchParams }: {
  searchParams: Promise<{ page?: DirectoryQueryValue }>;
}) {
  await requireAdmin();
  const totalUploads = await db.upload.count();
  const pagination = getDirectoryPagination(totalUploads, parseDirectoryPage((await searchParams).page), PAGE_SIZE);
  const uploads = await db.upload.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: pagination.startIndex,
    take: PAGE_SIZE,
    include: {
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        select: {
          id: true,
          sessionIndex: true,
          startedAt: true,
          outcome: true,
          difficulty: true,
          boss: { select: { name: true, slug: true } },
        },
      },
    },
  });

  return (
    <div className="page-shell">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Admin Upload History</h1>
        <p className="text-text-secondary text-sm mt-1">{formatCountLabel(totalUploads, "upload")} stored · Newest first</p>
      </div>

      {uploads.length === 0 ? (
        <EmptyState
          title="No uploads yet"
          description="Upload your first combat log to get started."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader title="Uploads" sub="Admin-only file history and parsing status. Counts include all recorded attempts." />
          <div className="space-y-2">
            {uploads.map((u) => {
              const raidRoutes = buildRaidSessionRoutesWithAnalytics(
                u.encounters.map(encounter => ({
                  sessionIndex: encounter.sessionIndex,
                  startedAt: encounter.startedAt,
                })),
                u.sessionAnalytics,
              );
              const firstRaidRoute = raidRoutes[0];
              const kills = u.encounters.filter(e => e.outcome === "KILL").length;
              const wipes = u.encounters.filter(e => e.outcome === "WIPE").length;
              const effectivelyDone = u.status === "DONE" || (u.status === "PARSING" && u.encounters.length > 0);
              const statusVariant = effectivelyDone
                ? "kill"
                : u.status === "FAILED" ? "wipe"
                : u.status === "DUPLICATE" ? "normal"
                : "gold";
              const statusLabel = effectivelyDone ? "DONE" : u.status;

              return (
                <div key={u.id} className="bg-bg-panel border border-gold-dim rounded-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/uploads/${u.id}`}
                          className="inline-flex min-h-11 min-w-0 max-w-full items-center break-all text-sm font-semibold text-text-primary hover:text-gold transition-colors"
                        >
                          {u.filename}
                        </Link>
                        <Badge variant={statusVariant as Parameters<typeof Badge>[0]["variant"]}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="break-words text-sm text-text-dim mt-0.5">
                        {u.realm?.name ?? "Unknown realm"}
                        {u.realm?.host ? ` - ${u.realm.host}` : ""}
                        {u.guild?.name ? ` - ${u.guild.name}` : ""}
                        {" - "}
                        {formatBytes(u.fileSize)}
                        {u.rawLineCount != null ? ` - ${formatCountLabel(u.rawLineCount, "line")}` : ""}
                      </div>
                    </div>
                    <div className="text-sm text-text-dim sm:text-right">
                      {formatDateTimeUtc(u.createdAt)}
                    </div>
                  </div>

                  {u.encounters.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-dim">{formatCountLabel(kills, "kill")} · {formatCountLabel(wipes, "wipe")}</span>
                      <div className="flex flex-wrap gap-1">
                        {u.encounters.slice(0, 12).map((enc) => (
                          <Link
                            key={enc.id}
                            href={`/encounters/${enc.id}`}
                            className={cn(
                              "inline-flex min-h-11 items-center text-xs px-2 py-1 rounded-xs border transition-colors",
                              enc.outcome === "KILL"
                                ? "bg-success/8 border-success/25 text-success hover:border-success/50"
                                : "bg-danger/8 border-danger/20 text-danger hover:border-danger/40"
                            )}
                          >
                            {enc.boss.name} · {enc.difficulty} · {enc.outcome}
                          </Link>
                        ))}
                        {u.encounters.length > 12 && (
                          <span className="text-xs text-text-dim self-center">
                            {formatCountLabel(u.encounters.length - 12, "more encounter")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {u.errorMessage && (
                    <p className="break-words text-sm text-danger">{u.errorMessage}</p>
                  )}

                  {effectivelyDone && firstRaidRoute && (
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        href={`/admin/uploads/${u.id}`}
                        className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light transition-colors"
                      >
                        View upload details &rarr;
                      </Link>
                      <Link
                        href={getRaidSessionPath(u.publicSlug, firstRaidRoute)}
                        className="inline-flex min-h-11 items-center text-sm text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Open first raid &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <nav aria-label="Upload history pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-dim pt-4 text-sm">
        <p className="tabular-nums text-text-secondary">
          {formatInteger(pagination.firstVisible)}–{formatInteger(pagination.lastVisible)} of {formatCountLabel(totalUploads, "upload")} · Page {formatInteger(pagination.currentPage)} of {formatInteger(pagination.totalPages)}
        </p>
        <div className="flex flex-wrap gap-2">
          {pagination.currentPage > 1 ? (
            <Link href={buildDirectoryHref("/admin/uploads", { page: pagination.currentPage - 1 })} className="inline-flex min-h-11 items-center rounded-sm border border-gold-dim px-4 text-gold hover:border-gold">Previous</Link>
          ) : <span aria-disabled="true" className="inline-flex min-h-11 items-center px-4 text-text-dim">Previous</span>}
          {pagination.currentPage < pagination.totalPages ? (
            <Link href={buildDirectoryHref("/admin/uploads", { page: pagination.currentPage + 1 })} className="inline-flex min-h-11 items-center rounded-sm border border-gold-dim px-4 text-gold hover:border-gold">Next</Link>
          ) : <span aria-disabled="true" className="inline-flex min-h-11 items-center px-4 text-text-dim">Next</span>}
        </div>
      </nav>
    </div>
  );
}
