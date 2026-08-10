import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin Upload History" };
export const dynamic = "force-dynamic";

export default async function AdminUploadsPage() {
  const uploads = await db.upload.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        select: {
          id: true,
          outcome: true,
          difficulty: true,
          boss: { select: { name: true, slug: true } },
        },
      },
    },
  });

  return (
    <div className="pt-10 space-y-8">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Admin Upload History</h1>
        <p className="text-text-secondary text-sm mt-1">{uploads.length} logs stored</p>
      </div>

      {uploads.length === 0 ? (
        <EmptyState
          title="No uploads yet"
          description="Upload your first combat log to get started."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader title="Recent Uploads" sub="Admin-only file history and parsing status" />
          <div className="space-y-2">
            {uploads.map((u) => {
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
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/uploads/${u.id}`}
                          className="text-sm font-semibold text-text-primary hover:text-gold transition-colors"
                        >
                          {u.filename}
                        </Link>
                        <Badge variant={statusVariant as Parameters<typeof Badge>[0]["variant"]}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="text-xs text-text-dim mt-0.5">
                        {u.realm?.name ?? "Unknown realm"}
                        {u.realm?.host ? ` - ${u.realm.host}` : ""}
                        {u.guild?.name ? ` - ${u.guild.name}` : ""}
                        {" - "}
                        {formatBytes(u.fileSize)}
                        {u.rawLineCount ? ` - ${u.rawLineCount.toLocaleString()} lines` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-text-dim text-right">
                      {new Date(u.createdAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {u.encounters.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-dim">{kills} kills - {wipes} wipes</span>
                      <div className="flex flex-wrap gap-1">
                        {u.encounters.slice(0, 12).map((enc) => (
                          <Link
                            key={enc.id}
                            href={`/encounters/${enc.id}`}
                            className={cn(
                              "text-[11px] px-2 py-0.5 rounded-xs border transition-colors",
                              enc.outcome === "KILL"
                                ? "bg-success/8 border-success/25 text-success hover:border-success/50"
                                : "bg-danger/8 border-danger/20 text-danger hover:border-danger/40"
                            )}
                          >
                            {enc.boss.name.split(" ").slice(-1)[0]} {enc.difficulty}
                          </Link>
                        ))}
                        {u.encounters.length > 12 && (
                          <span className="text-xs text-text-dim self-center">
                            +{u.encounters.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {u.errorMessage && (
                    <p className="text-xs text-danger">{u.errorMessage}</p>
                  )}

                  {effectivelyDone && (
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        href={`/admin/uploads/${u.id}`}
                        className="text-xs text-gold hover:text-gold-light transition-colors"
                      >
                        View upload details &rarr;
                      </Link>
                      <Link
                        href={`/raids/${u.id}/sessions/0`}
                        className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Open first raid session &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
