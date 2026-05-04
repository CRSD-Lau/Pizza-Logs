import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { StatCard } from "@/components/ui/StatCard";
import { getClassColor } from "@/lib/constants/classes";
import { sortByICCOrder } from "@/lib/constants/bosses";
import { getClassIconUrl } from "@/lib/warmane-portrait";
import { cn, formatDuration, formatNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string; sessionIdx: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionIdx } = await params;
  return { title: `Session ${Number(sessionIdx) + 1}` };
}

export default async function SessionDetailPage({ params }: Props) {
  const { id, sessionIdx } = await params;
  const sessionIndex = parseInt(sessionIdx, 10);
  if (isNaN(sessionIndex)) notFound();

  const upload = await db.upload.findUnique({
    where: { id },
    select: {
      id: true,
      sessionDamage: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
    },
  });
  if (!upload) notFound();

  const encounters = await db.encounter.findMany({
    where: { uploadId: id, sessionIndex },
    orderBy: { startedAt: "asc" },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: {
        include: { player: { select: { name: true, class: true } } },
      },
    },
  });

  if (encounters.length === 0) notFound();

  const orderedEncounters = sortByICCOrder(encounters, enc => enc.boss.name);

  const kills = orderedEncounters.filter(e => e.outcome === "KILL").length;
  const wipes = orderedEncounters.filter(e => e.outcome === "WIPE").length;
  const totalHeal = orderedEncounters.reduce((sum, e) => sum + e.totalHealing, 0);
  const totalSecs = orderedEncounters.reduce((sum, e) => sum + e.durationSeconds, 0);

  const sessionDmgMap = (upload.sessionDamage ?? {}) as Record<string, number>;
  const fullSessionDmg = sessionDmgMap[String(sessionIndex)];
  const totalDmg = fullSessionDmg ?? orderedEncounters.reduce((sum, e) => sum + e.totalDamage, 0);
  const startedAt = encounters[0].startedAt;
  const endedAt = encounters[encounters.length - 1].endedAt;

  const sessionCount = await db.encounter.groupBy({
    by: ["sessionIndex"],
    where: { uploadId: id },
  }).then(r => r.length);

  const playerSet = new Map<string, string | null>();
  for (const enc of orderedEncounters) {
    for (const p of enc.participants) {
      if (!playerSet.has(p.player.name)) playerSet.set(p.player.name, p.player.class ?? null);
    }
  }
  const realmName = upload.realm?.name ?? "Lordaeron";
  const guildName = upload.guild?.name ?? null;
  const rosterMembers = playerSet.size > 0
    ? await db.guildRosterMember.findMany({
      where: {
        normalizedCharacterName: { in: Array.from(playerSet.keys()).map(playerName => playerName.toLowerCase()) },
        realm: realmName,
      },
      select: {
        normalizedCharacterName: true,
        guildName: true,
        className: true,
        raceName: true,
      },
    })
    : [];
  const rosterMemberMap = new Map(rosterMembers.map(member => [member.normalizedCharacterName, member]));

  const mobMap = new Map<string, {
    totalDamage: number;
    hits: number;
    crits: number;
    byPlayer: Map<string, { damage: number; hits: number; crits: number; playerClass: string | null }>;
  }>();

  for (const enc of orderedEncounters) {
    for (const p of enc.participants) {
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
          playerClass: p.player.class ?? null,
        };
        prev.damage += stats.damage;
        prev.hits += stats.hits;
        prev.crits += stats.crits;
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

  const raidGroups = new Map<string, typeof encounters>();
  for (const enc of orderedEncounters) {
    const arr = raidGroups.get(enc.boss.raid) ?? [];
    arr.push(enc);
    raidGroups.set(enc.boss.raid, arr);
  }

  return (
    <div className="pt-10 space-y-8">
      <div className="text-xs text-text-dim flex items-center gap-1 flex-wrap">
        <Link href="/raids" className="hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <span className="text-text-secondary">
          {sessionCount === 1 ? "Raid Session" : `Session ${sessionIndex + 1} of ${sessionCount}`}
        </span>
      </div>

      {sessionCount > 1 && (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {sessionIndex > 0 && (
            <Link href={`/raids/${id}/sessions/${sessionIndex - 1}`} className="text-gold hover:text-gold-light">
              Previous session
            </Link>
          )}
          {sessionIndex < sessionCount - 1 && (
            <Link href={`/raids/${id}/sessions/${sessionIndex + 1}`} className="text-gold hover:text-gold-light sm:ml-auto">
              Next session
            </Link>
          )}
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            {sessionCount === 1 ? "Raid Session" : `Session ${sessionIndex + 1}`}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-dim">
            <span>{[...raidGroups.keys()].join(" - ")}</span>
            {upload.guild?.name && <span>- {upload.guild.name}</span>}
            {upload.realm?.name && <span>- {upload.realm.name}</span>}
            {upload.realm?.host && <span>- {upload.realm.host}</span>}
            <span>-</span>
            <span>
              {new Date(startedAt).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
              {" -> "}
              {new Date(endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Kills / Wipes" value={`${kills}K / ${wipes}W`} highlight />
        <StatCard label="Total Damage" value={formatNumber(totalDmg)} />
        <StatCard label="Total Healing" value={formatNumber(totalHeal)} />
        <StatCard label="Active Time" value={formatDuration(totalSecs)} sub="sum of all pulls" />
      </div>

      <AccordionSection title="Encounters" count={encounters.length} defaultOpen>
        <div className="space-y-4">
          {Array.from(raidGroups.entries()).map(([raidName, encs]) => (
            <div key={raidName} className="space-y-1">
              <p className="text-xs font-semibold text-text-dim uppercase tracking-widest px-1">{raidName}</p>
              <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim overflow-hidden">
                {encs.map((enc) => {
                  const durationSec = (enc.durationMs ?? 0) > 0
                    ? enc.durationMs / 1000
                    : Math.max(1, enc.durationSeconds);
                  const rdps = enc.durationSeconds > 0
                    ? Math.round(enc.totalDamage / durationSec)
                    : 0;

                  return (
                    <Link
                      key={enc.id}
                      href={`/encounters/${enc.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-bg-hover transition-colors group flex-wrap"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={cn(
                            "text-[11px] font-bold px-1.5 py-0.5 rounded",
                            enc.outcome === "KILL" ? "text-success bg-success/10"
                              : enc.outcome === "WIPE" ? "text-danger bg-danger/10"
                                : "text-text-dim bg-bg-hover"
                          )}
                        >
                          {enc.outcome}
                        </span>
                        <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors">
                          {enc.boss.name}
                        </span>
                        <span className={`diff-badge ${enc.difficulty.endsWith("H") ? "heroic" : "normal"}`}>
                          {enc.difficulty}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary flex-wrap justify-end">
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
        </div>
      </AccordionSection>

      {mobEntries.length > 0 && (
        <AccordionSection
          title="Mob Damage - Full Session"
          sub="Aggregate damage to every target across all pulls - click to drill down by player"
          count={mobEntries.length}
          defaultOpen={false}
        >
          <div className="bg-bg-panel border border-gold-dim rounded overflow-hidden">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </AccordionSection>
      )}

      {playerSet.size > 0 && (
        <AccordionSection title="Raid Roster" count={playerSet.size} defaultOpen>
          <div className="bg-bg-panel border border-gold-dim rounded p-4 flex flex-wrap gap-2">
            {Array.from(playerSet.entries()).map(([name, cls]) => {
              const rosterMember = rosterMemberMap.get(name.toLowerCase());
              const characterClass = cls ?? rosterMember?.className ?? null;
              const classColor = getClassColor(characterClass ?? name);

              return (
                <Link
                  key={name}
                  href={`/raids/${id}/sessions/${sessionIndex}/players/${encodeURIComponent(name)}`}
                  className="inline-flex items-center gap-2 rounded border border-gold-dim bg-bg-card px-2 py-1 text-xs hover:border-gold transition-colors"
                >
                  <PlayerAvatar
                    name={name}
                    realmName={realmName}
                    characterClass={characterClass}
                    raceName={rosterMember?.raceName}
                    guildName={rosterMember?.guildName ?? guildName}
                    color={classColor}
                    portraitUrl={null}
                    fallbackIconUrl={getClassIconUrl(characterClass)}
                    size="xs"
                  />
                  <span className="text-text-primary font-medium">{name}</span>
                  {characterClass && <span className="text-text-dim">{characterClass}</span>}
                </Link>
              );
            })}
          </div>
        </AccordionSection>
      )}
    </div>
  );
}
