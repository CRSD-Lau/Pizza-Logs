"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const INTRO_DURATION_MS = 6400;
const REDUCED_MOTION_DURATION_MS = 350;

const INTRO_VIDEO_1080_WEBM = "/intro/pizza-logs-cinematic-intro-1080p.webm";
const INTRO_VIDEO_1080_MP4 = "/intro/pizza-logs-cinematic-intro-1080p.mp4";
const INTRO_VIDEO_1440_WEBM = "/intro/pizza-logs-cinematic-intro.webm";
const INTRO_VIDEO_1440_MP4 = "/intro/pizza-logs-cinematic-intro.mp4";
const INTRO_VIDEO_4K_WEBM = "/intro/pizza-logs-cinematic-intro-4k.webm";
const INTRO_VIDEO_4K_MP4 = "/intro/pizza-logs-cinematic-intro-4k.mp4";
const INTRO_VIDEO_MOBILE_WEBM = "/intro/pizza-logs-cinematic-intro-mobile.webm";
const INTRO_VIDEO_MOBILE_MP4 = "/intro/pizza-logs-cinematic-intro-mobile.mp4";
const INTRO_VIDEO_MOBILE_4K_WEBM = "/intro/pizza-logs-cinematic-intro-mobile-4k.webm";
const INTRO_VIDEO_MOBILE_4K_MP4 = "/intro/pizza-logs-cinematic-intro-mobile-4k.mp4";
const INTRO_POSTER_1080 = "/intro/pizza-logs-cinematic-poster-1080p.jpg";
const INTRO_POSTER_1440 = "/intro/pizza-logs-cinematic-poster.jpg";
const INTRO_POSTER_4K = "/intro/pizza-logs-cinematic-poster-4k.jpg";
const INTRO_POSTER_MOBILE = "/intro/pizza-logs-cinematic-poster-mobile.jpg";
const INTRO_POSTER_MOBILE_4K = "/intro/pizza-logs-cinematic-poster-mobile-4k.jpg";
const MOBILE_4K_VIDEO_MEDIA = "(max-width: 640px) and (min-resolution: 2.5dppx)";
const MOBILE_VIDEO_MEDIA = "(max-width: 640px)";
const DESKTOP_4K_VIDEO_MEDIA =
  "(min-width: 3200px), (min-width: 2400px) and (min-resolution: 1.5dppx), (min-width: 1920px) and (min-resolution: 2dppx)";
const DESKTOP_1440_VIDEO_MEDIA = "(min-width: 2200px), (min-width: 1280px) and (min-resolution: 1.5dppx)";

type IntroVideoSource = {
  media?: string;
  src: string;
  type: "video/mp4" | "video/webm";
};

type IntroPosterSource = {
  media?: string;
  src: string;
};

const VIDEO_SOURCES: IntroVideoSource[] = [
  { media: MOBILE_4K_VIDEO_MEDIA, src: INTRO_VIDEO_MOBILE_4K_WEBM, type: "video/webm" },
  { media: MOBILE_VIDEO_MEDIA, src: INTRO_VIDEO_MOBILE_WEBM, type: "video/webm" },
  { media: DESKTOP_4K_VIDEO_MEDIA, src: INTRO_VIDEO_4K_WEBM, type: "video/webm" },
  { media: DESKTOP_1440_VIDEO_MEDIA, src: INTRO_VIDEO_1440_WEBM, type: "video/webm" },
  { src: INTRO_VIDEO_1080_WEBM, type: "video/webm" },
  { media: MOBILE_4K_VIDEO_MEDIA, src: INTRO_VIDEO_MOBILE_4K_MP4, type: "video/mp4" },
  { media: MOBILE_VIDEO_MEDIA, src: INTRO_VIDEO_MOBILE_MP4, type: "video/mp4" },
  { media: DESKTOP_4K_VIDEO_MEDIA, src: INTRO_VIDEO_4K_MP4, type: "video/mp4" },
  { media: DESKTOP_1440_VIDEO_MEDIA, src: INTRO_VIDEO_1440_MP4, type: "video/mp4" },
  { src: INTRO_VIDEO_1080_MP4, type: "video/mp4" },
];

const POSTER_SOURCES: IntroPosterSource[] = [
  { media: MOBILE_4K_VIDEO_MEDIA, src: INTRO_POSTER_MOBILE_4K },
  { media: MOBILE_VIDEO_MEDIA, src: INTRO_POSTER_MOBILE },
  { media: DESKTOP_4K_VIDEO_MEDIA, src: INTRO_POSTER_4K },
  { media: DESKTOP_1440_VIDEO_MEDIA, src: INTRO_POSTER_1440 },
  { src: INTRO_POSTER_1080 },
];

function getPreferredPoster() {
  return POSTER_SOURCES.find(source => (
    !source.media || window.matchMedia(source.media).matches
  ))?.src ?? INTRO_POSTER_1440;
}

export function FrozenLogbookIntro() {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [poster, setPoster] = useState(INTRO_POSTER_1440);

  const finishIntro = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const posterMedia = POSTER_SOURCES
      .filter((source): source is IntroPosterSource & { media: string } => Boolean(source.media))
      .map(source => window.matchMedia(source.media));
    const syncPoster = () => {
      setPoster(getPreferredPoster());
    };
    const timeout = window.setTimeout(
      finishIntro,
      reduceMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS
    );

    setReducedMotion(reduceMotion);
    syncPoster();
    setVisible(true);

    posterMedia.forEach(media => media.addEventListener("change", syncPoster));

    return () => {
      window.clearTimeout(timeout);
      posterMedia.forEach(media => media.removeEventListener("change", syncPoster));
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
          {VIDEO_SOURCES.map(source => (
            <source
              key={`${source.type}-${source.src}`}
              media={source.media}
              src={source.src}
              type={source.type}
            />
          ))}
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
