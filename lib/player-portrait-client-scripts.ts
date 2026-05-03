import { PIZZA_LOGS_ORIGIN } from "./armory-gear-client-scripts";

export const PORTRAIT_USERSCRIPT_PATH = "/api/player-portraits/userscript.user.js";
export const PORTRAIT_USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${PORTRAIT_USERSCRIPT_PATH}`;

declare const GM_xmlhttpRequest: (details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  onload: (response: { status: number; responseText?: string }) => void;
  onerror: () => void;
  ontimeout: () => void;
}) => void;
declare const GM_getValue: <T = unknown>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: unknown) => void;

export function buildPlayerPortraitUserscript(): string {
  const script = function pizzaLogsWarmanePortraits() {
    const cacheKey = "pizzaLogsWarmanePortraitCacheV3";
    const targetKey = "pizzaLogsWarmanePortraitTarget";
    const disabledKey = "pizzaLogsWarmanePortraitsDisabled";
    const cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
    const targetTtlMs = 5 * 60 * 1000;
    const minCanvasDataUrlLength = 6000;
    const warmaneOrigin = "https://armory.warmane.com";
    const portraitHints = /(avatar|character|model|portrait|profile|render|thumbnail)/i;
    const nonPortraitUrl = /(?:\/icons\/|\/item(?:[/?=]|$)|cavernoftime|achievement_|ability_|classicon_|inv_|spell_|trade_)/i;
    const classIconSlugs: Record<string, string> = {
      "death knight": "classicon_deathknight",
      deathknight: "classicon_deathknight",
      druid: "classicon_druid",
      hunter: "classicon_hunter",
      mage: "classicon_mage",
      paladin: "classicon_paladin",
      priest: "classicon_priest",
      rogue: "classicon_rogue",
      shaman: "classicon_shaman",
      warlock: "classicon_warlock",
      warrior: "classicon_warrior",
    };
    const wowClasses = [
      "Death Knight",
      "Druid",
      "Hunter",
      "Mage",
      "Paladin",
      "Priest",
      "Rogue",
      "Shaman",
      "Warlock",
      "Warrior",
    ];
    const knownRealms = ["Lordaeron", "Icecrown", "Blackrock", "Frostmourne", "Frostwolf", "Outland", "Onyxia"];

    const isDisabled = function isDisabled() {
      try {
        return localStorage.getItem(disabledKey) === "1";
      } catch {
        return false;
      }
    };

    if (isDisabled()) return;

    const readCache = function readCache() {
      try {
        if (typeof GM_getValue === "function") {
          const stored = GM_getValue<string>(cacheKey, "");
          if (stored) return JSON.parse(stored);
        }
      } catch {
        // Tampermonkey storage is best-effort; fall back to page localStorage.
      }

      try {
        return JSON.parse(localStorage.getItem(cacheKey) || "{}");
      } catch {
        return {};
      }
    };

    const writeCache = function writeCache(cache: Record<string, { url: string | null; fetchedAt: number }>) {
      const serialized = JSON.stringify(cache);
      try {
        if (typeof GM_setValue === "function") GM_setValue(cacheKey, serialized);
      } catch {
        // Ignore GM storage failures and still try localStorage below.
      }

      try {
        localStorage.setItem(cacheKey, serialized);
      } catch {
        // LocalStorage can be full or unavailable; the script still works without caching.
      }
    };

    const cachePortrait = function cachePortrait(name: string, realm: string, url: string | null) {
      const cache = readCache();
      const key = `${realm.toLowerCase()}:${name.toLowerCase()}`;
      cache[key] = { url, fetchedAt: Date.now() };
      writeCache(cache);
    };

    const writeRecentWarmaneTarget = function writeRecentWarmaneTarget(identity: { name: string; realm: string }) {
      const serialized = JSON.stringify({ ...identity, writtenAt: Date.now() });
      try {
        if (typeof GM_setValue === "function") GM_setValue(targetKey, serialized);
      } catch {
        // Ignore GM storage failures and still try localStorage below.
      }

      try {
        localStorage.setItem(targetKey, serialized);
      } catch {
        // Target handoff is an optimization for modelviewer frames.
      }
    };

    const readRecentWarmaneTarget = function readRecentWarmaneTarget() {
      let raw = "";
      try {
        if (typeof GM_getValue === "function") raw = GM_getValue<string>(targetKey, "");
      } catch {
        raw = "";
      }

      if (!raw) {
        try {
          raw = localStorage.getItem(targetKey) || "";
        } catch {
          raw = "";
        }
      }

      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as { name?: unknown; realm?: unknown; writtenAt?: unknown };
        if (typeof parsed.name !== "string" || typeof parsed.realm !== "string") return null;
        if (typeof parsed.writtenAt !== "number" || Date.now() - parsed.writtenAt > targetTtlMs) return null;
        return { name: parsed.name, realm: parsed.realm };
      } catch {
        return null;
      }
    };

    const normalizeUrl = function normalizeUrl(value: string | null | undefined, baseUrl: string) {
      if (!value) return null;
      const raw = String(value).trim();
      if (!raw || raw.startsWith("data:")) return null;

      try {
        const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw, baseUrl);
        if (!/^https?:$/.test(parsed.protocol)) return null;
        if (!/(^|\.)warmane\.com$|(^|\.)zamimg\.com$|(^|\.)wowhead\.com$/i.test(parsed.hostname)) return null;
        if (nonPortraitUrl.test(parsed.pathname)) return null;
        return parsed.toString();
      } catch {
        return null;
      }
    };

    const hintedElement = function hintedElement(element: Element) {
      const hint = [
        element.getAttribute("class"),
        element.getAttribute("id"),
        element.getAttribute("alt"),
        element.getAttribute("title"),
        element.getAttribute("src"),
        element.getAttribute("data-src"),
        element.getAttribute("style"),
      ].filter(Boolean).join(" ");
      return portraitHints.test(hint);
    };

    const findPortraitUrl = function findPortraitUrl(html: string, baseUrl: string) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates: Array<{ url: string; priority: number }> = [];
      const meta = doc.querySelector("meta[property='og:image'],meta[name='twitter:image'],meta[itemprop='image']");
      const metaUrl = normalizeUrl(meta?.getAttribute("content"), baseUrl);
      if (metaUrl) candidates.push({ url: metaUrl, priority: 30 });

      doc.querySelectorAll("img").forEach((image) => {
        if (!hintedElement(image)) return;
        const url = normalizeUrl(
          image.getAttribute("src") || image.getAttribute("data-src") || image.getAttribute("data-original"),
          baseUrl,
        );
        if (url) candidates.push({ url, priority: 10 });
      });

      doc.querySelectorAll("[style*='background']").forEach((element) => {
        if (!hintedElement(element)) return;
        const style = element.getAttribute("style") || "";
        const match = style.match(/background(?:-image)?\s*:[^;]*url\(([^)]+)\)/i);
        const raw = match?.[1]?.trim().replace(/^["']|["']$/g, "");
        const url = normalizeUrl(raw, baseUrl);
        if (url) candidates.push({ url, priority: 20 });
      });

      const scriptMatch = html.match(/["'](?:avatar|character|model|portrait|profile|render)(?:Url|Image|Src)?["']\s*:\s*["']([^"']+)["']/i);
      const scriptUrl = normalizeUrl(scriptMatch?.[1], baseUrl);
      if (scriptUrl) candidates.push({ url: scriptUrl, priority: 40 });

      candidates.sort((a, b) => a.priority - b.priority);
      return candidates[0]?.url || null;
    };

    const requestText = function requestText(url: string) {
      return new Promise<string>((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          headers: { Accept: "text/html,*/*" },
          onload: (response) => {
            if (response.status < 200 || response.status >= 300) {
              reject(new Error(`Warmane HTTP ${response.status}`));
              return;
            }
            resolve(response.responseText || "");
          },
          onerror: () => reject(new Error("Warmane request failed")),
          ontimeout: () => reject(new Error("Warmane request timed out")),
          timeout: 12000,
        });
      });
    };

    const buildWarmaneUrl = function buildWarmaneUrl(name: string, realm: string) {
      return `${warmaneOrigin}/character/${encodeURIComponent(name)}/${encodeURIComponent(realm || "Lordaeron")}/summary`;
    };

    const warmaneIdentityFromUrl = function warmaneIdentityFromUrl(value: string) {
      let parsed: URL;
      try {
        parsed = new URL(value, location.href);
      } catch {
        return null;
      }

      if (parsed.hostname !== "armory.warmane.com") return null;

      const match = parsed.pathname.match(/^\/character\/([^/]+)\/([^/]+)(?:\/(?:summary|profile))?\/?$/i);
      if (!match) return null;
      return {
        name: decodeURIComponent(match[1]),
        realm: decodeURIComponent(match[2] || "Lordaeron"),
      };
    };

    const warmanePageIdentity = function warmanePageIdentity() {
      return warmaneIdentityFromUrl(location.href);
    };

    const warmaneReferrerIdentity = function warmaneReferrerIdentity() {
      return warmaneIdentityFromUrl(document.referrer || "");
    };

    const canvasHasVisibleContent = function canvasHasVisibleContent(canvas: HTMLCanvasElement) {
      try {
        const width = Math.min(canvas.width, 96);
        const height = Math.min(canvas.height, 96);
        if (width <= 0 || height <= 0) return false;

        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = width;
        sampleCanvas.height = height;
        const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (!context) return false;

        context.drawImage(canvas, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let opaquePixels = 0;
        let brightPixels = 0;
        const totalPixels = width * height;

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          if (alpha < 24) continue;

          opaquePixels += 1;
          const maxChannel = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
          if (maxChannel > 35) brightPixels += 1;
        }

        return opaquePixels > totalPixels * 0.05 && brightPixels > totalPixels * 0.015;
      } catch {
        return false;
      }
    };

    const captureRenderedCanvas = function captureRenderedCanvas() {
      const canvases = (Array.from(document.querySelectorAll("canvas")) as HTMLCanvasElement[])
        .filter(canvas => canvas.width >= 64 && canvas.height >= 64)
        .sort((a, b) => (b.width * b.height) - (a.width * a.height));

      for (const canvas of canvases) {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          if (!dataUrl || dataUrl.length < minCanvasDataUrlLength) continue;
          if (canvasHasVisibleContent(canvas) === false) continue;
          return dataUrl;
        } catch {
          // Warmane may render with cross-origin textures, which taints the canvas.
        }
      }

      return null;
    };

    const capturePortraitForIdentity = function capturePortraitForIdentity(
      identity: { name: string; realm: string } | null,
      attempt = 0,
    ) {
      if (!identity) return;

      const html = document.documentElement?.outerHTML || "";
      const staticPortrait = findPortraitUrl(html, location.href);
      const portraitUrl = staticPortrait || captureRenderedCanvas();
      if (portraitUrl) {
        cachePortrait(identity.name, identity.realm, portraitUrl);
        return;
      }

      if (attempt < 8) {
        setTimeout(() => capturePortraitForIdentity(identity, attempt + 1), 750);
      }
    };

    const captureWarmanePagePortrait = function captureWarmanePagePortrait() {
      const identity = warmanePageIdentity();
      if (identity) writeRecentWarmaneTarget(identity);
      capturePortraitForIdentity(identity);
    };

    const captureModelViewerFramePortrait = function captureModelViewerFramePortrait() {
      capturePortraitForIdentity(warmaneReferrerIdentity() || readRecentWarmaneTarget());
    };

    const classIconUrl = function classIconUrl(className: string | undefined) {
      const key = className?.trim().toLowerCase();
      if (!key) return "";
      const slug = classIconSlugs[key] || classIconSlugs[key.replace(/\s+/g, "")];
      return slug ? `https://wow.zamimg.com/images/wow/icons/large/${slug}.jpg` : "";
    };

    const setupAvatarDataset = function setupAvatarDataset(
      avatar: HTMLElement,
      name: string,
      realm: string,
      className: string,
      raceName = "",
    ) {
      const initials = (avatar.dataset.initials || avatar.textContent || name).trim().slice(0, 2).toUpperCase();
      avatar.dataset.pizzaAvatar = "character";
      avatar.dataset.characterName = name;
      avatar.dataset.characterRealm = realm || "Lordaeron";
      avatar.dataset.characterClass = className || avatar.dataset.characterClass || "";
      avatar.dataset.characterRace = raceName || avatar.dataset.characterRace || "";
      avatar.dataset.initials = initials;
      avatar.dataset.fallbackIconUrl = avatar.dataset.fallbackIconUrl || classIconUrl(className);
      avatar.setAttribute("data-pizza-avatar", "character");
    };

    const extractKnownClass = function extractKnownClass(text: string) {
      const lower = text.toLowerCase();
      return wowClasses.find((className) => lower.includes(className.toLowerCase())) || "";
    };

    const extractKnownRealm = function extractKnownRealm(text: string) {
      const lower = text.toLowerCase();
      return knownRealms.find((realm) => lower.includes(realm.toLowerCase())) || "Lordaeron";
    };

    const isInitialsBox = function isInitialsBox(element: HTMLElement, characterName: string) {
      const text = (element.textContent || "").trim().toUpperCase();
      const expected = characterName.trim().slice(0, 2).toUpperCase();
      if (text !== expected) return false;
      if (element.querySelector("a,img,button,svg")) return false;
      const className = element.getAttribute("class") || "";
      return /(?:avatar|rounded|w-\d+|h-\d+|flex)/i.test(className);
    };

    const discoverLegacyPlayerHeaderAvatars = function discoverLegacyPlayerHeaderAvatars() {
      const match = location.pathname.match(/^\/players\/([^/?#]+)/i);
      if (!match) return [] as HTMLElement[];

      const name = decodeURIComponent(match[1]);
      const headings = Array.from(document.querySelectorAll("h1")) as HTMLElement[];
      const heading = headings.find((candidate) => (candidate.textContent || "").trim().toLowerCase() === name.toLowerCase());
      const header = heading?.parentElement?.parentElement;
      if (!header) return [] as HTMLElement[];

      const metaText = header.textContent || "";
      const className = extractKnownClass(metaText);
      const realm = extractKnownRealm(metaText);
      const avatar = (Array.from(header.children) as HTMLElement[]).find((candidate) => isInitialsBox(candidate, name));
      if (!avatar) return [] as HTMLElement[];

      setupAvatarDataset(avatar, name, realm, className);
      return [avatar];
    };

    const discoverLegacyPlayerCardAvatars = function discoverLegacyPlayerCardAvatars() {
      const avatars: HTMLElement[] = [];
      const links = Array.from(document.querySelectorAll("a[href*='/players/']")) as HTMLAnchorElement[];
      links.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const match = href.match(/\/players\/([^/?#]+)/i);
        if (!match) return;
        const name = decodeURIComponent(match[1]);
        const avatar = (Array.from(link.children) as HTMLElement[]).find((candidate) => isInitialsBox(candidate, name));
        if (!avatar) return;

        const text = link.textContent || "";
        setupAvatarDataset(avatar, name, extractKnownRealm(text), extractKnownClass(text));
        avatars.push(avatar);
      });
      return avatars;
    };

    const discoverAvatarElements = function discoverAvatarElements() {
      const dataAvatars = Array.from(document.querySelectorAll("[data-pizza-avatar='character']")) as HTMLElement[];
      dataAvatars.forEach((avatar) => {
        const className = avatar.dataset.characterClass || "";
        avatar.dataset.fallbackIconUrl = avatar.dataset.fallbackIconUrl || classIconUrl(className);
      });

      return [
        ...dataAvatars,
        ...discoverLegacyPlayerHeaderAvatars(),
        ...discoverLegacyPlayerCardAvatars(),
      ];
    };

    const replaceAvatar = function replaceAvatar(avatar: HTMLElement, portraitUrl: string) {
      const initials = avatar.dataset.initials || avatar.textContent?.trim() || "";
      const renderInitials = function renderInitials() {
        avatar.innerHTML = "";
        const span = document.createElement("span");
        span.dataset.pizzaAvatarInitials = "true";
        span.textContent = initials;
        avatar.appendChild(span);
        avatar.dataset.pizzaAvatarState = "initials";
      };
      avatar.innerHTML = "";

      const image = document.createElement("img");
      image.dataset.pizzaPortraitImage = "true";
      image.alt = `${avatar.dataset.characterName || "Character"} portrait`;
      image.src = portraitUrl;
      image.referrerPolicy = "no-referrer";
      image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
      image.onerror = () => {
        avatar.innerHTML = "";
        const fallbackIconUrl = avatar.dataset.fallbackIconUrl;
        if (fallbackIconUrl && fallbackIconUrl !== portraitUrl) {
          const fallback = document.createElement("img");
          fallback.alt = `${avatar.dataset.characterName || "Character"} class icon`;
          fallback.src = fallbackIconUrl;
          fallback.referrerPolicy = "no-referrer";
          fallback.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
          fallback.onerror = () => {
            renderInitials();
          };
          avatar.appendChild(fallback);
          avatar.dataset.pizzaAvatarState = "fallback-icon";
          return;
        }

        renderInitials();
      };
      avatar.appendChild(image);
      avatar.dataset.pizzaAvatarState = "portrait";
    };

    const processAvatar = async function processAvatar(avatar: HTMLElement) {
      const name = avatar.dataset.characterName;
      const realm = avatar.dataset.characterRealm || "Lordaeron";
      if (!name) return;

      const cache = readCache();
      const key = `${realm.toLowerCase()}:${name.toLowerCase()}`;
      const cached = cache[key];
      if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
        if (cached.url) replaceAvatar(avatar, cached.url);
        return;
      }

      const warmaneUrl = buildWarmaneUrl(name, realm);
      try {
        const html = await requestText(warmaneUrl);
        const portraitUrl = findPortraitUrl(html, warmaneUrl);
        cache[key] = { url: portraitUrl, fetchedAt: Date.now() };
        writeCache(cache);
        if (portraitUrl) replaceAvatar(avatar, portraitUrl);
      } catch (error) {
        console.warn("Pizza Logs Warmane portrait lookup failed", { name, realm, error });
      }
    };

    const run = function run() {
      discoverAvatarElements().forEach((element) => {
        if (!element.dataset) return;
        if (element.dataset.pizzaPortraitQueued === "1") return;
        element.dataset.pizzaPortraitQueued = "1";
        setTimeout(() => { void processAvatar(element); }, 0);
      });
    };

    const runWarmaneCapture = function runWarmaneCapture() {
      captureWarmanePagePortrait();
    };

    const isWarmaneCharacterPage = function isWarmaneCharacterPage() {
      return location.hostname === "armory.warmane.com" && Boolean(warmanePageIdentity());
    };

    const isWowheadModelViewerFrame = function isWowheadModelViewerFrame() {
      const hostname = location.hostname.toLowerCase();
      const pathname = location.pathname.toLowerCase();
      const isWowhead = hostname === "wowhead.com" || hostname.endsWith(".wowhead.com");
      const isZamimg = hostname === "wow.zamimg.com";
      return (isWowhead || isZamimg) && pathname.includes("modelviewer") && Boolean(warmaneReferrerIdentity() || readRecentWarmaneTarget());
    };

    if (isWarmaneCharacterPage()) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runWarmaneCapture, { once: true });
      } else {
        runWarmaneCapture();
      }
      return;
    }

    if (isWowheadModelViewerFrame()) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", captureModelViewerFramePortrait, { once: true });
      } else {
        captureModelViewerFramePortrait();
      }
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }

    // Set localStorage.pizzaLogsWarmanePortraitsDisabled = "1" to disable lookups.
  };

  return [
    "// ==UserScript==",
    "// @name         Pizza Logs Warmane Portraits",
    "// @namespace    https://pizza-logs-production.up.railway.app",
    "// @version      0.5.0",
    "// @description  Replaces Pizza Logs character initials with Warmane Armory portraits or cached rendered character faces when available.",
    "// @match        https://pizza-logs-production.up.railway.app/*",
    "// @match        http://localhost:3000/*",
    "// @match        http://127.0.0.1:3000/*",
    "// @match        https://armory.warmane.com/character/*",
    "// @match        http://armory.warmane.com/character/*",
    "// @match        https://www.wowhead.com/modelviewer*",
    "// @match        https://www.wowhead.com/wotlk/modelviewer*",
    "// @match        https://wowhead.com/modelviewer*",
    "// @match        https://wow.zamimg.com/modelviewer*",
    "// Update the @match lines above if your Pizza Logs URL or local port changes.",
    `// @downloadURL   ${PORTRAIT_USERSCRIPT_URL}`,
    `// @updateURL     ${PORTRAIT_USERSCRIPT_URL}`,
    "// @connect      armory.warmane.com",
    "// @connect      cdn.warmane.com",
    "// @connect      wow.zamimg.com",
    "// @run-at       document-idle",
    "// @grant        GM_xmlhttpRequest",
    "// @grant        GM_getValue",
    "// @grant        GM_setValue",
    "// ==/UserScript==",
    "",
    `(${script.toString()})();`,
  ].join("\n");
}
