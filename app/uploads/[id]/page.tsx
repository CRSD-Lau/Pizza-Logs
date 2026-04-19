import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { formatBytes, formatDuration, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const upload = await db.upload.findUnique({ where: { id }, select: { filename: true } });
  return { title: upload ? `Raid: ${upload.filename}` : "Raid Detail" };
}

export default async function RaidDetailPage({ params }: Props) {
  const { id } = await params;

  const upload = await db.upload.findUnique({
    where: { id },
    include: {
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        orderBy: { startedAt: "asc" },
        include: {
          boss: { select: { name: true, slug: true, raid: true } },
          participants: {
            include: { player: { select: { name: true, class: true } } },
          },
        },
      },
    },
  });

  if (!upload) notFound();

  // ── Raid-level aggregates ─────────────────────────────────────
  const kills     = upload.encounters.filter(e => e.outcome === "KILL").length;
  const wipes     = upload.encounters.filter(e => e.outcome === "WIPE").length;
  const totalDmg  = upload.encounters.reduce((s, e) => s + e.totalDamage, 0);
  const totalHeal = upload.encounters.reduce((s, e) => s + e.totalHealing, 0);
  const totalSecs = upload.encounters.reduce((s, e) => s + e.durationSeconds, 0);

  // ── Unique players ────────────────────────────────────────────
  const playerSet = new Map<string, string | null>();
  for (const enc of upload.encounters) {
    for (const p of enc.participants) {
      if (!playerSet.has(p.player.name)) {
        playerSet.set(p.player.name, p.player.class ?? null);
      }
    }
  }

  // ── Raid-wide mob damage (aggregate targetBreakdown across all encounters) ──
  const mobMap = new Map<string, {
    totalDamage: number; hits: number; crits: number;
    byPlayer: Map<string, { damage: number; hits: number; crits: number; playerClass: string | null }>;
  }>();

  for (const enc of upload.encounters) {
    for (const p of enc.participants) {
      if (!p.targetBreakdown) continue;
      const td = p.targetBreakdown as Record<string, { damage: number; hits: number; crits: number }>;
      for (const [mob, stats] of Object.entries(td)) {
        if (!stats || stats.damage <= 0) continue;
        const entry = mobMap.get(mob) ?? { totalDamage: 0, hits: 0, crits: 0, byPlayer: new Map() };
        entry.totalDamage += stats.damage;
        entry.hits        += stats.hits;
        entry.crits       += stats.crits;
        const prev = entry.byPlayer.get(p.player.name) ?? {
          damage: 0, hits: 0, crits: 0, playerClass: p.player.class ?? null,
        };
        prev.damage += stats.damage;
        prev.hits   += stats.hits;
        prev.crits  += stats.crits;
        entry.byPlayer.set(p.player.name, prev);
        mobMap.set(mob, entry);
      }
    }
  }

  const mobEntries: MobEntry[] = Array.from(mobMap.entries())
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
    .map(([name, data]) => ({
      name,
      totalDamage: data.totalDamage,
      hits:        data.hits,
      crits:       data.crits,
      byPlayer:    Array.from(data.byPlayer.entries()).map(([pName, pd]) => ({
        name:        pName,
        playerClass: pd.playerClass,
        damage:      pd.damage,
        hits:        pd.hits,
        crits:       pd.crits,
      })),
    }));

  // ── Group encounters by raid ──────────────────────────────────
  const raidGroups = new Map<string, typeof upload.encounters>();
  for (const enc of upload.encounters) {
    const raid = enc.boss.raid;
    const arr  = raidGroups.get(raid) ?? [];
    arr.push(enc);
    raidGroups.set(raid, arr);
  }

  return (
    <div className="pt-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-text-dim">
        <Link href="/uploads" className="hover:text-gold">Upload History</Link>
        <span className="mx-2">›</span>
        <span className="text-text-secondary">Raid Detail</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            Raid: {upload.filename}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-text-dim">
            <span>{upload.realm?.name ?? "Unknown realm"}</span>
            {upload.realm?.host && <span>· {upload.realm.host}</span>}
            {upload.guild?.name && <span>· {upload.guild.name}</span>}
            <span>· {formatBytes(upload.fileSize)}</span>
            {upload.rawLineCount && <span>· {upload.rawLineCount.toLocaleString()} lines</span>}
            <Badge variant={upload.status === "DONE" ? "kill" : upload.status === "FAILED" ? "wipe" : "gold"}>
              {upload.status}
            </Badge>
          </div>
        </div>
        <div className="text-xs text-text-dim text-right">
          <div>{new Date(upload.createdAt).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}</div>
          {upload.parsedAt && (
            <div className="mt-0.5 text-text-dim">
              Parsed {new Date(upload.parsedAt).toLocaleString("en-US", {
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>

      {/* Raid Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Encounters"   value={`${kills}K / ${wipes}W`} highlight />
        <StatCard label="Total Damage" value={formatNumber(totalDmg)} />
        <StatCard label="Total Healing" value={formatNumber(totalHeal)} />
        <StatCard label="Active Time"   value={formatDuration(totalSecs)} sub="sum of all pulls" />
      </div>

      {/* Encounter list — grouped by raid */}
      {upload.encounters.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            title="Encounters"
            sub={`${upload.encounters.length} pulls`}
          />
          {Array.from(raidGroups.entries()).map(([raidName, encs]) => (
            <div key={raidName} className="space-y-1">
              <p className="text-xs font-semibold text-text-dim uppercase tracking-widest px-1">
                {raidName}
              </p>
              <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim overflow-hidden">
                {encs.map(enc => {
                  const raidDps = enc.durationSeconds > 0
                    ? Math.round(enc.totalDamage / enc.durationSeconds)
                    : 0;
                  return (
                    <Link
                      key={enc.id}
                      href={`/encounters/${enc.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[11px] font-bold px-1.5 py-0.5 rounded",
                          enc.outcome === "KILL"
                            ? "text-success bg-success/10"
                            : enc.outcome === "WIPE"
                            ? "text-danger bg-danger/10"
                            : "text-text-dim bg-bg-hover"
                        )}>
                          {enc.outcome}
                        </span>
                        <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors">
                          {enc.boss.name}
                        </span>
                        <span className={`diff-badge ${enc.difficulty.endsWith("H") ? "heroic" : "normal"}`}>
                          {enc.difficulty}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-xs tabular-nums text-text-secondary">
                        <span>{formatDuration(enc.durationSeconds)}</span>
                        <span>{formatNumber(enc.totalDamage)} dmg</span>
                        <span>{raidDps.toLocaleString()} rdps</span>
                        <span className="text-text-dim">
                          {new Date(enc.startedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Raid-wide mob damage */}
      {mobEntries.length > 0 && (
        <section>
          <SectionHeader
            title="Mob Damage (Entire Raid)"
            sub="Aggregate damage dealt to every target across all encounters — click to drill down by player"
          />
          <div className="bg-bg-panel border border-gold-dim rounded overflow-hidden">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </section>
      )}

      {/* Roster */}
      {playerSet.size > 0 && (
        <section>
          <SectionHeader
            title="Raid Roster"
            sub={`${playerSet.size} unique players`}
          />
          <div className="bg-bg-panel border border-gold-dim rounded p-4 flex flex-wrap gap-2">
            {Array.from(playerSet.entries()).map(([name, cls]) => (
              <Link
                key={name}
                href={`/players/${encodeURIComponent(name)}`}
                className="text-xs px-2 py-1 rounded border border-gold-dim bg-bg-card hover:border-gold transition-colors"
              >
                <span className="text-text-primary font-medium">{name}</span>
                {cls && <span className="text-text-dim ml-1.5">{cls}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
