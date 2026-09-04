"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArmoryCharacterAppearance } from "@/lib/warmane-armory";

const VIEWER_MESSAGE = "pizza-logs-warmane-model";

function buildWarmaneModelViewerDocument(appearance: ArmoryCharacterAppearance): string {
  const recipe = JSON.stringify(appearance).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://ajax.googleapis.com https://cdn.warmane.com; style-src 'unsafe-inline' https://cdn.warmane.com; img-src data: blob: https://cdn.warmane.com; connect-src https://cdn.warmane.com; font-src https://cdn.warmane.com">
  <style>
    html, body, #model { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
    #model canvas { display: block !important; width: 100% !important; height: 100% !important; }
    .model-progress { display: none !important; }
  </style>
</head>
<body>
  <div id="model" aria-hidden="true"></div>
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js"></script>
  <script src="https://cdn.warmane.com/wmmv/wmmv.js?v=1736749263"></script>
  <script>
    (() => {
      const appearance = ${recipe};
      const send = (status) => parent.postMessage({ type: "${VIEWER_MESSAGE}", status }, "*");

      try {
        const container = document.getElementById("model");
        const bounds = container.getBoundingClientRect();
        const viewer = new ModelViewer({
          type: ModelViewer.WOW,
          contentPath: "https://cdn.warmane.com/wmmv/",
          container: $("#model"),
          hd: true,
          // The viewer sets its own canvas height from this ratio. A fixed
          // ratio leaves unused space below the canvas in the taller portrait.
          aspect: bounds.width / bounds.height,
          sk: appearance.skin,
          ha: appearance.hairStyle,
          hc: appearance.hairColor,
          fa: appearance.face,
          fh: appearance.facialHair,
          fc: appearance.faceColor,
          ep: appearance.earPiercing,
          ho: appearance.hornStyle,
          ta: appearance.tattoo,
          cls: appearance.classId,
          items: appearance.items,
          models: {
            type: ModelViewer.Wow.Types.CHARACTER,
            id: appearance.modelId
          }
        });

        const renderer = viewer.renderer;
        if (renderer?.zoom && renderer.projMatrix?.length === 16) {
          // Leave room for helmets above the body bounds, then lower the view
          // by 5% of its height without moving or stretching the iframe.
          renderer.zoom.current = renderer.zoom.target = -1;
          renderer.projMatrix[9] = 0.1;
        }

        let attempts = 0;
        const verify = () => {
          attempts += 1;
          const canvas = document.querySelector("canvas");
          // Warmane renders into a WebGL-backed canvas, which cannot be sampled
          // reliably as a 2D canvas. Allow its model/assets time to settle, then
          // reveal it only when the correctly sized render surface is present.
          if (attempts >= 8 && canvas && canvas.width >= 80 && canvas.height >= 120) {
            send("ready");
            return;
          }

          if (attempts < 40) setTimeout(verify, 250);
          else send("failed");
        };

        setTimeout(verify, 500);
        void viewer;
      } catch {
        send("failed");
      }
    })();
  </script>
</body>
</html>`;
}

export function WarmaneCharacterModel({
  appearance,
  characterName,
}: {
  appearance: ArmoryCharacterAppearance;
  characterName: string;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  const document = useMemo(() => buildWarmaneModelViewerDocument(appearance), [appearance]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setReady(false);
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!event.data || event.data.type !== VIEWER_MESSAGE) return;
      setReady(event.data.status === "ready");
    };

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [document]);

  if (!isDesktop) return null;

  return (
    <iframe
      ref={frameRef}
      title={`${characterName} 3D character model`}
      srcDoc={document}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={`absolute inset-0 z-10 h-full w-full border-0 transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
