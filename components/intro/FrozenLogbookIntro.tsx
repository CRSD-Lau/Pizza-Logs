"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const INTRO_DURATION_MS = 5200;
const REDUCED_MOTION_DURATION_MS = 350;

const INTRO_VIDEO_WEBM = "/intro/pizza-logs-cinematic-intro.webm";
const INTRO_VIDEO_MP4 = "/intro/pizza-logs-cinematic-intro.mp4";
const INTRO_VIDEO_MOBILE_WEBM = "/intro/pizza-logs-cinematic-intro-mobile.webm";
const INTRO_VIDEO_MOBILE_MP4 = "/intro/pizza-logs-cinematic-intro-mobile.mp4";
const INTRO_POSTER = "/intro/pizza-logs-cinematic-poster.jpg";
const INTRO_POSTER_MOBILE = "/intro/pizza-logs-cinematic-poster-mobile.jpg";
const MOBILE_VIDEO_MEDIA = "(max-width: 640px)";

export function FrozenLogbookIntro() {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [poster, setPoster] = useState(INTRO_POSTER);

  const finishIntro = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobileMedia = window.matchMedia(MOBILE_VIDEO_MEDIA);
    const syncPoster = () => {
      setPoster(mobileMedia.matches ? INTRO_POSTER_MOBILE : INTRO_POSTER);
    };
    const timeout = window.setTimeout(
      finishIntro,
      reduceMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS
    );

    setReducedMotion(reduceMotion);
    syncPoster();
    setVisible(true);

    mobileMedia.addEventListener("change", syncPoster);

    return () => {
      window.clearTimeout(timeout);
      mobileMedia.removeEventListener("change", syncPoster);
    };
  }, [finishIntro]);

  if (!visible) return null;

  return (
    <div className="frozen-intro-overlay" role="dialog" aria-label="Pizza Logs cinematic intro">
      {reducedMotion ? (
        <div
          className="frozen-intro-poster"
          style={{ backgroundImage: `url(${poster})` }}
          aria-hidden="true"
        />
      ) : (
        <video
          className="frozen-intro-video"
          autoPlay
          muted
          playsInline
          preload="auto"
          poster={poster}
          onEnded={finishIntro}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden="true"
        >
          <source media={MOBILE_VIDEO_MEDIA} src={INTRO_VIDEO_MOBILE_WEBM} type="video/webm" />
          <source media={MOBILE_VIDEO_MEDIA} src={INTRO_VIDEO_MOBILE_MP4} type="video/mp4" />
          <source src={INTRO_VIDEO_WEBM} type="video/webm" />
          <source src={INTRO_VIDEO_MP4} type="video/mp4" />
        </video>
      )}

      <div className="frozen-intro-vignette" aria-hidden="true" />

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
