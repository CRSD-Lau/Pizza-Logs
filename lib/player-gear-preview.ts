import type { ArmoryCharacterGear } from "./warmane-armory";
import { normalizePlayerClass } from "./player-class";

export type GearPreview = {
  ok: true;
  gear: ArmoryCharacterGear;
  stale: boolean;
  className: string | null;
  raceName: string | null;
  guildName: string | null;
  classSource?: "armory" | "roster" | "combat-log" | "unknown";
  classResolved?: boolean;
  gearScore: { score: number; averageItemLevel: number; quality: string } | null;
};

export type GearPreviewFailure = {
  ok: false;
  message: string;
  sourceUrl: string;
  characterName: string;
  realm: string;
  className: string | null;
  classSource?: "armory" | "roster" | "combat-log" | "unknown";
  raceName?: string | null;
  guildName?: string | null;
};

export type GearPreviewResponse = GearPreview | GearPreviewFailure;

const SUCCESS_CACHE_MS = 5 * 60 * 1000;
const FAILURE_CACHE_MS = 15_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_CACHE_ENTRIES = 200;

export function getPlayerGearPreviewKey(name: string, realmName?: string | null): string {
  return `${name.trim().toLowerCase()}@${(realmName?.trim() || "Lordaeron").toLowerCase()}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function classSource(value: unknown): GearPreview["classSource"] {
  return value === "armory" || value === "roster" || value === "combat-log" ? value : "unknown";
}

export function hasResolvedPreviewClass(preview: GearPreviewResponse | null): boolean {
  if (!preview) return false;
  return preview.ok ? preview.classResolved !== false
    : (preview.classSource === "armory" || preview.classSource === "roster") && normalizePlayerClass(preview.className) !== null;
}

export function getResolvedPreviewClass(preview: GearPreviewResponse | null): string | null {
  return hasResolvedPreviewClass(preview) ? normalizePlayerClass(preview?.className) : null;
}

/** A preview must identify the requested character before it can alter the UI. */
export function parsePlayerGearPreview(value: unknown, name: string, realmName?: string | null): GearPreviewResponse | null {
  if (!record(value) || typeof value.ok !== "boolean") return null;
  const identity = value.ok ? value.gear : value;
  if (!record(identity) || typeof identity.characterName !== "string" || typeof identity.realm !== "string"
    || getPlayerGearPreviewKey(identity.characterName, identity.realm) !== getPlayerGearPreviewKey(name, realmName)) return null;

  if (!value.ok) {
    return {
      ok: false,
      message: optionalString(value.message) ?? "Gear is temporarily unavailable from Warmane Armory.",
      sourceUrl: optionalString(value.sourceUrl) ?? "",
      characterName: identity.characterName,
      realm: identity.realm,
      className: normalizePlayerClass(value.className),
      classSource: classSource(value.classSource),
      raceName: optionalString(value.raceName),
      guildName: optionalString(value.guildName),
    };
  }

  if (!Array.isArray(identity.items) || !identity.items.every(item => record(item)
    && typeof item.slot === "string" && typeof item.name === "string")
    || typeof identity.fetchedAt !== "string" || !Number.isFinite(Date.parse(identity.fetchedAt))) return null;
  const hasCanonicalClass = Object.prototype.hasOwnProperty.call(value, "className");
  if (hasCanonicalClass && value.className !== null && normalizePlayerClass(value.className) === null) return null;
  const resolvedClass = hasCanonicalClass ? normalizePlayerClass(value.className) : normalizePlayerClass(identity.className);
  const score = value.gearScore;
  const gearScore = record(score) && typeof score.score === "number" && Number.isFinite(score.score)
    && typeof score.averageItemLevel === "number" && Number.isFinite(score.averageItemLevel)
    && typeof score.quality === "string"
    ? { score: score.score, averageItemLevel: score.averageItemLevel, quality: score.quality }
    : null;
  return {
    ok: true,
    gear: identity as ArmoryCharacterGear,
    stale: value.stale === true,
    className: resolvedClass,
    classResolved: hasCanonicalClass || resolvedClass !== null,
    classSource: classSource(value.classSource),
    raceName: optionalString(value.raceName),
    guildName: optionalString(value.guildName),
    gearScore,
  };
}

/** Shared only within this browser module: no page-render or mount-time requests. */
export function createPlayerGearPreviewClient(options: {
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  successCacheMs?: number;
  failureCacheMs?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; data: GearPreviewResponse }>();
  const requests = new Map<string, Promise<GearPreviewResponse>>();

  const load = (name: string, realmName?: string | null): Promise<GearPreviewResponse> => {
    const key = getPlayerGearPreviewKey(name, realmName);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return Promise.resolve(cached.data);
    const existing = requests.get(key);
    if (existing) return existing;

    const request = (async (): Promise<GearPreviewResponse> => {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let data: GearPreviewResponse;
      try {
        const searchParams = new URLSearchParams({ realm: realmName?.trim() || "Lordaeron" });
        const fetchPreview = async () => {
          const response = await (options.fetcher ?? globalThis.fetch)(`/api/players/${encodeURIComponent(name.trim())}/gear?${searchParams}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Unavailable response");
          const preview = parsePlayerGearPreview(await response.json(), name, realmName);
          if (!preview) throw new Error("Invalid preview identity or payload");
          return preview;
        };
        data = await Promise.race([
          fetchPreview(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new Error("Preview request timed out"));
            }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
          }),
        ]);
      } catch {
        data = {
          ok: false,
          message: "Gear is temporarily unavailable from Warmane Armory. Open the quick look again shortly to retry.",
          sourceUrl: "",
          characterName: name,
          realm: realmName?.trim() || "Lordaeron",
          className: null,
        };
      } finally {
        clearTimeout(timeout);
      }

      // A failed refresh must not discard readable gear from the same identity.
      const failed = !data.ok;
      if (failed && cached?.data.ok) {
        const resolvedClass = getResolvedPreviewClass(data);
        data = {
          ...cached.data,
          stale: true,
          ...(resolvedClass ? { className: resolvedClass, classSource: data.classSource, classResolved: true } : {}),
          raceName: data.raceName ?? cached.data.raceName,
          guildName: data.guildName ?? cached.data.guildName,
        };
      }
      const retrySoon = failed || (data.ok && data.stale);
      if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        expiresAt: now() + (retrySoon ? options.failureCacheMs ?? FAILURE_CACHE_MS : options.successCacheMs ?? SUCCESS_CACHE_MS),
        data,
      });
      return data;
    })().finally(() => requests.delete(key));
    requests.set(key, request);
    return request;
  };

  return { load };
}

export const playerGearPreviewClient = createPlayerGearPreviewClient();
