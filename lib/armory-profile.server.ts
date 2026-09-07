import { db } from "./db";
import { readUpstreamText } from "./upstream-response";
import { ArmorySectionDataSchema, ArmorySpellSchema, armorySectionUrl, isArmoryCategory, type ArmorySection, type ArmorySectionResult, type ArmorySpell } from "./armory-profile";
import { armoryCategories, matchingArmoryDocument, parseArmorySection, parseArmorySpell } from "./armory-profile-parser";

const MAX_AGE = 12 * 60 * 60 * 1000;
const RETRY_AFTER = 60 * 1000;
const pending = new Map<string, Promise<ArmorySectionResult>>();
let activeRefreshes = 0;
const MAX_REFRESHES = 6;
const cooldowns = new Map<string, number>();

async function upstream(url: string, signal: AbortSignal, category?: string): Promise<string> {
  const host = new URL(url).hostname;
  if ((cooldowns.get(host) ?? 0) > Date.now()) throw new Error("UPSTREAM_RATE_LIMITED");
  const response = await fetch(url, {
    redirect: "error", cache: "no-store", signal,
    headers: { "User-Agent": "PizzaLogsBot/1.0 (+https://pizza-logs-production.up.railway.app)",
      ...(category ? { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" } : {}) },
    ...(category ? { method: "POST", body: new URLSearchParams({ category }).toString() } : {}),
  });
  if (response.status === 429) {
    const header = response.headers.get("retry-after") ?? "60";
    const requestedDelay = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
    const delay = Number.isFinite(requestedDelay) ? Math.min(15 * 60_000, Math.max(60_000, requestedDelay)) : 60_000;
    cooldowns.set(host, Date.now() + delay);
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 429 ? "UPSTREAM_RATE_LIMITED" : `Armory unavailable (${response.status})`); }
  return readUpstreamText(response);
}

export async function fetchArmorySection(name: string, realm: string, section: ArmorySection, category: string): Promise<ArmorySectionResult["data"]> {
  const signal = AbortSignal.timeout(12_000);
  const url = armorySectionUrl(name, realm, section);
  const html = await upstream(url, signal);
  // Identity is verified before requesting a category fragment lacking its own identity.
  const $ = matchingArmoryDocument(html, name, realm);
  let fragment: string | undefined;
  let summary: unknown;
  if (section === "achievements" || section === "statistics") {
    if (!armoryCategories($).some(value => value.id === category)) throw new Error("Unknown Armory category");
    const data = JSON.parse(await upstream(url, signal, category));
    if (typeof data?.content !== "string") throw new Error("Armory category unavailable");
    fragment = data.content;
  } else if (section === "summary") {
    summary = JSON.parse(await upstream(`https://armory.warmane.com/api/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/summary`, signal));
  }
  return parseArmorySection(html, name, realm, section, category, fragment, summary);
}

export async function getArmoryProfileSection(name: string, realm: string, section: ArmorySection, category = "summary"): Promise<ArmorySectionResult> {
  if (!isArmoryCategory(section, category)) throw new Error("Invalid Armory request");
  if (!/^[A-Za-z]{2,12}$/.test(name) || !/^[A-Za-z]{2,24}$/.test(realm)) return {
    data: null, fetchedAt: null, stale: false, sourceUrl: armorySectionUrl(name, realm, section), message: "This character has no supported Warmane Armory profile.",
  };
  const key = `${name.toLowerCase()}@${realm.toLowerCase()}:${section}:${category}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = readOrRefresh(name, realm, section, category);
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}

const pendingSpells = new Map<number, Promise<ArmorySpell | null>>();
export async function getArmorySpell(id: number): Promise<ArmorySpell | null> {
  if (!Number.isInteger(id) || id < 1 || id > 1000000) return null;
  const pendingSpell = pendingSpells.get(id);
  if (pendingSpell) return pendingSpell;
  const task = (async () => {
    const identity = { characterKey: "_spell", realm: "wotlk", sectionKey: `v1:${id}` };
    const where = { characterKey_realm_sectionKey: identity };
    const cached = await db.armoryProfileCache.findUnique({ where }).catch(() => null);
    const parsed = ArmorySpellSchema.safeParse(cached?.payload);
    const data = parsed.success && parsed.data.id === id ? parsed.data : null;
    if (data) return data;
    if (activeRefreshes >= MAX_REFRESHES || (cached && Date.now() - cached.lastAttemptAt.getTime() < RETRY_AFTER)) return null;
    activeRefreshes++;
    try {
      const html = await upstream(`https://wotlk.cavernoftime.com/spell=${id}`, AbortSignal.timeout(8000));
      const spell = parseArmorySpell(html, id);
      await db.armoryProfileCache.upsert({ where, create: { ...identity, payload: spell, fetchedAt: new Date() },
        update: { payload: spell, fetchedAt: new Date(), lastAttemptAt: new Date() } }).catch(() => undefined);
      return spell;
    } catch {
      await db.armoryProfileCache.upsert({ where, create: identity, update: { lastAttemptAt: new Date() } }).catch(() => undefined);
      return null;
    } finally { activeRefreshes--; }
  })();
  pendingSpells.set(id, task);
  try { return await task; } finally { pendingSpells.delete(id); }
}

async function readOrRefresh(name: string, realm: string, section: ArmorySection, category: string): Promise<ArmorySectionResult> {
  const sourceUrl = armorySectionUrl(name, realm, section);
  const identity = { characterKey: name.toLowerCase(), realm: realm.toLowerCase(), sectionKey: `v1:${section}:${category}` };
  const where = { characterKey_realm_sectionKey: identity };
  const cached = await db.armoryProfileCache.findUnique({ where }).catch(() => null);
  const parsed = ArmorySectionDataSchema.safeParse(cached?.payload);
  const data = parsed.success && parsed.data.characterName.toLowerCase() === identity.characterKey
    && parsed.data.realm.toLowerCase() === identity.realm && parsed.data.section === section && parsed.data.category === category ? parsed.data : null;
  const fetchedAt = data ? cached?.fetchedAt?.toISOString() ?? null : null;
  const fresh = data && fetchedAt && Date.now() - Date.parse(fetchedAt) < MAX_AGE;
  if (fresh) return { data, fetchedAt, sourceUrl, stale: false };
  const fallback = { data, fetchedAt, sourceUrl, stale: Boolean(data), message: data
    ? "Warmane could not be refreshed. Showing the last saved snapshot." : "This section is temporarily unavailable from Warmane." };
  if (activeRefreshes >= MAX_REFRESHES || (cached && Date.now() - cached.lastAttemptAt.getTime() < RETRY_AFTER)) return fallback;
  activeRefreshes++;
  try {
    const result = await fetchArmorySection(name, realm, section, category);
    const now = new Date();
    if (!result) return fallback;
    await db.armoryProfileCache.upsert({ where, create: { ...identity, payload: result, fetchedAt: now, lastAttemptAt: now },
      update: { payload: result, fetchedAt: now, lastAttemptAt: now } }).catch(() => undefined);
    return { data: result, fetchedAt: now.toISOString(), sourceUrl, stale: false };
  } catch (error) {
    await db.armoryProfileCache.upsert({ where, create: identity, update: { lastAttemptAt: new Date() } }).catch(() => undefined);
    return error instanceof Error && error.message === "UPSTREAM_RATE_LIMITED"
      ? { ...fallback, message: `${data ? "Showing the last saved snapshot. " : ""}Warmane is limiting requests. Try again in a minute.` } : fallback;
  } finally { activeRefreshes--; }
}
