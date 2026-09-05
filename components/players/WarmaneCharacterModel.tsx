"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ArmoryCharacterAppearance } from "@/lib/warmane-armory";

const VIEWER_MESSAGE = "pizza-logs-warmane-model";
const VIEWER_TIMEOUT_MS = 15_000;

export function buildWarmaneModelViewerDocument(appearance: ArmoryCharacterAppearance): string {
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
      const send = (status, reason) => parent.postMessage({ type: "${VIEWER_MESSAGE}", status, reason }, "*");

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

        // Warmane falls back to its retired Flash renderer when WebGL is
        // unavailable. That path cannot create a character canvas.
        if (viewer.mode === ModelViewer.FLASH) {
          send("failed", "webgl");
          return;
        }

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
          // A canvas alone does not mean that character geometry has loaded.
          // The viewer's public method returns null until its model exists.
          const modelLoaded = typeof viewer.method === "function" && viewer.method("isLoaded") === true;
          if (attempts >= 8 && canvas && canvas.width >= 80 && canvas.height >= 120 && modelLoaded) {
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
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const document = useMemo(() => buildWarmaneModelViewerDocument(appearance), [appearance]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    if (!isDesktop) return;
    setStatus("loading");
    setFailureReason(null);
    // A blocked script or an unavailable renderer may never send a message.
    const timeout = window.setTimeout(() => setStatus("failed"), VIEWER_TIMEOUT_MS);
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!event.data || event.data.type !== VIEWER_MESSAGE) return;
      if (event.data.status !== "ready" && event.data.status !== "failed") return;
      window.clearTimeout(timeout);
      setStatus(event.data.status);
      setFailureReason(event.data.reason === "webgl" ? "This browser cannot display 3D models." : null);
    };

    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [document, isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      {status !== "ready" && (
        <div role="status" className="absolute inset-x-2 top-3 z-20 rounded-xs bg-bg-deep/90 px-2 py-1.5 text-center text-[11px] text-text-secondary">
          <p>{status === "loading" ? "Loading 3D model…" : "3D model unavailable"}</p>
          {status === "failed" && failureReason && <p className="mt-1">{failureReason}</p>}
        </div>
      )}
      <iframe
        key={document}
        ref={frameRef}
        title={`${characterName} 3D character model`}
        srcDoc={document}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className={`absolute inset-0 z-10 h-full w-full border-0 transition-opacity duration-300 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}
