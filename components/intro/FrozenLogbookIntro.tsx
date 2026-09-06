"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { GuildCrest } from "@/components/brand/GuildCrest";
import { Button } from "@/components/ui/Button";

const DESKTOP_POSTER = "/animations/posters/desktop-poster.jpg";
const MOBILE_POSTER = "/animations/posters/mobile-poster.jpg";

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

function getPreferredVariant() {
  return INTRO_VARIANTS.find(variant => (
    !variant.media || window.matchMedia(variant.media).matches
  )) ?? INTRO_VARIANTS[INTRO_VARIANTS.length - 1];
}

export function FrozenLogbookIntro() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playDespiteReducedMotion, setPlayDespiteReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [variant, setVariant] = useState<IntroVariant>(INTRO_VARIANTS[INTRO_VARIANTS.length - 1]);
  const playVideo = (!reducedMotion || playDespiteReducedMotion) && !videoFailed;

  const finishIntro = useCallback(() => {
    videoRef.current?.pause();
    dialogRef.current?.close();
    setVisible(false);
    triggerRef.current?.focus();
  }, []);

  const openIntro = () => {
    setVariant(getPreferredVariant());
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPlayDespiteReducedMotion(false);
    setSoundEnabled(false);
    setPaused(false);
    setVideoFailed(false);
    setVisible(true);
  };

  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlayDespiteReducedMotion(false);
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [visible]);

  return (
    <>
      <Button ref={triggerRef} type="button" size="sm" variant="ghost" onClick={openIntro} aria-haspopup="dialog">
        <Play size={14} aria-hidden="true" /> Watch guild intro
      </Button>
      <dialog
        ref={dialogRef}
        className="frozen-intro-overlay frozen-intro-overlay--showing m-0 h-dvh max-h-none w-screen max-w-none border-0 p-0 motion-reduce:transition-none"
        style={{ minHeight: "100dvh" }}
        aria-label="Pizza Logs guild intro"
        onCancel={event => { event.preventDefault(); finishIntro(); }}
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => {
          if (dialogRef.current?.open) return;
          setVisible(false);
          triggerRef.current?.focus();
        }}
      >
      {visible && <>
        <div
          className="frozen-intro-poster"
          style={{ backgroundImage: `url(${variant.poster})` }}
          aria-hidden="true"
        />
      {playVideo && (
        <video
          ref={videoRef}
          className="frozen-intro-video"
          autoPlay
          muted={!soundEnabled}
          playsInline
          preload="metadata"
          poster={variant.poster}
          onEnded={finishIntro}
          onError={() => setVideoFailed(true)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden="true"
        >
          <source src={variant.webm} type="video/webm" />
          <source src={variant.mp4} type="video/mp4" />
        </video>
      )}

      <div className="frozen-intro-vignette" aria-hidden="true" />

      {playVideo && (
        <div className="absolute bottom-6 left-4 z-20 flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost"
          className="border-gold-dim bg-bg-deep/90 text-text-primary"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play().catch(() => setVideoFailed(true));
            else video.pause();
          }}>
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          {paused ? "Play" : "Pause"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-w-11 border-gold-dim bg-bg-deep/90 text-text-primary"
          onClick={() => setSoundEnabled(current => !current)}
          aria-label={soundEnabled ? "Mute intro audio" : "Play intro audio"}
          title={soundEnabled ? "Mute intro audio" : "Play intro audio"}
        >
          {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        </Button>
        </div>
      )}

      {!playVideo && (
        <div className="absolute inset-x-4 bottom-6 z-20 rounded-sm border border-gold-dim bg-bg-deep/95 p-4 text-center text-sm text-text-primary">
          <p>{videoFailed ? "The intro could not play. You can close this preview and keep browsing." : "A still preview is shown because reduced motion is enabled."}</p>
          {!videoFailed && <Button type="button" size="sm" className="mt-2" onClick={() => setPlayDespiteReducedMotion(true)}>Play video</Button>}
        </div>
      )}

      <Button
        ref={closeRef}
        type="button"
        size="sm"
        variant="ghost"
        className="frozen-intro-skip border-gold-dim bg-bg-deep/90 text-text-primary"
        onClick={finishIntro}
      >
        Close intro
      </Button>

      <div
        className="frozen-intro-brand"
        style={reducedMotion ? { transform: "translateX(-50%)" } : undefined}
        aria-hidden="true"
      >
        <div className="isolate mx-auto mb-4 w-fit rounded-full bg-bg-deep p-2 shadow-xl">
          <GuildCrest size={96} className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
        <span>Pizza Logs</span>
      </div>
      </>}
      </dialog>
    </>
  );
}
