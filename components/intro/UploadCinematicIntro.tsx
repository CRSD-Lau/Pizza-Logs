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
        <svg viewBox="0 0 260 330" className="frozen-aggro-warlord">
          <defs>
            <linearGradient id="frozenArmorGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#102f45" />
              <stop offset="52%" stopColor="#071421" />
              <stop offset="100%" stopColor="#02050a" />
            </linearGradient>
            <linearGradient id="frozenBladeGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e9fbff" />
              <stop offset="45%" stopColor="#4cd5f5" />
              <stop offset="100%" stopColor="#071421" />
            </linearGradient>
            <radialGradient id="frozenRuneGradient" cx="50%" cy="44%" r="62%">
              <stop offset="0%" stopColor="#f2fcff" />
              <stop offset="44%" stopColor="#40d8f8" />
              <stop offset="100%" stopColor="#0a293c" />
            </radialGradient>
          </defs>
          <path d="M130 50C76 84 45 153 49 326h162c5-172-27-241-81-276Z" className="frozen-aggro-cape" />
          <path d="M30 135 78 86l32 42-31 69-52-14-17-29 20-19Z" className="frozen-aggro-pauldron" />
          <path d="M230 135 182 86l-32 42 31 69 52-14 17-29-20-19Z" className="frozen-aggro-pauldron" />
          <path d="M130 6 143 46 160 24 158 68 190 52 163 94H97L70 52l32 16-2-44 17 22 13-40Z" className="frozen-aggro-crown" />
          <path d="M130 10 103 45l10 34h34l10-34-27-35Z" className="frozen-aggro-helm" />
          <path d="M103 45 83 63l26 13-12-21 6-10Z" className="frozen-aggro-helm-wing" />
          <path d="M157 45 177 63l-26 13 12-21-6-10Z" className="frozen-aggro-helm-wing" />
          <path
            d="M83 114c11-32 27-48 47-48s36 16 47 48l-16 38 12 142H87l12-142-16-38Z"
            className="frozen-aggro-body"
          />
          <g className="frozen-aggro-front-details">
            <circle cx="70" cy="133" r="16" className="frozen-aggro-shoulder-rune" />
            <circle cx="190" cy="133" r="16" className="frozen-aggro-shoulder-rune" />
            <path d="M62 128h16M70 120v25M182 128h16M190 120v25" className="frozen-aggro-armor-line" />
            <path d="M106 122h48l-10 56h-28l-10-56Z" className="frozen-aggro-chest" />
            <path d="M130 133 148 164 130 213 112 164 130 133Z" className="frozen-aggro-rune-core" />
            <path d="M130 91 115 257l15 58 15-58-15-166Z" className="frozen-aggro-standing-blade" />
          </g>
          <path d="M95 280 76 326h39l15-46H95Z" className="frozen-aggro-leg" />
          <path d="M165 280 184 326h-39l-15-46h35Z" className="frozen-aggro-leg" />
          <path d="M66 187 93 162l21 31-19 43-37 5-17-20 25-34Z" className="frozen-aggro-gauntlet" />
          <path d="M194 187 167 162l-21 31 19 43 37 5 17-20-25-34Z" className="frozen-aggro-gauntlet" />
          <g className="frozen-aggro-front-details">
            <path d="M125 84h11" className="frozen-aggro-eye-line frozen-aggro-eyes" />
            <path d="M103 84h11" className="frozen-aggro-eye-line frozen-aggro-eyes" />
            <path d="M130 73 119 106h22l-11-33Z" className="frozen-aggro-face-rune" />
            <path d="M130 102 121 190h18l-9-88Z" className="frozen-aggro-rune-blade" />
            <path d="M117 190h26l7 12-20 15-20-15 7-12Z" className="frozen-aggro-blade-hilt" />
            <path d="M93 151 111 182M167 151 149 182M105 220h50M99 248h62" className="frozen-aggro-armor-line" />
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
