"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

export const INTRO_DURATION_MS = 8400;
const INTRO_EXIT_MS = 650;
const REDUCED_MOTION_DURATION_MS = 350;
const DESKTOP_POSTER = "/animations/posters/desktop-poster.jpg";
const MOBILE_POSTER = "/animations/posters/mobile-poster.jpg";
const INTRO_SESSION_KEY = "pizza-logs-intro-seen";

type IntroVariant = {
  id: string;
  media?: string;
  webm: string;
  mp4: string;
  poster: string;
};

const INTRO_VARIANTS: IntroVariant[] = [
  {
    id: "mobile-1440",
    media: "(max-width: 640px) and (min-resolution: 2.5dppx)",
    webm: "/animations/mobile/intro-mobile-1440x2560.webm",
    mp4: "/animations/mobile/intro-mobile-1440x2560.mp4",
    poster: MOBILE_POSTER,
  },
  {
    id: "mobile-1080",
    media: "(max-width: 640px) and (min-resolution: 1.5dppx)",
    webm: "/animations/mobile/intro-mobile-1080x1920.webm",
    mp4: "/animations/mobile/intro-mobile-1080x1920.mp4",
    poster: MOBILE_POSTER,
  },
  {
    id: "mobile-720",
    media: "(max-width: 640px)",
    webm: "/animations/mobile/intro-mobile-720x1280.webm",
    mp4: "/animations/mobile/intro-mobile-720x1280.mp4",
    poster: MOBILE_POSTER,
  },
  {
    id: "desktop-4k",
    media:
      "(min-width: 3200px), (min-width: 2400px) and (min-resolution: 1.5dppx), (min-width: 1920px) and (min-resolution: 2dppx)",
    webm: "/animations/desktop/intro-4k.webm",
    mp4: "/animations/desktop/intro-4k.mp4",
    poster: DESKTOP_POSTER,
  },
  {
    id: "desktop-1440",
    media: "(min-width: 2200px), (min-width: 1280px) and (min-resolution: 1.5dppx)",
    webm: "/animations/desktop/intro-1440p.webm",
    mp4: "/animations/desktop/intro-1440p.mp4",
    poster: DESKTOP_POSTER,
  },
  {
    id: "desktop-1080",
    webm: "/animations/desktop/intro-1080p.webm",
    mp4: "/animations/desktop/intro-1080p.mp4",
    poster: DESKTOP_POSTER,
  },
];

type IntroPhase = "hidden" | "showing" | "leaving";

function getPreferredVariant() {
  return INTRO_VARIANTS.find(variant => (
    !variant.media || window.matchMedia(variant.media).matches
  )) ?? INTRO_VARIANTS[INTRO_VARIANTS.length - 1];
}

function canPreferWebM() {
  const video = document.createElement("video");
  return video.canPlayType("video/webm; codecs=vp9") !== "";
}

export function FrozenLogbookIntro() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<IntroPhase>("hidden");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [variant, setVariant] = useState<IntroVariant>(INTRO_VARIANTS[INTRO_VARIANTS.length - 1]);
  const [preferWebM, setPreferWebM] = useState(true);

  const visible = phase !== "hidden";
  const className = phase === "showing"
    ? "frozen-intro-overlay frozen-intro-overlay--showing"
    : "frozen-intro-overlay frozen-intro-overlay--leaving";

  const finishIntro = useCallback(() => {
    setPhase(current => current === "hidden" ? current : "leaving");
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    const video = videoRef.current;

    setSoundEnabled(next);

    if (video) {
      video.muted = !next;
      if (next) {
        void video.play().catch(() => {
          video.muted = true;
          setSoundEnabled(false);
        });
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (pathname !== "/" || window.sessionStorage.getItem(INTRO_SESSION_KEY)) {
      setPhase("hidden");
      return;
    }

    window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const variantMedia = INTRO_VARIANTS
      .filter((source): source is IntroVariant & { media: string } => Boolean(source.media))
      .map(source => window.matchMedia(source.media));
    const syncVariant = () => setVariant(getPreferredVariant());

    setReducedMotion(reduceMotion);
    setPreferWebM(canPreferWebM());
    syncVariant();
    setPhase("showing");

    const timeout = window.setTimeout(
      finishIntro,
      reduceMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS
    );

    variantMedia.forEach(media => media.addEventListener("change", syncVariant));

    return () => {
      window.clearTimeout(timeout);
      variantMedia.forEach(media => media.removeEventListener("change", syncVariant));
    };
  }, [finishIntro, pathname]);

  useEffect(() => {
    if (phase !== "leaving") return;

    const timeout = window.setTimeout(() => setPhase("hidden"), INTRO_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (!visible || reducedMotion) return;

    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "video";
    preload.href = preferWebM ? variant.webm : variant.mp4;
    preload.type = preferWebM ? "video/webm" : "video/mp4";
    document.head.appendChild(preload);

    return () => {
      preload.remove();
    };
  }, [preferWebM, reducedMotion, variant, visible]);

  if (!visible) return null;

  return (
    <div className={className} role="dialog" aria-label="Pizza Logs cinematic intro">
      {reducedMotion ? (
        <div
          className="frozen-intro-poster"
          style={{ backgroundImage: `url(${variant.poster})` }}
          aria-hidden="true"
        />
      ) : (
        <video
          ref={videoRef}
          className="frozen-intro-video"
          autoPlay
          muted={!soundEnabled}
          playsInline
          preload="auto"
          poster={variant.poster}
          onEnded={finishIntro}
          onError={finishIntro}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden="true"
        >
          <source src={variant.webm} type="video/webm" />
          <source src={variant.mp4} type="video/mp4" />
        </video>
      )}

      <div className="frozen-intro-vignette" aria-hidden="true" />

      {!reducedMotion && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="frozen-intro-sound border-white/15 bg-black/45 text-white/80 backdrop-blur-md hover:border-school-frost/45 hover:text-white"
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute intro audio" : "Play intro audio"}
          title={soundEnabled ? "Mute intro audio" : "Play intro audio"}
        >
          {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        </Button>
      )}

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="frozen-intro-skip border-white/15 bg-black/45 text-white/80 backdrop-blur-md hover:border-school-frost/45 hover:text-white"
        onClick={finishIntro}
      >
        Skip
      </Button>

      <div className="frozen-intro-brand" aria-hidden="true">
        <span>Pizza Logs</span>
      </div>
    </div>
  );
}
