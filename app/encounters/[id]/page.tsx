import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DamageMeter } from "@/components/meter/DamageMeter";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { getClassIconUrl } from "@/lib/class-icons";
import { getClassColor } from "@/lib/constants/classes";
import { getRaidSessionRouteByIndex } from "@/lib/raid-session-routing.server";
import { formatRaidSessionTitle, getRaidSessionPath } from "@/lib/raid-session-slug";
import { formatDuration, formatNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const enc = await db.encounter.findUnique({ where: { id }, include: { boss: true } });
  return { title: enc ? `${enc.boss.name} - ${enc.outcome}` : "Encounter" };
}

export default async function EncounterPage({ params }: Props) {
  const { id } = await params;

  const encounter = await db.encounter.findUnique({
    where: { id },
    include: {
      boss: true,
      upload: {
        select: {
          id: true,
          guild: { select: { name: true } },
          realm: { select: { name: true, host: true } },
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

  const raidSessionRoute = await getRaidSessionRouteByIndex(
    encounter.upload.id,
    encounter.sessionIndex,
  );

  const bossName = encounter.boss.name;
  const participantsWithBossDmg = encounter.participants.map((p) => {
    const td = p.targetBreakdown as Record<string, { damage: number }> | null;
    const bossDmg = td?.[bossName]?.damage ?? undefined;
    return { ...p, bossDmg };
  });

  const dpsParts = participantsWithBossDmg.filter(p => p.dps > 0);
  const healParts = participantsWithBossDmg.filter(p => p.hps > 0);
  const absorbParts = participantsWithBossDmg.filter(p => p.aps > 0);
  const healAndAbsorbParts = participantsWithBossDmg.filter(p => p.hps + p.aps > 0);
  const durationSec = (encounter.durationMs ?? 0) > 0
    ? encounter.durationMs / 1000
    : Math.max(1, encounter.durationSeconds);
  const totalDps = Math.round(encounter.totalDamage / durationSec);
  const totalHps = Math.round(encounter.totalHealing / durationSec);
  const totalAps = Math.round(encounter.totalAbsorbs / durationSec);
  const totalHealAndAbsorb = encounter.totalHealing + encounter.totalAbsorbs;
  const totalHealAndAbsorbPs = Math.round(totalHealAndAbsorb / durationSec);

  const auraRows = encounter.participants.flatMap((participant) => {
    const breakdown = (participant.auraBreakdown ?? {}) as Record<string, {
      uptimeSeconds: number;
      uptimePct: number;
      applications: number;
    }>;
    const consumables = (participant.consumableBreakdown ?? {}) as Record<string, unknown>;
    return Object.entries(breakdown).filter(([aura]) => !(aura in consumables)).map(([aura, stats]) => ({
      player: participant.player.name,
      aura,
      ...stats,
    }));
  }).sort((a, b) => b.uptimePct - a.uptimePct || b.uptimeSeconds - a.uptimeSeconds);

  const powerRows = encounter.participants.flatMap((participant) => {
    const breakdown = (participant.powerBreakdown ?? {}) as Record<string, {
      amount: number;
      events: number;
      powerType: number;
    }>;
    return Object.entries(breakdown).map(([spell, stats]) => ({
      player: participant.player.name,
      spell,
      ...stats,
    }));
  }).sort((a, b) => b.amount - a.amount);

  const consumableRows = encounter.participants.flatMap((participant) => {
    const breakdown = (participant.consumableBreakdown ?? {}) as Record<string, {
      uptimeSeconds: number;
      uptimePct: number;
      applications: number;
    }>;
    return Object.entries(breakdown).map(([consumable, stats]) => ({
      player: participant.player.name,
      consumable,
      ...stats,
    }));
  }).sort((a, b) => a.player.localeCompare(b.player) || a.consumable.localeCompare(b.consumable));

  const deathRows = encounter.participants.flatMap((participant) => {
    const events = (participant.deathEvents ?? []) as Array<{
      offsetSeconds: number;
      recentDamage: Array<{
        secondsBeforeDeath: number;
        source: string;
        spell: string;
        amount: number;
      }>;
    }>;
    return events.map((event) => ({ player: participant.player.name, ...event }));
  }).sort((a, b) => a.offsetSeconds - b.offsetSeconds);

  const mobMap = new Map<string, {
    totalDamage: number;
    hits: number;
    crits: number;
    byPlayer: Map<string, { damage: number; hits: number; crits: number; playerClass?: string | null }>;
  }>();

  for (const p of encounter.participants) {
    if (!p.targetBreakdown) continue;
    const td = p.targetBreakdown as Record<string, { damage: number; hits: number; crits: number }>;
    for (const [mob, stats] of Object.entries(td)) {
      if (!stats || stats.damage <= 0) continue;
      const entry = mobMap.get(mob) ?? { totalDamage: 0, hits: 0, crits: 0, byPlayer: new Map() };
      entry.totalDamage += stats.damage;
      entry.hits += stats.hits;
      entry.crits += stats.crits;
      const prev = entry.byPlayer.get(p.player.name) ?? {
        damage: 0,
        hits: 0,
        crits: 0,
        playerClass: p.player.class,
      };
      prev.damage += stats.damage;
      prev.hits += stats.hits;
      prev.crits += stats.crits;
      entry.byPlayer.set(p.player.name, prev);
      mobMap.set(mob, entry);
    }
  }

  const mobEntries: MobEntry[] = Array.from(mobMap.entries())
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
    .map(([name, data]) => ({
      name,
      totalDamage: data.totalDamage,
      hits: data.hits,
      crits: data.crits,
      byPlayer: Array.from(data.byPlayer.entries()).map(([pName, pd]) => ({
        name: pName,
        playerClass: pd.playerClass,
        damage: pd.damage,
        hits: pd.hits,
        crits: pd.crits,
      })),
    }));

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-center gap-1 text-sm text-text-dim">
        <Link href="/raids" className="inline-flex min-h-11 items-center hover:text-gold">Raids</Link>
        <span>&gt;</span>
        {raidSessionRoute ? (
          <Link
            href={getRaidSessionPath(encounter.upload.id, raidSessionRoute)}
            className="inline-flex min-h-11 items-center hover:text-gold"
          >
            {formatRaidSessionTitle(raidSessionRoute)}
          </Link>
        ) : (
          <span>Raid</span>
        )}
        <span>&gt;</span>
        <Link href="/bosses" className="inline-flex min-h-11 items-center hover:text-gold">Bosses</Link>
        <span>&gt;</span>
        <Link href={`/bosses/${encounter.boss.slug}`} className="inline-flex min-h-11 items-center hover:text-gold">{encounter.boss.name}</Link>
        <span>&gt;</span>
        <span className="text-text-secondary">Encounter</span>
      </div>

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
            {encounter.upload.guild && <span className="text-xs text-text-dim">- {encounter.upload.guild.name}</span>}
            {encounter.upload.realm?.name && <span className="text-xs text-text-dim">- {encounter.upload.realm.name}</span>}
          </div>
        </div>
        <div className="text-right text-sm text-text-dim">
          <div>{new Date(encounter.startedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-y-2 rounded-sm bg-bg-panel/40 p-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Duration" value={formatDuration(encounter.durationSeconds)} highlight className="col-span-2" />
        <StatCard label="Total Damage" value={formatNumber(encounter.totalDamage)} />
        <StatCard label="Raid DPS" value={totalDps.toLocaleString()} sub="per second" />
        <StatCard label="Effective Healing" value={formatNumber(encounter.totalHealing)} />
        <StatCard label="Effective HPS" value={totalHps.toLocaleString()} sub="per second" />
        <StatCard label="Absorbs" value={formatNumber(encounter.totalAbsorbs)} sub={`${totalAps.toLocaleString()} per second`} />
        <StatCard label="Heal + Absorbs" value={formatNumber(totalHealAndAbsorb)} sub={`${totalHealAndAbsorbPs.toLocaleString()} per second`} className="col-span-2" />
      </div>

      {encounter.milestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest">
            Milestones From This Encounter
          </p>
          {encounter.milestones.map((m) => (
            <div key={m.id} className="milestone-banner flex items-center justify-between text-sm flex-wrap gap-2">
              <span>
                <span className="font-bold text-gold">#{m.rank}</span>
                {" "}all-time{" "}
                <span className="text-text-primary font-semibold">{m.player.name}</span>
                <span className="text-text-secondary"> - {m.metric}</span>
              </span>
              <span className="tabular-nums font-bold text-gold-light">
                {m.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {m.metric}
              </span>
            </div>
          ))}
        </div>
      )}

      {dpsParts.length > 0 && (
        <AccordionSection title="Damage Breakdown" sub="Click a row to expand spell details" count={dpsParts.length} defaultOpen>
          <div className="data-panel">
            <DamageMeter participants={dpsParts} metric="dps" />
          </div>
        </AccordionSection>
      )}

      {healAndAbsorbParts.length > 0 && (
        <AccordionSection
          title="Healing + Absorbs"
          sub={encounter.unattributedAbsorbs > 0
            ? `${formatNumber(encounter.unattributedAbsorbs)} absorbs are included in the total but not yet assigned in player ranks`
            : "Effective healing plus attributed shields"}
          count={healAndAbsorbParts.length}
          defaultOpen={false}
        >
          <div className="data-panel">
            <DamageMeter participants={healAndAbsorbParts} metric="ha" />
          </div>
        </AccordionSection>
      )}

      {healParts.length > 0 && (
        <AccordionSection title="Effective Healing Breakdown" count={healParts.length} defaultOpen={false}>
          <div className="data-panel">
            <DamageMeter participants={healParts} metric="hps" />
          </div>
        </AccordionSection>
      )}

      {absorbParts.length > 0 && (
        <AccordionSection
          title="Absorb Breakdown"
          sub={encounter.unattributedAbsorbs > 0
            ? `${formatNumber(encounter.unattributedAbsorbs)} could not be attributed to one active shield`
            : "Conservatively attributed from active shield auras"}
          count={absorbParts.length}
          defaultOpen={false}
        >
          <div className="data-panel">
            <DamageMeter participants={absorbParts} metric="aps" />
          </div>
        </AccordionSection>
      )}

      {mobEntries.length > 0 && (
        <AccordionSection title="Target Breakdown" sub="Damage dealt to each mob - click a row to see per-player split" count={mobEntries.length} defaultOpen={false}>
          <div className="data-panel">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </AccordionSection>
      )}

      {auraRows.length > 0 && (
        <AccordionSection title="Aura Uptime" sub="Buffs and debuffs observed on raid members" count={auraRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-gold-dim">
            {auraRows.map((row) => (
              <div key={`${row.player}-${row.aura}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] sm:px-4">
                <span className="font-semibold text-text-primary truncate">{row.player}</span>
                <span className="row-start-2 truncate text-text-secondary sm:row-start-auto">{row.aura}</span>
                <span className="col-start-2 row-start-1 tabular-nums text-gold sm:col-start-auto sm:row-start-auto">{row.uptimePct.toFixed(1)}%</span>
                <span className="col-start-2 row-start-2 tabular-nums text-text-dim sm:col-start-auto sm:row-start-auto">{row.applications}x</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {consumableRows.length > 0 && (
        <AccordionSection title="Consumables" sub="Observed flask, elixir, food, and potion auras" count={consumableRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-gold-dim">
            {consumableRows.map((row) => (
              <div key={`${row.player}-${row.consumable}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:px-4">
                <span className="font-semibold text-text-primary truncate">{row.player}</span>
                <span className="row-start-2 truncate text-text-secondary sm:row-start-auto">{row.consumable}</span>
                <span className="col-start-2 row-span-2 row-start-1 self-center tabular-nums text-gold sm:col-start-auto sm:row-span-1 sm:row-start-auto">{row.uptimePct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {powerRows.length > 0 && (
        <AccordionSection title="Power Gains" sub="Resource gains emitted by combat-log energize events" count={powerRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-gold-dim">
            {powerRows.map((row) => (
              <div key={`${row.player}-${row.spell}-${row.powerType}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] sm:px-4">
                <span className="font-semibold text-text-primary truncate">{row.player}</span>
                <span className="row-start-2 truncate text-text-secondary sm:row-start-auto">{row.spell}</span>
                <span className="col-start-2 row-start-1 tabular-nums text-gold sm:col-start-auto sm:row-start-auto">{formatNumber(row.amount)}</span>
                <span className="col-start-2 row-start-2 tabular-nums text-text-dim sm:col-start-auto sm:row-start-auto">{row.events}x</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {deathRows.length > 0 && (
        <AccordionSection title="Death Timeline" count={deathRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-danger/30">
            {deathRows.map((row, index) => (
              <div key={`${row.player}-${row.offsetSeconds}-${index}`} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-danger">{row.player}</span>
                  <span className="tabular-nums text-text-secondary">{formatDuration(row.offsetSeconds)}</span>
                </div>
                {row.recentDamage.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-text-dim">
                    {row.recentDamage.slice(-5).map((damage, damageIndex) => (
                      <div key={`${damage.spell}-${damage.secondsBeforeDeath}-${damageIndex}`} className="flex justify-between gap-3">
                        <span className="truncate">-{damage.secondsBeforeDeath.toFixed(1)}s {damage.source}: {damage.spell}</span>
                        <span className="tabular-nums text-text-secondary">{formatNumber(damage.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      <AccordionSection title="Full Roster" count={encounter.participants.length} defaultOpen={false}>
        <div className="divide-y divide-gold-dim border-y border-gold-dim">
          {encounter.participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover transition-colors gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <PlayerAvatar
                  name={p.player.name}
                  realmName={encounter.upload.realm?.name}
                  characterClass={p.player.class}
                  color={getClassColor(p.player.class ?? p.player.name)}
                  fallbackIconUrl={getClassIconUrl(p.player.class)}
                  size="xs"
                />
                <Link
                  href={`/players/${encodeURIComponent(p.player.name)}`}
                  className="text-sm font-semibold hover:underline text-text-primary"
                >
                  {p.player.name}
                </Link>
                {p.player.class && <span className="text-xs text-text-dim">{p.player.class}</span>}
                {p.spec && <span className="text-xs text-text-secondary">{p.spec}</span>}
                <Badge variant={p.role === "HEALER" ? "holy" : p.role === "TANK" ? "physical" : "gold"}>
                  {p.role}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm tabular-nums text-text-secondary flex-wrap justify-end">
                {p.dps > 0 && <span>{p.dps.toLocaleString(undefined, { maximumFractionDigits: 0 })} dps</span>}
                {p.hps > 100 && <span>{p.hps.toLocaleString(undefined, { maximumFractionDigits: 0 })} hps</span>}
                {p.aps > 0 && <span>{p.aps.toLocaleString(undefined, { maximumFractionDigits: 0 })} aps</span>}
                {p.deaths > 0 && <span className="text-danger">x {p.deaths}</span>}
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>
    </div>
  );
}
