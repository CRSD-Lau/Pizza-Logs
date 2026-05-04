"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

export const UPLOAD_INTRO_DURATION_MS = 3800;
const REDUCED_MOTION_DURATION_MS = 350;

const SNOW = [
  { left: 4, top: 14, delay: 0, duration: 2.7, size: 2 },
  { left: 10, top: 68, delay: 0.4, duration: 3.2, size: 3 },
  { left: 17, top: 35, delay: 0.8, duration: 2.8, size: 2 },
  { left: 24, top: 80, delay: 0.1, duration: 3.5, size: 2 },
  { left: 31, top: 22, delay: 0.7, duration: 3, size: 4 },
  { left: 39, top: 58, delay: 0.3, duration: 3.4, size: 2 },
  { left: 47, top: 12, delay: 1, duration: 2.9, size: 3 },
  { left: 55, top: 76, delay: 0.5, duration: 3.7, size: 2 },
  { left: 63, top: 42, delay: 0.2, duration: 3.1, size: 3 },
  { left: 71, top: 18, delay: 0.9, duration: 3.3, size: 2 },
  { left: 80, top: 64, delay: 0.6, duration: 3, size: 4 },
  { left: 88, top: 30, delay: 0.15, duration: 3.6, size: 2 },
  { left: 95, top: 74, delay: 1.1, duration: 3.2, size: 3 },
] as const;

const SHARDS = [
  { left: 7, top: 19, rotate: -22 },
  { left: 22, top: 72, rotate: 14 },
  { left: 36, top: 28, rotate: 30 },
  { left: 57, top: 68, rotate: -34 },
  { left: 74, top: 31, rotate: 19 },
  { left: 88, top: 79, rotate: -12 },
] as const;

type SnowStyle = CSSProperties & {
  "--snow-left": string;
  "--snow-top": string;
  "--snow-delay": string;
  "--snow-duration": string;
  "--snow-size": string;
};

type ShardStyle = CSSProperties & {
  "--shard-left": string;
  "--shard-top": string;
  "--shard-rotate": string;
};

export function UploadCinematicIntro() {
  const [portalReady, setPortalReady] = useState(false);
  const [visible, setVisible] = useState(true);

  const finishIntro = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    setPortalReady(true);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      finishIntro,
      reducedMotion ? REDUCED_MOTION_DURATION_MS : UPLOAD_INTRO_DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [finishIntro]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishIntro();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finishIntro]);

  if (!portalReady || !visible) return null;

  return createPortal(
    <div
      className="frozen-aggro-overlay"
      role="dialog"
      aria-label="Frozen raid boss intro"
      aria-modal="false"
    >
      <div className="frozen-aggro-snow" aria-hidden="true">
        {SNOW.map((flake, index) => (
          <span
            key={`${flake.left}-${flake.top}-${index}`}
            className="frozen-aggro-flake"
            style={{
              "--snow-left": `${flake.left}%`,
              "--snow-top": `${flake.top}%`,
              "--snow-delay": `${flake.delay}s`,
              "--snow-duration": `${flake.duration}s`,
              "--snow-size": `${flake.size}px`,
            } as SnowStyle}
          />
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="frozen-aggro-skip border-gold-dim bg-bg-card/85 text-text-primary hover:border-gold/50 hover:text-gold-light"
        onClick={finishIntro}
      >
        Skip
      </Button>

      <div className="frozen-aggro-whiteout" aria-hidden="true" />
      <div className="frozen-aggro-horizon" aria-hidden="true" />
      <div className="frozen-aggro-spires" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="frozen-aggro-icefire" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="frozen-aggro-figure" aria-hidden="true">
        <div className="frozen-aggro-boss-aura" />
        <div className="frozen-aggro-shadow" />
        <svg viewBox="0 0 360 470" className="frozen-aggro-warlord">
          <defs>
            <filter id="frozenPaintEdge" x="-18%" y="-18%" width="136%" height="136%">
              <feTurbulence baseFrequency="0.012" numOctaves="2" seed="12" type="fractalNoise" result="grain" />
              <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" />
            </filter>
            <filter id="frozenSoftGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            <linearGradient id="frozenArmorGradient" x1="0.08" x2="0.96" y1="0.04" y2="0.98">
              <stop offset="0%" stopColor="#174a61" />
              <stop offset="38%" stopColor="#071929" />
              <stop offset="100%" stopColor="#01040a" />
            </linearGradient>
            <linearGradient id="frozenCapeGradient" x1="0.5" x2="0.5" y1="0" y2="1">
              <stop offset="0%" stopColor="#123449" />
              <stop offset="42%" stopColor="#04111d" />
              <stop offset="100%" stopColor="#010307" />
            </linearGradient>
            <linearGradient id="frozenBladeGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e9fbff" />
              <stop offset="45%" stopColor="#4cd5f5" />
              <stop offset="100%" stopColor="#071421" />
            </linearGradient>
            <radialGradient id="frozenRuneGradient" cx="50%" cy="46%" r="62%">
              <stop offset="0%" stopColor="#f2fcff" />
              <stop offset="44%" stopColor="#40d8f8" />
              <stop offset="100%" stopColor="#0a293c" />
            </radialGradient>
            <radialGradient id="frozenFurGradient" cx="50%" cy="36%" r="68%">
              <stop offset="0%" stopColor="#d8f7ff" stopOpacity="0.88" />
              <stop offset="44%" stopColor="#6fdaf0" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#0a1624" stopOpacity="0.08" />
            </radialGradient>
          </defs>
          <g className="frozen-aggro-painted-figure" filter="url(#frozenPaintEdge)">
            <path
              d="M180 58C121 88 80 154 58 283c-8 47-13 105-14 174h272c-1-69-6-127-14-174-22-129-63-195-122-225Z"
              className="frozen-aggro-cape"
            />
            <path d="M84 274c-12 51-18 105-18 183h50c1-77-5-136-32-183Z" className="frozen-aggro-cloak-tear" />
            <path d="M276 274c12 51 18 105 18 183h-50c-1-77 5-136 32-183Z" className="frozen-aggro-cloak-tear" />
            <path d="M180 94c-52 32-84 102-91 224h182c-7-122-39-192-91-224Z" className="frozen-aggro-back-shadow" />
            <path
              d="M34 190c12-47 53-82 101-88l34 57-43 98-78-4-31-31 17-32Z"
              className="frozen-aggro-pauldron"
            />
            <path
              d="M326 190c-12-47-53-82-101-88l-34 57 43 98 78-4 31-31-17-32Z"
              className="frozen-aggro-pauldron"
            />
            <path d="M45 191 11 151l67 16 43-55 17 47-52 79-41-47Z" className="frozen-aggro-shoulder-spike" />
            <path d="M315 191 349 151l-67 16-43-55-17 47 52 79 41-47Z" className="frozen-aggro-shoulder-spike" />
            <path
              d="M180 6l17 62 34-43-3 69 59-35-48 76H121L73 59l59 35-3-69 34 43 17-62Z"
              className="frozen-aggro-crown"
            />
            <path d="M180 17c-28 30-45 67-42 104l20 46h44l20-46c3-37-14-74-42-104Z" className="frozen-aggro-helm" />
            <path d="M137 89 92 116l59 20-18-33 4-14Z" className="frozen-aggro-helm-wing" />
            <path d="M223 89l45 27-59 20 18-33-4-14Z" className="frozen-aggro-helm-wing" />
            <path
              d="M104 164c20-36 45-54 76-54s56 18 76 54l-21 73 15 211H110l15-211-21-73Z"
              className="frozen-aggro-body"
            />
            <path
              d="M93 150c28-30 58-45 87-45s59 15 87 45c-18 20-45 31-87 31s-69-11-87-31Z"
              className="frozen-aggro-fur-mantle"
            />
            <path d="M116 170c16 14 37 21 64 21s48-7 64-21l-13 62H129l-13-62Z" className="frozen-aggro-plate" />
            <g className="frozen-aggro-front-details">
              <path
                d="M151 105c8-20 17-34 29-43 12 9 21 23 29 43l-10 48h-38l-10-48Z"
                className="frozen-aggro-mask-plate"
              />
              <path d="M164 134h32l12 18-28 24-28-24 12-18Z" className="frozen-aggro-mask-shadow" />
              <path d="M164 126h-23l-19 22 37 5 5-27ZM196 126h23l19 22-37 5-5-27Z" className="frozen-aggro-cheek-plate" />
              <path d="M180 83 164 129h32L180 83Z" className="frozen-aggro-face-rune" />
              <path d="M158 122h16" className="frozen-aggro-eye-line frozen-aggro-eyes" />
              <path d="M186 122h16" className="frozen-aggro-eye-line frozen-aggro-eyes" />
              <circle cx="94" cy="183" r="23" className="frozen-aggro-shoulder-rune" />
              <circle cx="266" cy="183" r="23" className="frozen-aggro-shoulder-rune" />
              <path
                d="M82 183h24M94 169v28M254 183h24M266 169v28"
                className="frozen-aggro-armor-line"
              />
              <path d="M143 210h74l-16 84h-42l-16-84Z" className="frozen-aggro-chest" />
              <path d="M180 212 207 258 180 333 153 258 180 212Z" className="frozen-aggro-rune-core" />
              <path
                d="M180 150 160 374l20 86 20-86-20-224Z"
                className="frozen-aggro-standing-blade"
              />
              <path
                d="M126 218c18 20 31 33 54 33s36-13 54-33M126 267c22 18 36 28 54 28s32-10 54-28M139 318h82M131 354h98"
                className="frozen-aggro-rune-veins"
              />
            </g>
            <path d="M127 385 103 457h55l22-72h-53Z" className="frozen-aggro-leg" />
            <path d="M233 385 257 457h-55l-22-72h53Z" className="frozen-aggro-leg" />
            <path d="M80 255 121 223l31 40-29 61-61 10-28-27 46-52Z" className="frozen-aggro-gauntlet" />
            <path d="M280 255 239 223l-31 40 29 61 61 10 28-27-46-52Z" className="frozen-aggro-gauntlet" />
            <path d="M71 277c19 17 43 28 70 31M289 277c-19 17-43 28-70 31" className="frozen-aggro-armor-line" />
          </g>
        </svg>
      </div>

      <div className="frozen-aggro-blade" aria-hidden="true">
        <svg viewBox="0 0 300 140">
          <path
            d="M35 101c46-39 107-69 184-89l51 6-39 36C159 61 98 85 45 121l-10-20Z"
            className="frozen-aggro-blade-trail"
          />
          <path
            d="M72 91c48-31 98-52 151-63l16 7-15 13C174 57 126 77 81 105l-9-14Z"
            className="frozen-aggro-blade-edge"
          />
          <path d="M83 104 58 118l-13-20 26-13 12 19Z" className="frozen-aggro-blade-guard" />
        </svg>
      </div>

      <div className="frozen-aggro-crack" aria-hidden="true">
        <svg viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M604 65 575 184l41 98-67 108 36 95-101 108 23 131" />
          <path d="M585 298 430 236l-121 46" />
          <path d="M581 438 414 479l-89 105" />
          <path d="M612 278 778 203l125 35" />
          <path d="M593 506 777 559l108 113" />
          <path d="M513 612 306 685l-95 80" />
          <path d="M649 628 851 684l137 78" />
        </svg>
      </div>

      <div className="frozen-aggro-shards" aria-hidden="true">
        {SHARDS.map((shard, index) => (
          <span
            key={`${shard.left}-${shard.top}-${index}`}
            className="frozen-aggro-shard"
            style={{
              "--shard-left": `${shard.left}%`,
              "--shard-top": `${shard.top}%`,
              "--shard-rotate": `${shard.rotate}deg`,
            } as ShardStyle}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
