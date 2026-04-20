import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes, formatDuration, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ id: string; sessionIdx: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, sessionIdx } = await params;
  const upload = await db.upload.findUnique({ where: { id }, select: { filename: true } });
  return { title: upload ? `Session ${Number(sessionIdx) + 1} — ${upload.filename}` : "Raid Session" };
}

export default async function SessionDetailPage({ params }: Props) {
  const { id, sessionIdx } = await params;
  const sessionIndex = parseInt(sessionIdx, 10);
  if (isNaN(sessionIndex)) notFound();

  const upload = await db.upload.findUnique({
    where: { id },
    select: {
      id: true, filename: true, fileSize: true, rawLineCount: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
    },
  });
  if (!upload) notFound();

  const encounters = await db.encounter.findMany({
    where:   { uploadId: id, sessionIndex },
    orderBy: { startedAt: "asc" },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: {
        include: { player: { select: { name: true, class: true } } },
      },
    },
  });

  if (encounters.length === 0) notFound();

  // ── Session-level aggregates ───────────────────────────────────────
  const kills     = encounters.filter(e => e.outcome === "KILL").length;
  const wipes     = encounters.filter(e => e.outcome === "WIPE").length;
  const totalDmg  = encounters.reduce((s, e) => s + e.totalDamage, 0);
  const totalHeal = encounters.reduce((s, e) => s + e.totalHealing, 0);
  const totalSecs = encounters.reduce((s, e) => s + e.durationSeconds, 0);
  const startedAt = encounters[0].startedAt;
  const endedAt   = encounters[encounters.length - 1].endedAt;

  // ── Count all sessions (for nav context) ─────────────────────────
  const sessionCount = await db.encounter.groupBy({
    by:    ["sessionIndex"],
    where: { uploadId: id },
  }).then(r => r.length);

  // ── Unique players ────────────────────────────────────────────────
  const playerSet = new Map<string, string | null>();
  for (const enc of encounters) {
    for (const p of enc.participants) {
      if (!playerSet.has(p.player.name)) playerSet.set(p.player.name, p.player.class ?? null);
    }
  }

  // ── Mob breakdown (session-wide, from targetBreakdown) ───────────
  const mobMap = new Map<string, {
    totalDamage: number; hits: number; crits: number;
    byPlayer: Map<string, { damage: number; hits: number; crits: number; playerClass: string | null }>;
  }>();

  for (const enc of encounters) {
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

  // ── Group by raid zone ─────────────────────────────────────────────
  const raidGroups = new Map<string, typeof encounters>();
  for (const enc of encounters) {
    const arr = raidGroups.get(enc.boss.raid) ?? [];
    arr.push(enc);
    raidGroups.set(enc.boss.raid, arr);
  }

  return (
    <div className="pt-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-text-dim flex items-center gap-1 flex-wrap">
        <Link href="/uploads" className="hover:text-gold">History</Link>
        <span>›</span>
        <Link href={`/uploads/${id}`} className="hover:text-gold truncate max-w-[200px]">{upload.filename}</Link>
        <span>›</span>
        <span className="text-text-secondary">
          {sessionCount === 1 ? "Raid Session" : `Session ${sessionIndex + 1} of ${sessionCount}`}
        </span>
      </div>

      {/* Prev / Next session nav */}
      {sessionCount > 1 && (
        <div className="flex items-center gap-3 text-xs">
          {sessionIndex > 0 && (
            <Link href={`/uploads/${id}/sessions/${sessionIndex - 1}`} className="text-gold hover:text-gold-light">
              ← Session {sessionIndex}
            </Link>
          )}
          {sessionIndex < sessionCount - 1 && (
            <Link href={`/uploads/${id}/sessions/${sessionIndex + 1}`} className="text-gold hover:text-gold-light ml-auto">
              Session {sessionIndex + 2} →
            </Link>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            {sessionCount === 1 ? "Raid Session" : `Session ${sessionIndex + 1}`}
            <span className="text-text-secondary font-normal text-lg ml-3">
              {[...raidGroups.keys()].join(" · ")}
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-text-dim">
            <span>{upload.realm?.name ?? "Unknown realm"}</span>
            {upload.realm?.host && <span>· {upload.realm.host}</span>}
            {upload.guild?.name && <span>· {upload.guild.name}</span>}
            <span>·</span>
            <span>
              {new Date(startedAt).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
              {" → "}
              {new Date(endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Kills / Wipes"  value={`${kills}K / ${wipes}W`} highlight />
        <StatCard label="Total Damage"   value={formatNumber(totalDmg)} />
        <StatCard label="Total Healing"  value={formatNumber(totalHeal)} />
        <StatCard label="Active Time"    value={formatDuration(totalSecs)} sub="sum of all pulls" />
      </div>

      {/* Encounters by raid zone */}
      <section className="space-y-4">
        <SectionHeader title="Encounters" sub={`${encounters.length} pulls`} />
        {Array.from(raidGroups.entries()).map(([raidName, encs]) => (
          <div key={raidName} className="space-y-1">
            <p className="text-xs font-semibold text-text-dim uppercase tracking-widest px-1">{raidName}</p>
            <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim overflow-hidden">
              {encs.map(enc => {
                const rdps = enc.durationSeconds > 0
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
                        enc.outcome === "KILL" ? "text-success bg-success/10"
                        : enc.outcome === "WIPE" ? "text-danger bg-danger/10"
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
                      <span>{rdps.toLocaleString()} rdps</span>
                      <span className="text-text-dim">
                        {new Date(enc.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Session-wide mob damage */}
      {mobEntries.length > 0 && (
        <section>
          <SectionHeader
            title="Mob Damage — Full Session"
            sub="Aggregate damage to every target across all pulls · click to drill down by player"
          />
          <div className="bg-bg-panel border border-gold-dim rounded overflow-hidden">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </section>
      )}

      {/* Roster */}
      {playerSet.size > 0 && (
        <section>
          <SectionHeader title="Raid Roster" sub={`${playerSet.size} players`} />
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
