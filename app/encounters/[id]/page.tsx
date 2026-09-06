import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DamageMeter } from "@/components/meter/DamageMeter";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { SectionNav } from "@/components/ui/SectionNav";
import { Badge } from "@/components/ui/Badge";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { FilteredAnalyticsBreakdown } from "@/components/analytics/FilteredAnalyticsBreakdown";
import { getClassIconUrl } from "@/lib/class-icons";
import { getClassColor } from "@/lib/constants/classes";
import { getRaidSessionRouteByIndex } from "@/lib/raid-session-routing.server";
import { formatRaidSessionTitle, getRaidSessionPath } from "@/lib/raid-session-slug";
import { formatCountLabel, formatDateTimeUtc, formatDuration, formatInteger, formatNumber, formatPercent, formatRate, formatSeconds, getRecordedDurationSeconds } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { buildPageMetadata } from "@/lib/page-metadata";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { parseDifficultyFilter, reportQueryString } from "@/lib/difficulty-filter";
import { buildRaidSummaryQuery, parseRaidSummaryScope } from "@/lib/raid-summary-scope";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ includeShortPulls?: string | string[]; difficulty?: string | string[]; scope?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const enc = await db.encounter.findUnique({
    where: { id },
    select: { outcome: true, difficulty: true, boss: { select: { name: true } } },
  });
  const title = enc ? `${enc.boss.name} — ${enc.outcome}` : "Encounter";
  return buildPageMetadata({
    title,
    description: enc
      ? `${enc.difficulty} ${enc.boss.name} ${enc.outcome.toLowerCase()} with damage, healing, absorbs, and player breakdowns.`
      : "WotLK raid encounter analytics.",
    path: `/encounters/${encodeURIComponent(id)}`,
    type: "article",
  });
}

export default async function EncounterPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  const scope = parseRaidSummaryScope(query.scope);
  const raidQuerySuffix = buildRaidSummaryQuery(scope, includeShortPulls);
  const difficulty = parseDifficultyFilter(query.difficulty);
  const comparisonQuerySuffix = reportQueryString({
    scope: scope === "kills" ? "kills" : undefined,
    includeShortPulls: includeShortPulls ? "1" : undefined,
    difficulty: difficulty === "all" ? undefined : difficulty,
  });

  const encounter = await db.encounter.findUnique({
    where: { id },
    include: {
      boss: true,
      upload: {
        select: {
          id: true,
          publicSlug: true,
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
  const durationSec = getRecordedDurationSeconds(encounter);
  const totalDps = durationSec === null ? null : encounter.totalDamage / durationSec;
  const totalHps = durationSec === null ? null : encounter.totalHealing / durationSec;
  const totalAps = durationSec === null ? null : encounter.totalAbsorbs / durationSec;
  const totalHealAndAbsorb = encounter.totalHealing + encounter.totalAbsorbs;
  const totalHealAndAbsorbPs = durationSec === null ? null : totalHealAndAbsorb / durationSec;

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
        <Link href={`/raids${querySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">Raids</Link>
        <span>&gt;</span>
        {raidSessionRoute ? (
          <Link
            href={`${getRaidSessionPath(encounter.upload.publicSlug, raidSessionRoute)}${raidQuerySuffix}`}
            className="inline-flex min-h-11 items-center hover:text-gold"
          >
            {formatRaidSessionTitle(raidSessionRoute)}
          </Link>
        ) : (
          <span>Raid</span>
        )}
        <span>&gt;</span>
        <Link href={`/bosses${comparisonQuerySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">Bosses</Link>
        <span>&gt;</span>
        <Link href={`/bosses/${encounter.boss.slug}${comparisonQuerySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">{encounter.boss.name}</Link>
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
        <div className="space-y-1 text-sm text-text-secondary sm:text-right">
          <div>Duration <span className="ml-1 font-semibold tabular-nums text-text-primary">{durationSec === null ? <NumericValue value={null} /> : formatDuration(durationSec)}</span></div>
          <div>{formatDateTimeUtc(encounter.startedAt)}</div>
        </div>
      </div>

      <SectionNav items={[
        ...(dpsParts.length > 0 ? [{ id: "damage", label: "Damage" }] : []),
        ...(healAndAbsorbParts.length > 0 ? [{ id: "healing", label: "Healing" }] : []),
        ...(mobEntries.length > 0 ? [{ id: "targets", label: "Targets" }] : []),
        ...(deathRows.length > 0 ? [{ id: "deaths", label: "Deaths" }] : []),
        { id: "roster", label: "Roster" },
      ]} />

      <ShortPullNotice shortPulls={isShortPull(encounter) ? 1 : 0} includeShortPulls={includeShortPulls} basePath={`/encounters/${id}${comparisonQuerySuffix}`} />

      <StatGroup columns={4}>
        <StatCard label="Damage" value={formatNumber(encounter.totalDamage)} sub={<><NumericValue value={totalDps} kind="rate" /> raid DPS</>} />
        <StatCard label="Effective healing" value={formatNumber(encounter.totalHealing)} sub={<><NumericValue value={totalHps} kind="rate" /> effective HPS</>} />
        <StatCard label="Absorbs" value={formatNumber(encounter.totalAbsorbs)} sub={totalAps === null ? "Absorb rate unavailable" : `${formatRate(totalAps)} APS`} />
        <StatCard label="Healing + absorbs" value={formatNumber(totalHealAndAbsorb)} sub={totalHealAndAbsorbPs === null ? "Combined rate unavailable" : `${formatRate(totalHealAndAbsorbPs)} healing + absorbs /s`} />
      </StatGroup>
      {durationSec === null && <p className="text-sm text-text-secondary">Raid rates are unavailable because the recorded fight duration is missing or invalid. Totals and recorded player rates remain available.</p>}

      {encounter.milestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest">
            Awards recorded for this encounter
          </p>
          <p className="text-sm text-text-secondary">Historical rank when achieved, for this boss and difficulty. Current standings may differ.</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {encounter.milestones.map((m) => (
              <div key={m.id} className="milestone-banner flex items-center justify-between text-sm flex-wrap gap-2">
                <span>
                  <span className="font-bold text-gold">#{formatInteger(m.rank)}</span>
                  {" "}{m.type === "WEEKLY_BEST" ? "weekly best" : "all-time"}{" "}
                  <span className="text-text-primary font-semibold">{m.player.name}</span>
                  <span className="text-text-secondary"> - {m.metric}</span>
                </span>
                <span className="tabular-nums font-bold text-gold-light">
                  <NumericValue value={m.value} kind="rate" /> {m.metric}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dpsParts.length > 0 && (
        <AccordionSection id="damage" title="Damage Breakdown" sub="Select a player to view spells" count={dpsParts.length} defaultOpen>
          <div className="data-panel">
            <DamageMeter participants={dpsParts} metric="dps" />
          </div>
        </AccordionSection>
      )}

      {healAndAbsorbParts.length > 0 && (
        <AccordionSection
          id="healing"
          title="Healing + absorbs"
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
        <AccordionSection id="targets" title="Target Breakdown" sub="Select a target to see damage by player" count={mobEntries.length} defaultOpen={false}>
          <div className="data-panel">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </AccordionSection>
      )}

      {auraRows.length > 0 && (
        <AccordionSection title="Aura Uptime" sub="Buffs and debuffs observed on raid members · Highest uptime first" count={auraRows.length} defaultOpen={false}>
          <FilteredAnalyticsBreakdown
            rows={auraRows.map(row => ({
              id: `${row.player}-${row.aura}`,
              player: row.player,
              ability: row.aura,
              value: formatPercent(row.uptimePct),
              occurrences: formatCountLabel(row.applications, "application"),
            }))}
            abilityLabel="Aura"
            abilityPlaceholder="Sacred Shield or Slice and Dice"
            valueLabel="Uptime"
            occurrencesLabel="Applications"
            entryLabel="aura entries"
            singularEntryLabel="aura entry"
            playerHelp="Player means the raid member the aura was observed on."
          />
        </AccordionSection>
      )}

      {consumableRows.length > 0 && (
        <AccordionSection title="Consumables" sub="Observed flask, elixir, food, and potion auras · Player and aura names A–Z" count={consumableRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-gold-dim">
            {consumableRows.map((row) => (
              <div key={`${row.player}-${row.consumable}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:px-4">
                <span className="font-semibold text-text-primary truncate">{row.player}</span>
                <span className="row-start-2 truncate text-text-secondary sm:row-start-auto">{row.consumable}</span>
                <span className="col-start-2 row-span-2 row-start-1 self-center tabular-nums text-gold sm:col-start-auto sm:row-span-1 sm:row-start-auto"><NumericValue value={row.uptimePct} kind="percent" /> uptime</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {powerRows.length > 0 && (
        <AccordionSection title="Power Gains" sub="Recorded resource gains · Highest amount first" count={powerRows.length} defaultOpen={false}>
          <FilteredAnalyticsBreakdown
            rows={powerRows.map(row => ({
              id: `${row.player}-${row.spell}-${row.powerType}`,
              player: row.player,
              ability: row.spell,
              value: formatNumber(row.amount),
              occurrences: formatCountLabel(row.events, "event"),
            }))}
            abilityLabel="Power source"
            abilityPlaceholder="Spiritual Attunement or Rapture"
            valueLabel="Power gained"
            occurrencesLabel="Events"
            entryLabel="power entries"
            singularEntryLabel="power entry"
            playerHelp="Player means the raid member who received the resource."
          />
        </AccordionSection>
      )}

      {deathRows.length > 0 && (
        <AccordionSection id="deaths" title="Death Timeline" sub="Earliest death first · Elapsed time from fight start; up to five latest damage events before each death" count={deathRows.length} defaultOpen={false}>
          <div className="divide-y divide-gold-dim border-y border-danger/30">
            {deathRows.map((row, index) => (
              <div key={`${row.player}-${row.offsetSeconds}-${index}`} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-danger">{row.player}</span>
                  <span className="tabular-nums text-text-secondary">{formatDuration(row.offsetSeconds)} into fight</span>
                </div>
                {row.recentDamage.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-text-dim">
                    {row.recentDamage.slice(-5).map((damage, damageIndex) => (
                      <div key={`${damage.spell}-${damage.secondsBeforeDeath}-${damageIndex}`} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">{formatSeconds(damage.secondsBeforeDeath)} before death · {damage.source}: {damage.spell}</span>
                        <span className="shrink-0 tabular-nums text-text-secondary">{formatNumber(damage.amount)} damage</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      <AccordionSection id="roster" title="Full Roster" sub="Highest recorded DPS first" count={encounter.participants.length} defaultOpen={false}>
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
                  href={`/players/${encodeURIComponent(p.player.name)}${querySuffix}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold hover:underline text-text-primary"
                >
                  {p.player.name}
                </Link>
                {p.player.class && <span className="text-xs text-text-dim">{p.player.class}</span>}
                {p.spec && <span className="text-xs text-text-secondary">{p.spec}</span>}
                <Badge variant={p.role === "HEALER" ? "holy" : p.role === "TANK" ? "physical" : "gold"}>
                  {p.role}
                </Badge>
              </div>
              <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-text-secondary sm:w-auto sm:justify-end">
                <span><NumericValue value={p.dps} kind="rate" /> DPS</span>
                <span><NumericValue value={p.hps} kind="rate" /> HPS</span>
                <span><NumericValue value={p.aps} kind="rate" /> APS</span>
                {p.deaths > 0 && <span className="text-danger">{formatCountLabel(p.deaths, "death")}</span>}
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>
    </div>
  );
}
