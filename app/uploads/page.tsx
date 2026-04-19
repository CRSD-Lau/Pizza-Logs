import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Upload History" };
export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  const uploads = await db.upload.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      realm:  { select: { name: true, host: true } },
      guild:  { select: { name: true } },
      encounters: {
        select: {
          id:         true,
          outcome:    true,
          difficulty: true,
          boss:       { select: { name: true, slug: true } },
        },
      },
    },
  });

  return (
    <div className="pt-10 space-y-8">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Upload History</h1>
        <p className="text-text-secondary text-sm mt-1">{uploads.length} logs uploaded</p>
      </div>

      {uploads.length === 0 ? (
        <EmptyState
          title="No uploads yet"
          description="Upload your first combat log to get started."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        <div className="space-y-2">
          {uploads.map(u => {
            const kills = u.encounters.filter(e => e.outcome === "KILL").length;
            const wipes = u.encounters.filter(e => e.outcome === "WIPE").length;
            const statusVariant = u.status === "DONE"
              ? "kill"
              : u.status === "FAILED" ? "wipe"
              : u.status === "DUPLICATE" ? "normal"
              : "gold";

            return (
              <div
                key={u.id}
                className="bg-bg-panel border border-gold-dim rounded p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/uploads/${u.id}`}
                        className="text-sm font-semibold text-text-primary hover:text-gold transition-colors"
                      >
                        {u.filename}
                      </Link>
                      <Badge variant={statusVariant as Parameters<typeof Badge>[0]["variant"]}>
                        {u.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-text-dim mt-0.5">
                      {u.realm?.name ?? "Unknown realm"}
                      {u.realm?.host ? ` · ${u.realm.host}` : ""}
                      {u.guild?.name ? ` · ${u.guild.name}` : ""}
                      {" · "}
                      {formatBytes(u.fileSize)}
                      {u.rawLineCount ? ` · ${u.rawLineCount.toLocaleString()} lines` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-text-dim text-right">
                    {new Date(u.createdAt).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Encounters */}
                {u.encounters.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-dim">{kills} kills · {wipes} wipes</span>
                    <div className="flex flex-wrap gap-1">
                      {u.encounters.slice(0, 12).map(enc => (
                        <Link
                          key={enc.id}
                          href={`/encounters/${enc.id}`}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-sm border transition-colors",
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

                {u.status === "DONE" && (
                  <div>
                    <Link
                      href={`/uploads/${u.id}`}
                      className="text-xs text-gold hover:text-gold-light transition-colors"
                    >
                      View raid detail →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
