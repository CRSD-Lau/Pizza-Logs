"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Shield } from "lucide-react";
import type { ArmoryCharacterGear } from "@/lib/warmane-armory";
import { getClassIconUrl } from "@/lib/class-icons";
import {
  PAPER_DOLL_LEFT_SLOTS,
  PAPER_DOLL_RIGHT_SLOTS,
  PAPER_DOLL_WEAPON_SLOTS,
} from "@/lib/gear-layout";
import { cn } from "@/lib/utils";
import { WarmaneCharacterModel } from "./WarmaneCharacterModel";

type PlayerAvatarSize = "xs" | "sm" | "lg";

type PlayerAvatarProps = {
  name: string;
  realmName?: string | null;
  characterClass?: string | null;
  raceName?: string | null;
  guildName?: string | null;
  color: string;
  fallbackIconUrl?: string | null;
  size?: PlayerAvatarSize;
  className?: string;
};

type GearPreview = {
  ok: true;
  gear: ArmoryCharacterGear;
  stale: boolean;
  className: string | null;
  raceName: string | null;
  guildName: string | null;
  gearScore: {
    score: number;
    averageItemLevel: number;
    quality: string;
  } | null;
};

type GearPreviewFailure = {
  ok: false;
  message: string;
  sourceUrl: string;
  characterName: string;
  realm: string;
  className: string | null;
};

type GearPreviewResponse = GearPreview | GearPreviewFailure;

const SIZE_CLASSES: Record<PlayerAvatarSize, string> = {
  xs: "h-9 w-9 text-xs",
  sm: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;
const TOOLTIP_MAX_WIDTH = 736;
const CLIENT_CACHE_MS = 5 * 60 * 1000;
const previewCache = new Map<string, { expiresAt: number; data: GearPreviewResponse }>();
const previewRequests = new Map<string, Promise<GearPreviewResponse>>();

function getInitials(name: string): string {
  return name.trim().substring(0, 2).toUpperCase() || "??";
}

function getPreviewKey(name: string, realmName?: string | null): string {
  return `${name.trim().toLowerCase()}@${(realmName ?? "Lordaeron").trim().toLowerCase()}`;
}

function GearSlotRailItem({
  slot,
  item,
  side,
}: {
  slot: string;
  item?: ArmoryCharacterGear["items"][number];
  side: "left" | "right";
}) {
  const icon = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-card shadow-inner shadow-black/70">
      {item?.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Item icon URLs are normalized and supplied by the Armory/item cache.
        <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] font-bold text-text-dim">—</span>
      )}
    </div>
  );

  const label = (
    <div className={cn("min-w-0", side === "left" ? "text-right" : "text-left")}>
      <p className="truncate text-[9px] uppercase tracking-[0.12em] text-text-dim">{slot}</p>
      <p className={cn("truncate text-[11px] font-semibold", item ? "text-text-primary" : "text-text-dim")}>
        {item?.name ?? "Empty"}
      </p>
    </div>
  );

  return (
    <div className={cn(
      "flex min-w-0 items-center gap-2 border-b border-gold-dim/45 py-1",
      side === "left" ? "justify-end" : "justify-start",
    )}>
      {side === "left" ? <>{label}{icon}</> : <>{icon}{label}</>}
    </div>
  );
}

function WeaponSlotItem({
  slot,
  item,
}: {
  slot: string;
  item?: ArmoryCharacterGear["items"][number];
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xs border border-gold-dim/55 bg-bg-panel/80 p-1.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-card shadow-inner shadow-black/70">
        {item?.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Item icon URLs are normalized and supplied by the Armory/item cache.
          <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold text-text-dim">—</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-text-dim">{slot}</p>
        <p className={cn("truncate text-[11px] font-semibold", item ? "text-text-primary" : "text-text-dim")}>
          {item?.name ?? "Empty"}
        </p>
      </div>
    </div>
  );
}

export function getPlayerGearTooltipPosition(
  anchorRect: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
  tooltipSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
) {
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportSize.width - tooltipSize.width - VIEWPORT_PADDING);
  const centeredLeft = anchorRect.left + (anchorRect.right - anchorRect.left - tooltipSize.width) / 2;
  const left = Math.min(Math.max(VIEWPORT_PADDING, centeredLeft), maxLeft);
  const belowTop = anchorRect.bottom + TOOLTIP_GAP;
  const top = belowTop + tooltipSize.height + VIEWPORT_PADDING <= viewportSize.height
    ? belowTop
    : Math.max(VIEWPORT_PADDING, anchorRect.top - tooltipSize.height - TOOLTIP_GAP);

  return { left, top };
}

function GearPreviewPanel({
  name,
  initialClass,
  initialRace,
  initialGuild,
  preview,
  loading,
  tooltipId,
  tooltipRef,
  position,
}: {
  name: string;
  initialClass?: string | null;
  initialRace?: string | null;
  initialGuild?: string | null;
  preview: GearPreviewResponse | null;
  loading: boolean;
  tooltipId: string;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  position: { left: number; top: number };
}) {
  const className = preview?.className ?? initialClass ?? null;
  const classIconUrl = getClassIconUrl(className);
  const raceName = preview?.ok ? preview.raceName : initialRace;
  const guildName = preview?.ok ? preview.guildName : initialGuild;
  const itemsBySlot = preview?.ok
    ? new Map(preview.gear.items.map((item) => [item.slot === "Ranged" ? "Ranged/Relic" : item.slot, item]))
    : new Map<string, ArmoryCharacterGear["items"][number]>();

  return (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      className="pointer-events-none fixed z-2147483647 w-[min(46rem,calc(100vw-1.5rem))] overflow-hidden rounded-sm border border-gold bg-bg-deep text-left shadow-2xl shadow-black/60"
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-center gap-3 border-b border-gold-dim bg-bg-panel px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-deep">
          {classIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Static WoW icon host; remote Next image optimization is intentionally disabled.
            <img src={classIconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-text-secondary">{getInitials(name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">{name}</p>
              <p className="truncate text-xs text-text-secondary">
                {[className, raceName, guildName].filter(Boolean).join(" · ") || "Warmane character"}
              </p>
            </div>
            {preview?.ok && preview.gearScore && (
              <div className="shrink-0 text-right">
                <p className="text-base font-bold tabular-nums text-gold-light">
                  {preview.gearScore.score.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-text-dim">GearScore</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-36 items-center justify-center gap-2 px-4 py-6 text-sm text-text-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-dim border-t-gold" aria-hidden="true" />
          Pulling current gear from Warmane…
        </div>
      )}

      {!loading && preview && !preview.ok && (
        <div className="px-4 py-5 text-sm text-text-secondary">
          <p className="font-semibold text-text-primary">Gear is unavailable right now.</p>
          <p className="mt-1">{preview.message}</p>
        </div>
      )}

      {!loading && preview?.ok && (
        <>
          <div className="grid grid-cols-2 gap-x-3 px-3 py-3 sm:hidden">
            {preview.gear.items.map((item, index) => (
              <div
                key={`${item.slot}-${item.itemId ?? item.name}-${index}`}
                className="flex min-w-0 items-center gap-2 border-b border-gold-dim/55 py-1.5 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+3)]:border-b-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-card">
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Item icon URLs are normalized and supplied by the Armory/item cache.
                    <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-text-dim">{item.slot.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] uppercase tracking-wide text-text-dim">{item.slot}</p>
                  <p className="truncate text-xs font-semibold text-text-primary">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden px-3 py-3 sm:block">
            <div className="grid grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] gap-x-3">
              <div className="min-w-0">
                {PAPER_DOLL_LEFT_SLOTS.map((slot) => (
                  <GearSlotRailItem key={slot} slot={slot} item={itemsBySlot.get(slot)} side="left" />
                ))}
              </div>

              <div className="relative flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-sm border border-gold-dim/70 bg-[radial-gradient(circle_at_center,rgba(196,157,52,0.16),rgba(8,11,16,0.92)_62%)] shadow-inner shadow-black/80">
                <div className="absolute inset-3 rounded-full border border-gold-dim/25" aria-hidden="true" />
                <div className="absolute inset-7 rounded-full border border-gold-dim/15" aria-hidden="true" />
                {preview.gear.appearance ? (
                  <WarmaneCharacterModel appearance={preview.gear.appearance} characterName={name} />
                ) : (
                  <p className="absolute inset-x-2 top-3 z-20 rounded-xs bg-bg-deep/90 px-2 py-1.5 text-center text-[11px] text-text-secondary">
                    Appearance unavailable from Armory
                  </p>
                )}
                {classIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Static WoW class icon host.
                  <img
                    src={classIconUrl}
                    alt=""
                    className="h-24 w-24 rounded-full border border-gold-dim/70 object-cover opacity-55 grayscale-[20%] shadow-2xl shadow-black"
                  />
                ) : (
                  <span className="text-3xl font-bold text-gold/60">{getInitials(name)}</span>
                )}
                <p className="relative z-20 mt-4 text-sm font-bold text-gold-light drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">{name}</p>
                <p className="relative z-20 mt-1 text-[10px] uppercase tracking-[0.18em] text-text-secondary drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {[raceName, className].filter(Boolean).join(" · ") || "Warmane character"}
                </p>
                {preview.gearScore && (
                  <div className="relative z-20 mt-4 border-y border-gold-dim/45 bg-bg-deep/65 px-4 py-2 text-center backdrop-blur-[1px]">
                    <p className="text-xl font-bold tabular-nums text-gold-light">
                      {preview.gearScore.score.toLocaleString()}
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-text-dim">GearScore</p>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {PAPER_DOLL_RIGHT_SLOTS.map((slot) => (
                  <GearSlotRailItem key={slot} slot={slot} item={itemsBySlot.get(slot)} side="right" />
                ))}
              </div>
            </div>

            <div className="mx-auto mt-3 grid max-w-2xl grid-cols-3 gap-2">
              {PAPER_DOLL_WEAPON_SLOTS.map((slot) => (
                <WeaponSlotItem key={slot} slot={slot} item={itemsBySlot.get(slot)} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-gold-dim bg-bg-panel px-3 py-2 text-[11px] text-text-dim">
            <span>
              {preview.stale ? "Cached fallback" : "Live Armory"} · {new Date(preview.gear.fetchedAt).toLocaleString()}
              {preview.gear.appearanceStale && <span className="hidden sm:inline"> · Cached appearance</span>}
            </span>
            {preview.gearScore && <span>avg ilvl {preview.gearScore.averageItemLevel}</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function PlayerAvatar({
  name,
  realmName,
  characterClass,
  raceName,
  guildName,
  color,
  fallbackIconUrl,
  size = "sm",
  className,
}: PlayerAvatarProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<GearPreviewResponse | null>(null);
  const [position, setPosition] = useState({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();
  const initials = getInitials(name);
  const resolvedClass = preview?.className ?? characterClass;
  const resolvedFallbackIconUrl = getClassIconUrl(resolvedClass) ?? fallbackIconUrl;
  const imageUrl = !iconFailed && resolvedFallbackIconUrl ? resolvedFallbackIconUrl : null;
  const state = imageUrl ? "class-icon" : "initials";

  const updateTooltipPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const anchorRect = buttonRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    setPosition(getPlayerGearTooltipPosition(anchorRect, {
      width: tooltipRect?.width ?? Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2),
      height: tooltipRect?.height ?? 420,
    }, {
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }, []);

  const loadPreview = useCallback(async () => {
    const cacheKey = getPreviewKey(name, realmName);
    const cached = previewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setPreview(cached.data);
      return;
    }
    setLoading(true);
    try {
      let request = previewRequests.get(cacheKey);
      if (!request) {
        request = (async () => {
          try {
            const searchParams = new URLSearchParams();
            if (realmName) searchParams.set("realm", realmName);
            const query = searchParams.toString();
            const response = await fetch(`/api/players/${encodeURIComponent(name)}/gear${query ? `?${query}` : ""}`);
            const data = await response.json() as GearPreviewResponse | { error?: string };
            if (!response.ok || !("ok" in data)) {
              throw new Error("Gear quick look is unavailable.");
            }
            return data;
          } finally {
            previewRequests.delete(cacheKey);
          }
        })();
        previewRequests.set(cacheKey, request);
      }

      const data = await request;
      previewCache.set(cacheKey, { expiresAt: Date.now() + CLIENT_CACHE_MS, data });
      setPreview(data);
    } catch (error) {
      setPreview({
        ok: false,
        message: error instanceof Error ? error.message : "Gear quick look is unavailable.",
        sourceUrl: "",
        characterName: name,
        realm: realmName ?? "Lordaeron",
        className: characterClass ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [characterClass, name, realmName]);

  const showPreview = useCallback(() => {
    setVisible(true);
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (visible) updateTooltipPosition();
  }, [loading, preview, updateTooltipPosition, visible]);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setVisible(false);
    };
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [updateTooltipPosition, visible]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`View live gear for ${name}`}
      aria-describedby={visible ? tooltipId : undefined}
      className={cn(
        "group/avatar relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xs outline-hidden",
        "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep",
        className,
      )}
      data-pizza-avatar="character"
      data-pizza-avatar-state={state}
      data-character-name={name}
      data-character-realm={realmName ?? "Lordaeron"}
      data-character-class={resolvedClass ?? ""}
      data-character-race={raceName ?? ""}
      data-character-guild={guildName ?? ""}
      data-initials={initials}
      data-fallback-icon-url={resolvedFallbackIconUrl ?? ""}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") showPreview();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setVisible(false);
      }}
      onFocus={showPreview}
      onBlur={() => setVisible(false)}
      onClick={showPreview}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-xs font-bold transition-colors group-hover/avatar:border-gold/70",
          SIZE_CLASSES[size],
        )}
        style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Static class icon URLs are external and not optimized by Next.
          <img
            data-pizza-avatar-image="true"
            src={imageUrl}
            alt={`${resolvedClass ?? name} class icon`}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <span data-pizza-avatar-initials="true">{initials}</span>
        )}
      </span>
      <span
        className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border border-gold-dim bg-bg-deep text-gold shadow-sm"
        aria-hidden="true"
      >
        <Shield className="h-2.5 w-2.5" strokeWidth={2.25} />
      </span>
      {mounted && visible && createPortal(
        <GearPreviewPanel
          name={name}
          initialClass={characterClass}
          initialRace={raceName}
          initialGuild={guildName}
          preview={preview}
          loading={loading}
          tooltipId={tooltipId}
          tooltipRef={tooltipRef}
          position={position}
        />,
        document.body,
      )}
    </button>
  );
}
