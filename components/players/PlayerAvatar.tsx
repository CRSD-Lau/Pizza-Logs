"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Shield, UserRound } from "lucide-react";
import type { ArmoryCharacterGear } from "@/lib/warmane-armory";
import { getPlayerClassMeta, normalizePlayerClass } from "@/lib/player-class";
import { getPlayerGearPreviewKey, getResolvedPreviewClass, hasResolvedPreviewClass, playerGearPreviewClient, type GearPreviewResponse } from "@/lib/player-gear-preview";
import {
  PAPER_DOLL_LEFT_SLOTS,
  PAPER_DOLL_RIGHT_SLOTS,
  PAPER_DOLL_WEAPON_SLOTS,
} from "@/lib/gear-layout";
import { cn, formatDateTimeUtc, formatInteger } from "@/lib/utils";
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
  onClassResolved?: (className: string | null) => void;
};

const SIZE_CLASSES: Record<PlayerAvatarSize, string> = {
  xs: "h-9 w-9 text-xs",
  sm: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;
const TOOLTIP_MAX_WIDTH = 736;

function getInitials(name: string): string {
  return name.trim().substring(0, 2).toUpperCase() || "??";
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
        <span className="text-xs font-bold text-text-dim">-</span>
      )}
    </div>
  );

  const label = (
    <div className={cn("min-w-0", side === "left" ? "text-right" : "text-left")}>
      <p className="truncate text-xs uppercase tracking-[0.12em] text-text-dim">{slot}</p>
      <p className={cn("truncate text-xs font-semibold", item ? "text-text-primary" : "text-text-dim")}>
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
          <span className="text-xs font-bold text-text-dim">-</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-[0.12em] text-text-dim">{slot}</p>
        <p className={cn("truncate text-xs font-semibold", item ? "text-text-primary" : "text-text-dim")}>
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
  onPointerEnter,
  onPointerLeave,
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
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const identity = getPlayerClassMeta(hasResolvedPreviewClass(preview) ? preview?.className : initialClass);
  const className = identity.className;
  const classIconUrl = identity.iconUrl;
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const hasClassIcon = classIconUrl && failedIconUrl !== classIconUrl;
  const raceName = preview?.raceName ?? initialRace;
  const guildName = preview?.guildName ?? initialGuild;
  const itemsBySlot = preview?.ok
    ? new Map(preview.gear.items.map((item) => [item.slot === "Ranged" ? "Ranged/Relic" : item.slot, item]))
    : new Map<string, ArmoryCharacterGear["items"][number]>();
  const knownSlots = new Set<string>([...PAPER_DOLL_LEFT_SLOTS, ...PAPER_DOLL_RIGHT_SLOTS, ...PAPER_DOLL_WEAPON_SLOTS]);
  const unplacedItems = preview?.ok
    ? preview.gear.items.filter(item => !knownSlots.has(item.slot === "Ranged" ? "Ranged/Relic" : item.slot))
    : [];

  return (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      className="pointer-events-auto fixed z-2147483647 max-h-[calc(100dvh-1.5rem)] w-[min(46rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-sm border border-gold bg-bg-deep text-left shadow-2xl shadow-black/60"
      style={{ left: position.left, top: position.top }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="flex items-center gap-3 border-b border-gold-dim bg-bg-panel px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-deep">
          {hasClassIcon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Static WoW icon host; remote Next image optimization is intentionally disabled.
            <img src={classIconUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedIconUrl(classIconUrl)} />
          ) : (
            <UserRound aria-hidden="true" className="h-5 w-5 text-text-secondary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: identity.textColor }}>{name}</p>
              <p className="truncate text-xs text-text-secondary">
                {[identity.label, raceName, guildName].filter(Boolean).join(" · ")}
              </p>
            </div>
            {preview?.ok && preview.gearScore && (
              <div className="shrink-0 text-right">
                <p className="text-base font-bold tabular-nums text-gold-light">
                  {formatInteger(preview.gearScore.score)}
                </p>
                <p className="text-xs uppercase tracking-wider text-text-dim">GearScore</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && !preview?.ok && (
        <div className="flex min-h-36 items-center justify-center gap-2 px-4 py-6 text-sm text-text-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-dim border-t-gold" aria-hidden="true" />
          Loading gear from Warmane…
        </div>
      )}

      {!loading && preview && !preview.ok && (
        <div className="px-4 py-5 text-sm text-text-secondary">
          <p className="font-semibold text-text-primary">Gear is unavailable right now.</p>
          <p className="mt-1">{preview.message}</p>
        </div>
      )}

      {preview?.ok && (
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
                    <span className="text-xs font-bold text-text-dim">{item.slot.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-wide text-text-dim">{item.slot}</p>
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
                  <p className="absolute inset-x-2 top-3 z-20 rounded-xs bg-bg-deep/90 px-2 py-1.5 text-center text-xs text-text-secondary">
                    Appearance unavailable from Armory
                  </p>
                )}
                {hasClassIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Static WoW class icon host.
                  <img
                    src={classIconUrl}
                    alt=""
                    onError={() => setFailedIconUrl(classIconUrl)}
                    className="h-24 w-24 rounded-full border border-gold-dim/70 object-cover opacity-55 grayscale-[20%] shadow-2xl shadow-black"
                  />
                ) : (
                  <UserRound aria-hidden="true" className="h-20 w-20 text-text-secondary" />
                )}
                <p className="relative z-20 mt-4 text-sm font-bold text-gold-light drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">{name}</p>
                <p className="relative z-20 mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {[raceName, className].filter(Boolean).join(" · ") || "Warmane character"}
                </p>
                {preview.gearScore && (
                  <div className="relative z-20 mt-4 border-y border-gold-dim/45 bg-bg-deep/65 px-4 py-2 text-center backdrop-blur-[1px]">
                    <p className="text-xl font-bold tabular-nums text-gold-light">
                      {formatInteger(preview.gearScore.score)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-text-dim">GearScore</p>
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
          {unplacedItems.length > 0 && (
            <div className="hidden border-t border-gold-dim px-3 py-3 sm:block">
              <p className="text-xs font-semibold text-text-secondary">Slot unavailable</p>
              <ul className="mt-2 grid list-none grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-primary">
                {unplacedItems.map((item, index) => <li key={`${item.itemId ?? item.name}-${index}`} className="min-w-0 break-words">{item.name}</li>)}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-gold-dim bg-bg-panel px-3 py-2 text-xs text-text-dim">
            <span>
              {loading ? "Refreshing Armory" : preview.stale ? "Cached fallback" : "Armory snapshot"} · {formatDateTimeUtc(preview.gear.fetchedAt)}
              {preview.gear.appearanceStale && <span className="hidden sm:inline"> · Cached appearance</span>}
            </span>
            {preview.gearScore && <span>Average item level {formatInteger(preview.gearScore.averageItemLevel)}</span>}
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
  size = "sm",
  className,
  onClassResolved,
}: PlayerAvatarProps) {
  const cacheKey = getPlayerGearPreviewKey(name, realmName);
  const canonicalClass = normalizePlayerClass(characterClass);
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<{ key: string; loading: boolean; preview: GearPreviewResponse | null } | null>(null);
  const [position, setPosition] = useState({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInPreviewRef = useRef(false);
  const suppressPointerOpenRef = useRef(false);
  const requestIdRef = useRef(0);
  const identityRef = useRef<{ key: string; characterClass?: string | null; onClassResolved?: PlayerAvatarProps["onClassResolved"]; classOverride?: string | null }>({ key: "", characterClass, onClassResolved });
  const reportedClassRef = useRef<string | null>(null);
  const tooltipId = useId();
  const initials = getInitials(name);
  const visible = openKey === cacheKey;
  const rawPreview = requestState?.key === cacheKey ? requestState.preview : null;
  const [classState, setClassState] = useState<{ key: string; propClass: string | null; overrideClass?: string | null }>({ key: cacheKey, propClass: canonicalClass });
  const sameIdentity = classState.key === cacheKey;
  const changedClass = sameIdentity && classState.propClass !== canonicalClass;
  // A prop which confirms our correction keeps the open preview. A different
  // server identity supersedes its older class, including on cached reopen.
  const classOverride = !sameIdentity ? undefined : changedClass
    ? getResolvedPreviewClass(rawPreview) === canonicalClass ? undefined : canonicalClass
    : classState.overrideClass;
  if (!sameIdentity || changedClass) {
    setClassState({ key: cacheKey, propClass: canonicalClass, overrideClass: classOverride });
  }
  const preview = useMemo(() => rawPreview && classOverride !== undefined ? { ...rawPreview, className: classOverride } : rawPreview, [rawPreview, classOverride]);
  const loading = requestState?.key === cacheKey && requestState.loading;
  const identity = getPlayerClassMeta(hasResolvedPreviewClass(preview) ? preview?.className : characterClass);
  const resolvedClass = identity.className;
  const resolvedFallbackIconUrl = identity.iconUrl;
  const imageUrl = failedIconUrl !== resolvedFallbackIconUrl ? resolvedFallbackIconUrl : null;
  const state = imageUrl ? "class-icon" : "fallback-icon";

  useLayoutEffect(() => {
    if (identityRef.current.key !== cacheKey) reportedClassRef.current = null;
    identityRef.current = { key: cacheKey, characterClass, onClassResolved, classOverride };
  }, [cacheKey, characterClass, onClassResolved, classOverride]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    clearTimeout(closeTimerRef.current ?? undefined);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current ?? undefined);
  }, []);

  const closePreview = useCallback(() => {
    cancelClose();
    pointerInPreviewRef.current = false;
    setOpenKey(null);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      if (!pointerInPreviewRef.current && document.activeElement !== buttonRef.current) setOpenKey(null);
    }, 180);
  }, [cancelClose]);

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
    const requestId = ++requestIdRef.current;
    setRequestState(current => ({ key: cacheKey, loading: true, preview: current?.key === cacheKey ? current.preview : null }));
    const data = await playerGearPreviewClient.load(name, realmName);
    if (requestIdRef.current !== requestId || identityRef.current.key !== cacheKey) return;
    setRequestState({ key: cacheKey, loading: false, preview: data });
    const correctedClass = getResolvedPreviewClass(data);
    const hasClassResult = hasResolvedPreviewClass(data);
    const acceptedClass = identityRef.current.classOverride === undefined || correctedClass === identityRef.current.classOverride;
    if (hasClassResult && correctedClass === identityRef.current.classOverride) {
      setClassState(current => current.key === cacheKey ? { ...current, overrideClass: undefined } : current);
    }
    const reportKey = `${cacheKey}:${normalizePlayerClass(identityRef.current.characterClass)}:${correctedClass}`;
    if (acceptedClass && hasClassResult && correctedClass !== normalizePlayerClass(identityRef.current.characterClass)
      && reportedClassRef.current !== reportKey) {
      reportedClassRef.current = reportKey;
      identityRef.current.onClassResolved?.(correctedClass);
    }
  }, [cacheKey, name, realmName]);

  const showPreview = useCallback(() => {
    cancelClose();
    suppressPointerOpenRef.current = false;
    setOpenKey(cacheKey);
    void loadPreview();
  }, [cacheKey, cancelClose, loadPreview]);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (visible) updateTooltipPosition();
  }, [loading, preview, updateTooltipPosition, visible]);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Closing an overlapping tooltip can expose its trigger beneath a
        // stationary pointer. Only real pointer movement or another deliberate
        // interaction should reopen it, including after leaving the model iframe.
        suppressPointerOpenRef.current = true;
        closePreview();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node) || tooltipRef.current?.contains(event.target as Node)) return;
      closePreview();
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
  }, [closePreview, updateTooltipPosition, visible]);

  return (
    <>
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
        if (event.pointerType === "mouse" && !suppressPointerOpenRef.current) showPreview();
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" && suppressPointerOpenRef.current) showPreview();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          suppressPointerOpenRef.current = false;
          scheduleClose();
        }
      }}
      onFocus={showPreview}
      onBlur={scheduleClose}
      onClick={showPreview}
      onKeyDown={(event) => {
        if (!visible || !tooltipRef.current) return;
        const distances: Record<string, number> = { ArrowDown: 48, ArrowUp: -48, PageDown: tooltipRef.current.clientHeight, PageUp: -tooltipRef.current.clientHeight };
        if (event.key in distances) {
          event.preventDefault();
          tooltipRef.current.scrollBy({ top: distances[event.key] });
        }
      }}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-xs font-bold transition-colors group-hover/avatar:border-gold/70",
          SIZE_CLASSES[size],
        )}
        style={{ background: `${identity.color}22`, color: identity.textColor, border: `1px solid ${identity.color}66` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Static class icon URLs are external and not optimized by Next.
          <img
            data-pizza-avatar-image="true"
            src={imageUrl}
            alt={`${resolvedClass ?? name} class icon`}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailedIconUrl(imageUrl)}
          />
        ) : (
          <UserRound data-pizza-avatar-fallback="true" aria-hidden="true" className="h-5 w-5" />
        )}
      </span>
      <span
        className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border border-gold-dim bg-bg-deep text-gold shadow-sm"
        aria-hidden="true"
      >
        <Shield className="h-2.5 w-2.5" strokeWidth={2.25} />
      </span>
    </button>
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
          onPointerEnter={() => {
            pointerInPreviewRef.current = true;
            cancelClose();
          }}
          onPointerLeave={() => {
            pointerInPreviewRef.current = false;
            scheduleClose();
          }}
        />,
        document.body,
      )}
    </>
  );
}
