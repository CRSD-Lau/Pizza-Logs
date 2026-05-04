"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const FROZEN_INTRO_STORAGE_KEY = "pizzaLogsFrozenIntroSeen";
export const INTRO_REPLAY_PARAM = "intro";
export const INTRO_DURATION_MS = 2300;

const PARTICLES = [
  { left: 7, top: 22, delay: 0, duration: 6 },
  { left: 14, top: 72, delay: 0.4, duration: 7 },
  { left: 23, top: 34, delay: 0.9, duration: 6.5 },
  { left: 31, top: 62, delay: 0.2, duration: 7.5 },
  { left: 42, top: 18, delay: 1.1, duration: 6 },
  { left: 50, top: 80, delay: 0.7, duration: 8 },
  { left: 58, top: 42, delay: 0.1, duration: 6.8 },
  { left: 66, top: 28, delay: 0.8, duration: 7.2 },
  { left: 73, top: 76, delay: 0.3, duration: 6.4 },
  { left: 82, top: 50, delay: 1.2, duration: 7.8 },
  { left: 89, top: 20, delay: 0.6, duration: 6.6 },
  { left: 94, top: 68, delay: 1.4, duration: 7 },
] as const;

type ParticleStyle = CSSProperties & {
  "--particle-left": string;
  "--particle-top": string;
  "--particle-delay": string;
  "--particle-duration": string;
};

function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(FROZEN_INTRO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function shouldReplayIntro(): boolean {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(INTRO_REPLAY_PARAM) === "1";
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(FROZEN_INTRO_STORAGE_KEY, "1");
  } catch {
    // Local storage can be disabled; the overlay still unmounts for this page load.
  }
}

export function FrozenLogbookIntro() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const finishIntro = useCallback(() => {
    markIntroSeen();
    setVisible(false);
  }, []);

  useEffect(() => {
    if (hasSeenIntro() && !shouldReplayIntro()) {
      setReady(true);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(finishIntro, reduceMotion ? 350 : INTRO_DURATION_MS);

    setVisible(true);
    setReady(true);

    return () => window.clearTimeout(timeout);
  }, [finishIntro]);

  if (!ready || !visible) return null;

  return (
    <div className="frozen-intro-overlay" role="dialog" aria-label="Pizza Logs intro">
      <div className="frozen-intro-particles" aria-hidden="true">
        {PARTICLES.map((particle, index) => (
          <span
            key={`${particle.left}-${particle.top}-${index}`}
            className="frozen-intro-particle"
            style={{
              "--particle-left": `${particle.left}%`,
              "--particle-top": `${particle.top}%`,
              "--particle-delay": `${particle.delay}s`,
              "--particle-duration": `${particle.duration}s`,
            } as ParticleStyle}
          />
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="frozen-intro-skip border-gold-dim bg-bg-card/80 text-text-primary hover:border-gold/50 hover:text-gold-light"
        onClick={finishIntro}
      >
        Skip
      </Button>

      <div className="frozen-intro-content">
        <div className="frozen-intro-mark" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-school-frost/80">
          Frozen Logbook
        </p>
        <h1 className="heading-cinzel text-3xl sm:text-5xl font-bold text-gold-light text-glow-gold">
          Pizza Logs
        </h1>
        <p className="text-sm sm:text-base text-text-secondary">
          Raid data, forged from combat logs.
        </p>
      </div>
    </div>
  );
}
