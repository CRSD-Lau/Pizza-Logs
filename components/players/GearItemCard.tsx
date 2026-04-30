"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ArmoryGearItem } from "@/lib/warmane-armory";

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

type TooltipSize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

const VIEWPORT_PADDING = 16;
const TOOLTIP_GAP = 12;

function getQualityColor(quality?: string): string | undefined {
  if (!quality) return undefined;
  return QUALITY_COLORS[quality.toLowerCase()];
}

export function getGearTooltipPosition(
  anchorRect: Pick<DOMRect, "left" | "top" | "bottom">,
  tooltipSize: TooltipSize,
  viewportSize: ViewportSize,
) {
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportSize.width - tooltipSize.width - VIEWPORT_PADDING);
  const left = Math.min(Math.max(VIEWPORT_PADDING, anchorRect.left), maxLeft);
  const belowTop = anchorRect.bottom + TOOLTIP_GAP;
  const wouldOverflowBelow = belowTop + tooltipSize.height + VIEWPORT_PADDING > viewportSize.height;
  const aboveTop = Math.max(VIEWPORT_PADDING, anchorRect.top - tooltipSize.height - VIEWPORT_PADDING);

  return {
    left,
    top: wouldOverflowBelow ? aboveTop : belowTop,
  };
}

function GearItemTooltip({
  item,
  gearScore,
  qualityColor,
  tooltipId,
  position,
  tooltipRef,
}: {
  item: ArmoryGearItem;
  gearScore?: number;
  qualityColor?: string;
  tooltipId: string;
  position: { left: number; top: number };
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}) {
  const detailLines = [
    ...(item.details ?? []),
    item.enchant ? `Enchant: ${item.enchant}` : null,
    item.gems?.length ? `Gems: ${item.gems.join(", ")}` : null,
  ].filter((line): line is string => Boolean(line) && line !== item.name);

  return (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      className="pointer-events-none fixed z-[2147483647] w-[min(28rem,calc(100vw-3rem))] rounded border border-gold bg-bg-deep p-3 text-xs text-text-secondary shadow-2xl shadow-black/50"
      style={{ left: position.left, top: position.top }}
    >
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
        {gearScore !== undefined && <p className="pt-1 text-gold-light">GearScore {gearScore.toLocaleString()}</p>}
        {item.itemId && <p className="pt-1 text-text-dim">Wowhead item #{item.itemId}</p>}
      </div>
    </div>
  );
}

export function GearItemCard({ item, gearScore }: { item: ArmoryGearItem; gearScore?: number }) {
  const qualityColor = getQualityColor(item.quality);
  const cardRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING });

  const updateTooltipPosition = useCallback(() => {
    if (!cardRef.current) return;

    const anchorRect = cardRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tooltipSize = {
      width: tooltipRect?.width ?? Math.min(448, window.innerWidth - VIEWPORT_PADDING * 2),
      height: tooltipRect?.height ?? 220,
    };

    setPosition(getGearTooltipPosition(anchorRect, tooltipSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    updateTooltipPosition();
  }, [visible, updateTooltipPosition]);

  useEffect(() => {
    if (!visible) return;

    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [visible, updateTooltipPosition]);

  return (
    <article
      ref={cardRef}
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
      onPointerEnter={() => {
        updateTooltipPosition();
        setVisible(true);
      }}
      onPointerLeave={() => setVisible(false)}
      onFocus={() => {
        updateTooltipPosition();
        setVisible(true);
      }}
      onBlur={() => setVisible(false)}
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
          <div className="shrink-0 space-y-0.5 text-right text-xs tabular-nums text-text-secondary">
            {item.itemLevel && <p>ilvl {item.itemLevel}</p>}
            {gearScore !== undefined && <p className="text-gold-light">GS {gearScore.toLocaleString()}</p>}
          </div>
        </div>

        {(item.enchant || item.gems?.length) && (
          <div className="mt-1 space-y-0.5 text-xs text-text-secondary">
            {item.enchant && <p className="truncate">Enchant: {item.enchant}</p>}
            {item.gems?.length ? <p className="truncate">Gems: {item.gems.join(", ")}</p> : null}
          </div>
        )}
      </div>
      {mounted && visible && createPortal(
        <GearItemTooltip
          item={item}
          gearScore={gearScore}
          qualityColor={qualityColor}
          tooltipId={tooltipId}
          position={position}
          tooltipRef={tooltipRef}
        />,
        document.body,
      )}
    </article>
  );
}
