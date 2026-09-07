"use client";

import { useEffect, useRef, useState } from "react";
import { ARMORY_SECTIONS, ARMORY_SECTION_LABELS, ArmorySectionDataSchema, ArmorySpellSchema, armorySectionUrl,
  type ArmorySection, type ArmorySectionData, type ArmorySectionResult, type ArmoryTalent, type ArmorySpell } from "@/lib/armory-profile";
import { cn, formatDateTimeUtc, formatInteger, formatPercent } from "@/lib/utils";

const control = "min-h-11 rounded-sm border border-gold-dim px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
function valueText(value: string): string {
  if (/^\d+$/.test(value)) return formatInteger(Number(value));
  if (/^\d+(?:\.\d+)?%$/.test(value)) return formatPercent(Number(value.slice(0, -1)));
  if (/^\d+\s*\/\s*\d+$/.test(value)) return value.split("/").map(part => formatInteger(Number(part.trim()))).join(" / ");
  if (/^\s*-\s*-\s*$/.test(value)) return "Unavailable";
  return value;
}

function ArmoryRows({ group }: { group: ArmorySectionData["groups"][number] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = group.rows.filter(row => `${row.label} ${row.value} ${row.detail ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const size = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages - 1);
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-semibold text-text-primary">{group.title}</h3>
      {group.rows.length > size && <span className="text-sm text-text-dim">{formatInteger(filtered.length)} entries</span>}
    </div>
    {group.rows.length > size && <label className="block text-sm text-text-secondary">Search {group.title.toLowerCase()}
      <input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} className={`${control} mt-1 w-full bg-bg-deep`} type="search" />
    </label>}
    {filtered.length ? <dl className="divide-y divide-gold-dim">
      {filtered.slice(currentPage * size, (currentPage + 1) * size).map((row, index) => <div key={`${row.label}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
        <dt className="min-w-0 break-words text-text-secondary">{row.url ? <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-gold hover:text-gold-light">{row.label} ↗</a> : row.label}</dt>
        <dd className="break-words text-right tabular-nums text-text-primary">{valueText(row.value)}</dd>
        {row.detail && <dd className="w-full text-text-dim">{valueText(row.detail)}</dd>}
      </div>)}
    </dl> : <p className="py-3 text-sm text-text-dim">{query ? "No matching entries." : "None listed by Warmane."}</p>}
    {pages > 1 && <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
      <button className={control} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{formatInteger(currentPage + 1)} / {formatInteger(pages)}</span>
      <button className={control} disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
    </div>}
  </div>;
}

function TalentBuilds({ data, endpoint }: { data: ArmorySectionData; endpoint: string }) {
  const [selectedSpec, setSelectedSpec] = useState(0);
  const [mobileTree, setMobileTree] = useState(0);
  const [selected, setSelected] = useState<{ node: ArmoryTalent; tree: string } | null>(null);
  const [details, setDetails] = useState<{ id: number; spell: ArmorySpell | null } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const spec = data.specs[selectedSpec] ?? data.specs[0];
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 15_000);
    fetch(`${endpoint}&section=talents&spell=${selected.node.spellId}`, { signal: controller.signal })
      .then(response => response.json()).then(result => {
        const parsed = ArmorySpellSchema.safeParse(result.spell);
        if (active) setDetails({ id: selected.node.spellId, spell: parsed.success ? parsed.data : null });
      }).catch(() => { if (active) setDetails({ id: selected.node.spellId, spell: null }); }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [selected, endpoint]);
  if (!spec) return <p className="text-sm text-text-secondary">No talent builds are listed by Warmane.</p>;
  const detail = selected && details?.id === selected.node.spellId ? details : null;
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Talent build">
      {data.specs.map((build, index) => <button key={build.index} type="button" aria-pressed={selectedSpec === index}
        onClick={() => { setSelectedSpec(index); setMobileTree(0); setSelected(null); }}
        className={cn(control, selectedSpec === index && "border-gold bg-bg-hover text-gold")}>
        Build {build.index + 1} · {build.name} <span className="ml-2 tabular-nums">{build.trees.map(tree => tree.points).join(" / ")}</span>
      </button>)}
    </div>
    <p className="text-sm text-text-secondary">Select a talent for its rank and spell description. Darkened talents have no points allocated. Build order follows Warmane; it does not identify the active build.</p>
    <div className="flex flex-wrap gap-2 lg:hidden" role="group" aria-label="Talent tree">
      {spec.trees.map((tree, index) => <button key={tree.name} className={cn(control, mobileTree === index && "border-gold text-gold")} aria-pressed={mobileTree === index}
        onClick={() => { setMobileTree(index); setSelected(null); }}>{tree.name} · {tree.points}</button>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      {spec.trees.map((tree, index) => <div key={tree.name} className={cn("rounded-sm border border-gold-dim bg-bg-deep p-4", mobileTree !== index && "hidden lg:block")}>
        <div className="mb-4 flex items-baseline justify-between"><h3 className="font-semibold text-text-primary">{tree.name}</h3><span className="text-sm tabular-nums text-gold">{tree.points} points</span></div>
        <div className="mx-auto grid max-w-80 grid-cols-4 gap-2" style={{ gridTemplateRows: "repeat(11, 52px)" }}>
          {tree.nodes.map(node => <button key={`${node.row}-${node.column}`} type="button"
            aria-label={`${tree.name}, row ${node.row + 1}, column ${node.column + 1}: ${node.rank} of ${node.maxRank} points, spell ${node.spellId}`}
            aria-pressed={selected?.node.spellId === node.spellId}
            onClick={() => { setSelected({ node, tree: tree.name }); requestAnimationFrame(() => detailRef.current?.focus()); }}
            className={cn("relative mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-sm border bg-bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              node.rank ? "border-gold" : "border-gold-dim", selected?.node.spellId === node.spellId && "ring-2 ring-gold")}
            style={{ gridRow: node.row + 1, gridColumn: node.column + 1 }}>
            {/* Remote images stay on the existing allowlisted Warmane CDN. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {node.iconUrl && <img src={node.iconUrl} alt="" width={40} height={40} loading="lazy" className={cn("rounded-sm", !node.rank && "opacity-40 grayscale")} />}
            <span className={cn("absolute -bottom-1 right-0 rounded-sm bg-bg-deep px-1 text-xs font-semibold tabular-nums", node.rank ? "text-gold" : "text-text-secondary")}>{node.rank}/{node.maxRank}</span>
          </button>)}
        </div>
      </div>)}
    </div>
    <div ref={detailRef} tabIndex={-1} className="rounded-sm border border-gold-dim bg-bg-panel p-4 focus:outline-2 focus:outline-gold" aria-live="polite">
      {selected ? <>
        <h3 className="font-semibold text-text-primary">{detail?.spell?.name ?? `Spell ${selected.node.spellId}`} <span className="font-normal text-gold">· {selected.node.rank}/{selected.node.maxRank} points</span></h3>
        <p className="mt-1 text-sm text-text-secondary">{selected.tree} · Row {selected.node.row + 1}{selected.node.rank === 0 && " · Unallocated; description shows the first rank"}</p>
        <p className="mt-3 text-sm text-text-secondary">{detail ? detail.spell?.description ?? "Spell details are unavailable. The talent position and points above come from Warmane." : "Loading spell description…"}</p>
        <a href={`https://wotlk.cavernoftime.com/spell=${encodeURIComponent(String(selected.node.spellId))}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-gold">Spell reference: Cavern of Time ↗</a>
      </> : <p className="text-sm text-text-secondary">Select a talent above to inspect it.</p>}
    </div>
    <div className="grid gap-5 sm:grid-cols-2">{(["Major", "Minor"] as const).map(kind => <div key={kind}>
      <h3 className="mb-2 font-semibold text-text-primary">{kind} glyphs</h3>
      <ul className="divide-y divide-gold-dim">{spec.glyphs.filter(glyph => glyph.kind === kind).map(glyph => <li key={glyph.spellId}>
        <a href={`https://wotlk.cavernoftime.com/spell=${encodeURIComponent(String(glyph.spellId))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">{glyph.name} ↗</a>
      </li>)}</ul>
      {!spec.glyphs.some(glyph => glyph.kind === kind) && <p className="text-sm text-text-dim">None listed.</p>}
    </div>)}</div>
  </div>;
}

export function PlayerArmoryProfile({ name, realm, initial }: { name: string; realm: string; initial: ArmorySectionResult }) {
  const [section, setSection] = useState<ArmorySection>("summary");
  const [category, setCategory] = useState("summary");
  const [snapshots, setSnapshots] = useState<Record<string, ArmorySectionResult>>({ "summary:summary": initial });
  const [retry, setRetry] = useState(0);
  const key = `${section}:${category}`;
  const result = snapshots[key];
  const endpoint = `/api/players/${encodeURIComponent(name)}/armory?realm=${encodeURIComponent(realm)}`;
  useEffect(() => {
    if (result && retry === 0) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 16_000);
    fetch(`${endpoint}&section=${section}&category=${category}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Armory unavailable");
      const value = await response.json() as ArmorySectionResult;
      if (value.data && !ArmorySectionDataSchema.safeParse(value.data).success) throw new Error("Invalid response");
      if (active) setSnapshots(previous => ({ ...previous, [key]: value }));
    }).catch(() => {
      if (active) setSnapshots(previous => ({ ...previous, [key]: { data: null, fetchedAt: null, sourceUrl: initial.sourceUrl, stale: false, message: "This section could not be loaded. Try again shortly." } }));
    }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
    // Snapshots are reused for the lifetime of this profile; retries are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, category, endpoint, retry]);
  const data = result?.data;
  const categories = data?.categories ?? snapshots[`${section}:summary`]?.data?.categories ?? [];
  return <section id="armory" aria-labelledby="armory-heading" className="scroll-mt-36 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-gold-dim pt-6">
      <div><p className="text-xs font-bold uppercase tracking-widest text-gold">Character sheet</p>
        <h2 id="armory-heading" className="mt-1 text-xl font-semibold text-text-primary">Warmane Armory</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">Current character snapshots, separate from the gear and talents used in recorded raids.</p>
      </div>
      <a href={armorySectionUrl(name, realm, section)} target="_blank" rel="noreferrer" className={`${control} inline-flex items-center text-gold`}>View on Warmane ↗</a>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Armory sections">
      {ARMORY_SECTIONS.map(value => <button key={value} type="button" aria-pressed={section === value}
        onClick={() => { setSection(value); setCategory("summary"); setRetry(0); }}
        className={cn(control, section === value && "border-gold bg-bg-hover text-gold")}>{ARMORY_SECTION_LABELS[value]}</button>)}
    </div>
    {categories.length > 1 && <div className="max-w-md text-sm text-text-secondary"><label htmlFor="armory-category">Category</label>
      <select id="armory-category" value={category} onChange={event => { setCategory(event.target.value); setRetry(0); }} className={`${control} mt-1 w-full bg-bg-panel`}>
        {categories.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
      </select>
    </div>}
    <div className="rounded-sm border border-gold-dim bg-bg-panel p-4 sm:p-6" aria-busy={!result}>
      {!result ? <p className="py-8 text-sm text-text-secondary" role="status">Loading {ARMORY_SECTION_LABELS[section].toLowerCase()}…</p> : <>
        {result.message && <p className="mb-4 text-sm text-text-secondary" role="status">{result.message}</p>}
        {!data ? <button className={control} onClick={() => setRetry(value => value + 1)}>Try again</button>
          : section === "talents" ? <TalentBuilds key={key} data={data} endpoint={endpoint} />
          : section === "summary" ? <SummaryGroups data={data} />
          : <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
            {data.groups.map((group, index) => <ArmoryRows key={`${key}-${index}`} group={group} />)}
          </div>}
      </>}
    </div>
    {result?.fetchedAt && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-dim">{result.stale ? "Cached fallback" : "Snapshot"} · {formatDateTimeUtc(result.fetchedAt)} · Each section refreshes independently. Values are reported by Warmane.</p>
      {result.stale && <button className={control} onClick={() => setRetry(value => value + 1)}>Retry refresh</button>}
    </div>}
  </section>;
}

function SummaryGroups({ data }: { data: ArmorySectionData }) {
  const overview = new Set(["Character", "Specializations", "Professions", "Secondary skills", "Player vs player"]);
  const stats = data.groups.filter(group => !overview.has(group.title) && group.title !== "Recent activity");
  const activity = data.groups.find(group => group.title === "Recent activity");
  return <div className="space-y-5">
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">{data.groups.filter(group => overview.has(group.title) && group.rows.length > 0).map(group => <ArmoryRows key={group.title} group={group} />)}</div>
    <details className="border-t border-gold-dim pt-2" open>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-gold">Character stats <span className="mt-1 block text-sm font-normal text-text-dim sm:ml-2 sm:mt-0 sm:inline">Attributes, melee, ranged, spell, defense and resistances</span></summary>
      <div className="mt-3 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">{stats.map(group => <ArmoryRows key={group.title} group={group} />)}</div>
    </details>
    {activity && activity.rows.length > 0 && <details className="border-t border-gold-dim pt-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gold">Recent Armory activity</summary>
      <p className="my-2 text-xs text-text-dim">Relative times are as reported when this snapshot was fetched.</p>
      <ArmoryRows group={activity} />
    </details>}
  </div>;
}
