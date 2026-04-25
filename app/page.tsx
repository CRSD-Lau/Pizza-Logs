import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { UploadZoneWithRefresh } from "@/components/upload/UploadZoneWithRefresh";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { getWeekBounds } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getHomeStats() {
  const { start } = getWeekBounds();
  const [totalEncounters, totalKills, weekKills, recentUploads] =
    await Promise.all([
      db.encounter.count(),
      db.encounter.count({ where: { outcome: "KILL" } }),
      db.encounter.count({ where: { outcome: "KILL", startedAt: { gte: start } } }),
      db.upload.findMany({
        orderBy: { createdAt: "desc" },
        take:    5,
        select: {
          id:        true,
          filename:  true,
          status:    true,
          createdAt: true,
          realm:     { select: { name: true } },
          _count:    { select: { encounters: true } },
        },
      }),
    ]);

  return { totalEncounters, totalKills, weekKills, recentUploads };
}

export default async function HomePage() {
  const stats = await getHomeStats();

  return (
    <div className="pt-10 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="heading-cinzel text-3xl sm:text-4xl font-bold text-gold-light text-glow-gold">
          Pizza Logs
        </h1>
        <p className="text-text-secondary text-base max-w-xl mx-auto">
          WoW raid combat log analytics for PizzaWarriors. Upload a log, track your best kills,
          and claim all-time records across every WotLK boss.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Encounters" value={stats.totalEncounters.toLocaleString()} />
        <StatCard label="Boss Kills"        value={stats.totalKills.toLocaleString()} highlight />
        <StatCard label="Kills This Week"   value={stats.weekKills.toLocaleString()} />
        <StatCard label="Active Bosses"     value="56" sub="WotLK content" />
      </div>

      {/* Upload zone */}
      <section>
        <SectionHeader title="Upload Combat Log" sub="Drag and drop your WoWCombatLog.txt" />
        <UploadZoneWithRefresh />
      </section>

      {/* Leaderboards teaser */}
      <section>
        <SectionHeader
          title="All-Time Leaderboards"
          sub="Top 10 DPS and HPS for every boss"
          action={
            <Link href="/leaderboards" className="text-xs text-gold hover:text-gold-light uppercase tracking-wide">
              View all →
            </Link>
          }
        />
        <Link
          href="/leaderboards"
          className="block bg-bg-panel border border-gold-dim rounded px-6 py-10 text-center hover:border-gold/50 transition-colors group"
        >
          <p className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold group-hover:text-gold transition-colors">
            Leaderboards
          </p>
          <p className="text-text-secondary text-sm mt-2">
            All-time top 10 DPS and HPS for every WotLK boss
          </p>
        </Link>
      </section>

      {/* Recent uploads */}
      {stats.recentUploads.length > 0 && (
        <section>
          <SectionHeader
            title="Recent Uploads"
            action={
              <Link href="/uploads" className="text-xs text-gold hover:text-gold-light uppercase tracking-wide">
                Full history →
              </Link>
            }
          />
          <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
            {stats.recentUploads.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.filename}</p>
                  <p className="text-xs text-text-dim">
                    {u.realm?.name ?? "Unknown realm"} ·{" "}
                    {new Date(u.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span>{u._count.encounters} encounters</span>
                  <Badge variant={u.status === "DONE" ? "kill" : u.status === "FAILED" ? "wipe" : "gold"}>
                    {u.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
