import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlayerGearPreviewClient, getPlayerGearPreviewKey, getResolvedPreviewClass, hasResolvedPreviewClass, parsePlayerGearPreview } from "../lib/player-gear-preview";

function healthy(name = "Lausudo", realm = "Lordaeron") {
  return {
    ok: true, stale: false, className: "PALADIN", classSource: "armory", raceName: "Human", guildName: "Pizza Warriors", gearScore: null,
    gear: {
      characterName: name, realm, className: "Paladin", fetchedAt: "2026-09-06T10:00:00Z",
      sourceUrl: `https://armory.warmane.com/character/${name}/${realm}/summary`,
      items: [{ slot: "Head", name: "Known helmet" }],
    },
  };
}

function fetcher(fn: (input: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => fn(String(input), init)) as typeof fetch;
}

test("only matching character and realm responses may supply canonical identity", () => {
  assert.equal(getPlayerGearPreviewKey(" LAUSUDO ", " lordaeron "), "lausudo@lordaeron");
  assert.equal(parsePlayerGearPreview(healthy(), "lausudo", "Lordaeron")?.className, "Paladin");
  assert.equal(parsePlayerGearPreview(healthy("Another"), "Lausudo", "Lordaeron"), null);
  assert.equal(parsePlayerGearPreview(healthy("Lausudo", "Icecrown"), "Lausudo", "Lordaeron"), null);
  assert.equal(parsePlayerGearPreview({ ...healthy(), gear: { ...healthy().gear, items: [{}] } }, "Lausudo"), null);
  assert.equal(parsePlayerGearPreview({ ...healthy(), gear: { ...healthy().gear, fetchedAt: "invalid" } }, "Lausudo"), null);
  const failure = { ok: false as const, characterName: "Lausudo", realm: "Lordaeron", message: "Unavailable", sourceUrl: "", className: "Mage" };
  assert.equal(getResolvedPreviewClass(failure), null, "An unverified failure cannot change class");
  assert.equal(getResolvedPreviewClass({ ...failure, classSource: "armory" }), "Mage", "Verified identity can survive an equipment outage");
});

test("lazy cache deduplicates in-flight requests and isolates realms", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const client = createPlayerGearPreviewClient({ fetcher: fetcher(async input => {
    calls += 1;
    await gate;
    const realm = new URL(input, "https://example.test").searchParams.get("realm")!;
    return Response.json(healthy("Lausudo", realm));
  }) });
  assert.equal(calls, 0);
  const first = client.load("Lausudo", "Lordaeron");
  const duplicate = client.load("lausudo", "Lordaeron");
  assert.equal(first, duplicate);
  assert.equal(calls, 1);
  release();
  assert.equal((await first).className, "Paladin");
  await client.load("Lausudo", "Lordaeron");
  assert.equal(calls, 1);
  await client.load("Lausudo", "Icecrown");
  assert.equal(calls, 2);
});

test("canonical unknown never resurrects a conflicting class from nested equipment", () => {
  const unknown = parsePlayerGearPreview({ ...healthy(), className: null, classSource: "unknown", gear: { ...healthy().gear, className: "Mage" } }, "Lausudo");
  assert.ok(unknown?.ok);
  assert.equal(unknown.className, null);
  assert.equal(hasResolvedPreviewClass(unknown), true, "An explicit canonical unknown is an authoritative result");
  const legacy: Record<string, unknown> = healthy();
  delete legacy.className;
  assert.equal(parsePlayerGearPreview(legacy, "Lausudo")?.className, "Paladin", "Legacy payloads may fall back only when top-level class is absent");
  const missing = parsePlayerGearPreview({ ...legacy, gear: { ...healthy().gear, className: undefined } }, "Lausudo");
  assert.equal(hasResolvedPreviewClass(missing), false, "Missing identity must preserve the initial class");
  assert.equal(parsePlayerGearPreview({ ...healthy(), className: "not-a-class" }, "Lausudo"), null);
});

test("healthy gear survives failed refresh and retries after the short failure window", async () => {
  let clock = 0;
  let calls = 0;
  let fail = false;
  const client = createPlayerGearPreviewClient({ now: () => clock, fetcher: fetcher(async () => {
    calls += 1;
    if (fail) throw new Error("Network unavailable");
    return Response.json(healthy());
  }) });
  await client.load("Lausudo");
  clock = 300_001;
  fail = true;
  const stale = await client.load("Lausudo");
  assert.ok(stale.ok && stale.stale);
  if (stale.ok) assert.equal(stale.gear.items[0].name, "Known helmet");
  await client.load("Lausudo");
  assert.equal(calls, 2);
  clock += 15_001;
  fail = false;
  const recovered = await client.load("Lausudo");
  assert.ok(recovered.ok && !recovered.stale);
  assert.equal(calls, 3);
});

test("failure responses do not suppress retry for five minutes or overwrite healthy identity", async () => {
  let clock = 0;
  let calls = 0;
  const client = createPlayerGearPreviewClient({ now: () => clock, fetcher: fetcher(async () => {
    calls += 1;
    return calls === 1 ? Response.json({ ok: false, characterName: "Lausudo", realm: "Lordaeron", message: "Outage", className: "Paladin", classSource: "roster" })
      : Response.json(healthy());
  }) });
  const unavailable = await client.load("Lausudo");
  assert.equal(unavailable.ok, false);
  assert.equal(getResolvedPreviewClass(unavailable), "Paladin");
  clock = 15_001;
  assert.equal((await client.load("Lausudo")).ok, true);
  assert.equal(calls, 2);
});

test("mismatched response cannot replace a healthy snapshot", async () => {
  let clock = 0;
  const client = createPlayerGearPreviewClient({ now: () => clock, fetcher: fetcher(async () => Response.json(clock === 0 ? healthy() : healthy("Another"))) });
  await client.load("Lausudo");
  clock = 300_001;
  const data = await client.load("Lausudo");
  assert.ok(data.ok && data.stale);
  if (data.ok) assert.equal(data.gear.characterName, "Lausudo");
});

test("verified identity-only refresh corrects class while retaining cached equipment", async () => {
  let clock = 0;
  const client = createPlayerGearPreviewClient({ now: () => clock, fetcher: fetcher(async () => Response.json(clock === 0 ? healthy() : {
    ok: false, characterName: "Lausudo", realm: "Lordaeron", message: "Equipment unavailable", className: "Mage", classSource: "armory",
  })) });
  await client.load("Lausudo");
  clock = 300_001;
  const data = await client.load("Lausudo");
  assert.ok(data.ok && data.stale);
  assert.equal(getResolvedPreviewClass(data), "Mage");
  if (data.ok) assert.equal(data.gear.items[0].name, "Known helmet");
});

test("request timeout bounds a stalled response body and releases the request slot", async () => {
  let calls = 0;
  let aborted = false;
  const client = createPlayerGearPreviewClient({ timeoutMs: 10, failureCacheMs: 0, fetcher: fetcher(async (_input, init) => {
    calls += 1;
    init?.signal?.addEventListener("abort", () => { aborted = true; });
    if (calls > 1) return Response.json(healthy());
    return { ok: true, json: () => new Promise(() => {}) } as Response;
  }) });
  assert.equal((await client.load("Lausudo")).ok, false);
  assert.equal(aborted, true);
  assert.equal((await client.load("Lausudo")).ok, true);
  assert.equal(calls, 2);
});
