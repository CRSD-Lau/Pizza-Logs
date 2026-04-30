import Link from "next/link";
import type { ArmoryCharacterGear, ArmoryGearItem, ArmoryGearResult } from "@/lib/warmane-armory";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const QUALITY_COLORS: Record<string, string> = {
  poor: "#9d9d9d",
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#0070dd",
  epic: "#a335ee",
  legendary: "#ff8000",
  artifact: "#e6cc80",
  heirloom: "#e6cc80",
};

function getQualityColor(quality?: string): string | undefined {
  if (!quality) return undefined;
  return QUALITY_COLORS[quality.toLowerCase()];
}

function GearItemTooltip({ item, qualityColor }: { item: ArmoryGearItem; qualityColor?: string }) {
  const detailLines = [
    ...(item.details ?? []),
    item.enchant ? `Enchant: ${item.enchant}` : null,
    item.gems?.length ? `Gems: ${item.gems.join(", ")}` : null,
  ].filter((line): line is string => Boolean(line) && line !== item.name);

  return (
    <div className="pointer-events-none absolute left-3 top-[calc(100%-6px)] z-30 w-[min(28rem,calc(100vw-3rem))] rounded border border-gold bg-bg-deep p-3 text-xs text-text-secondary opacity-0 shadow-2xl shadow-black/50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:left-14 sm:top-12">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-gold bg-bg-panel">
          {item.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.iconUrl} alt="" className="h-10 w-10 rounded-sm object-cover" />
          ) : (
            <span className="text-xs font-bold text-text-dim">{item.slot.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary" style={qualityColor ? { color: qualityColor } : undefined}>
            {item.name}
          </p>
          <p className="mt-0.5 uppercase tracking-widest text-text-dim">{item.slot}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 border-t border-gold-dim pt-3">
        {detailLines.length > 0 ? (
          detailLines.map((line, index) => (
            <p key={`${item.slot}-detail-${index}`} className="leading-relaxed">
              {line}
            </p>
          ))
        ) : (
          <p>No additional Wowhead details available.</p>
        )}
        {item.itemId && <p className="pt-1 text-text-dim">Wowhead item #{item.itemId}</p>}
      </div>
    </div>
  );
}

function GearItemCard({ item }: { item: ArmoryGearItem }) {
  const qualityColor = getQualityColor(item.quality);

  return (
    <article
      tabIndex={0}
      className="group relative flex min-h-[76px] cursor-default items-start gap-3 rounded border border-gold-dim bg-bg-card px-3 py-3 transition-colors hover:border-gold/50 hover:bg-bg-hover focus-visible:border-gold focus-visible:outline-none"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-gold-dim bg-bg-deep">
        {item.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.iconUrl} alt="" className="h-9 w-9 rounded-sm object-cover" />
        ) : (
          <span className="text-xs font-bold text-text-dim">{item.slot.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">{item.slot}</p>
            <p
              className="truncate text-sm font-semibold text-text-primary group-hover:text-gold-light"
              style={qualityColor ? { color: qualityColor } : undefined}
            >
              {item.name}
            </p>
          </div>
          {item.itemLevel && (
            <span className="shrink-0 text-xs tabular-nums text-text-secondary">ilvl {item.itemLevel}</span>
          )}
        </div>

        {(item.enchant || item.gems?.length) && (
          <div className="mt-1 space-y-0.5 text-xs text-text-secondary">
            {item.enchant && <p className="truncate">Enchant: {item.enchant}</p>}
            {item.gems?.length ? <p className="truncate">Gems: {item.gems.join(", ")}</p> : null}
          </div>
        )}
      </div>
      <GearItemTooltip item={item} qualityColor={qualityColor} />
    </article>
  );
}

function GearGrid({ gear, stale = false }: { gear: ArmoryCharacterGear; stale?: boolean }) {
  const leftSlots = gear.items.slice(0, 8);
  const rightSlots = gear.items.slice(8, 16);
  const weaponSlots = gear.items.slice(16);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-2">
          {leftSlots.map(item => <GearItemCard key={`${item.slot}-${item.name}`} item={item} />)}
        </div>
        <div className="grid gap-2">
          {rightSlots.map(item => <GearItemCard key={`${item.slot}-${item.name}`} item={item} />)}
        </div>
      </div>

      {weaponSlots.length > 0 && (
        <div className={cn("grid gap-2", weaponSlots.length > 1 && "sm:grid-cols-2 lg:grid-cols-3")}>
          {weaponSlots.map(item => <GearItemCard key={`${item.slot}-${item.name}`} item={item} />)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-dim">
        <span>
          {stale ? "Cached copy from " : "Fetched "}
          {new Date(gear.fetchedAt).toLocaleString()}
        </span>
        <Link href={gear.sourceUrl} target="_blank" className="text-gold hover:text-gold-light">
          Source: Warmane Armory
        </Link>
      </div>
    </div>
  );
}

export function PlayerGearSectionSkeleton() {
  return (
    <AccordionSection title="Gear" sub="Current Warmane Armory equipment" defaultOpen>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[76px] animate-pulse rounded border border-gold-dim bg-bg-card" />
        ))}
      </div>
    </AccordionSection>
  );
}

export function PlayerGearSection({ result }: { result: ArmoryGearResult }) {
  if (!result.ok) {
    return (
      <AccordionSection title="Gear" sub="Current Warmane Armory equipment" defaultOpen>
        <div className="rounded border border-gold-dim bg-bg-panel p-4">
          <p className="text-sm text-text-secondary">{result.message}</p>
          <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold hover:text-gold-light">
            Source: Warmane Armory
          </a>
        </div>
      </AccordionSection>
    );
  }

  return (
    <AccordionSection
      title="Gear"
      sub={`${result.gear.realm} Armory equipment`}
      count={result.gear.items.length}
      defaultOpen
    >
      {result.gear.items.length > 0 ? (
        <GearGrid gear={result.gear} stale={result.stale} />
      ) : (
        <EmptyState title="No gear data available from Warmane Armory." />
      )}
    </AccordionSection>
  );
}
