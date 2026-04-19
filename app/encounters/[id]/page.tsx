import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DamageMeter } from "@/components/meter/DamageMeter";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, formatNumber } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const enc = await db.encounter.findUnique({ where: { id }, include: { boss: true } });
  return { title: enc ? `${enc.boss.name} — ${enc.outcome}` : "Encounter" };
}

export default async function EncounterPage({ params }: Props) {
  const { id } = await params;

  const encounter = await db.encounter.findUnique({
    where: { id },
    include: {
      boss: true,
      upload: {
        select: {
          filename: true,
          guild:    { select: { name: true } },
          realm:    { select: { name: true, host: true } },
        },
      },
      participants: {
        orderBy: { dps: "desc" },
        include: { player: true },
      },
      milestones: {
        where: { supersededAt: null },
        include: { player: { select: { name: true } } },
      },
    },
  });

  if (!encounter) notFound();

  const dpsParts  = encounter.participants.filter(p => p.dps > 0);
  const healParts = encounter.participants.filter(p => p.hps > 100);
  const totalDps  = Math.round(encounter.totalDamage / Math.max(1, encounter.durationSeconds));
  const totalHps  = Math.round(encounter.totalHealing / Math.max(1, encounter.durationSeconds));

  return (
    <div className="pt-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-text-dim">
        <Link href="/bosses" className="hover:text-gold">Bosses</Link>
        <span className="mx-2">›</span>
        <Link href={`/bosses/${encounter.boss.slug}`} className="hover:text-gold">{encounter.boss.name}</Link>
        <span className="mx-2">›</span>
        <span className="text-text-secondary">Encounter</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            {encounter.boss.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={encounter.outcome === "KILL" ? "outcome-kill" : encounter.outcome === "WIPE" ? "outcome-wipe" : "outcome-unknown"}>
              {encounter.outcome}
            </span>
            <span className={`diff-badge ${encounter.difficulty.endsWith("H") ? "heroic" : "normal"}`}>
              {encounter.difficulty}
            </span>
            <span className="text-xs text-text-dim">{encounter.boss.raid}</span>
            {encounter.upload.guild && (
              <span className="text-xs text-text-dim">· {encounter.upload.guild.name}</span>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-text-dim">
          <div>{new Date(encounter.startedAt).toLocaleString()}</div>
          <div className="text-xs mt-0.5">{encounter.upload.filename}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Duration"     value={formatDuration(encounter.durationSeconds)} highlight />
        <StatCard label="Total Damage" value={formatNumber(encounter.totalDamage)} />
        <StatCard label="Raid DPS"     value={totalDps.toLocaleString()} sub="per second" />
        <StatCard label="Raid HPS"     value={totalHps.toLocaleString()} sub="per second" />
      </div>

      {/* Milestones from this encounter */}
      {encounter.milestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest">
            ✦ Milestones From This Encounter
          </p>
          {encounter.milestones.map(m => (
            <div key={m.id} className="milestone-banner flex items-center justify-between text-sm flex-wrap gap-2">
              <span>
                <span className="font-bold text-gold">#{m.rank}</span>
                {" "}all-time{" "}
                <span className="text-text-primary font-semibold">{m.player.name}</span>
                <span className="text-text-secondary"> · {m.metric}</span>
              </span>
              <span className="tabular-nums font-bold text-gold-light">
                {m.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {m.metric}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* DPS Meter */}
      {dpsParts.length > 0 && (
        <section>
          <SectionHeader title="Damage Breakdown" sub="Click a row to expand spell details" />
          <div className="bg-bg-panel border border-gold-dim rounded overflow-hidden">
            <DamageMeter participants={dpsParts} metric="dps" />
          </div>
        </section>
      )}

      {/* Healing Meter */}
      {healParts.length > 0 && (
        <section>
          <SectionHeader title="Healing Breakdown" />
          <div className="bg-bg-panel border border-gold-dim rounded overflow-hidden">
            <DamageMeter participants={healParts} metric="hps" />
          </div>
        </section>
      )}

      {/* Full roster */}
      <section>
        <SectionHeader
          title="Full Roster"
          sub={`${encounter.participants.length} participants`}
        />
        <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim">
          {encounter.participants.map(p => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover transition-colors">
              <div className="flex items-center gap-3">
                <Link
                  href={`/players/${encodeURIComponent(p.player.name)}`}
                  className="text-sm font-semibold hover:underline text-text-primary"
                >
                  {p.player.name}
                </Link>
                {p.player.class && (
                  <span className="text-xs text-text-dim">{p.player.class}</span>
                )}
                <Badge variant={p.role === "HEALER" ? "holy" : p.role === "TANK" ? "physical" : "gold"}>
                  {p.role}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-sm tabular-nums text-text-secondary">
                {p.dps > 0 && <span>{p.dps.toLocaleString(undefined, { maximumFractionDigits: 0 })} dps</span>}
                {p.hps > 100 && <span>{p.hps.toLocaleString(undefined, { maximumFractionDigits: 0 })} hps</span>}
                {p.deaths > 0 && <span className="text-danger">☠ {p.deaths}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
