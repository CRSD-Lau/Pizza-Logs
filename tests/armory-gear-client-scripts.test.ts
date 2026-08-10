import assert from "node:assert/strict";
import vm from "node:vm";
import { buildGuildRosterUserscript } from "../lib/guild-roster-client-scripts";
import {
  buildBookmarklet,
  buildUserscript,
  LOCAL_USERSCRIPT_PATH,
  LOCAL_USERSCRIPT_URL,
  PIZZA_LOGS_LOCAL_ORIGIN,
  PIZZA_LOGS_ORIGIN,
  USERSCRIPT_PATH,
  USERSCRIPT_URL,
} from "../lib/armory-gear-client-scripts";

const bookmarklet = buildBookmarklet();
const userscript = buildUserscript();
const localUserscript = buildUserscript({
  pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
  userscriptUrl: LOCAL_USERSCRIPT_URL,
  nameSuffix: " (Local)",
});

assert.equal(PIZZA_LOGS_ORIGIN, "https://pizza-logs-production.up.railway.app");
assert.equal(PIZZA_LOGS_LOCAL_ORIGIN, "http://127.0.0.1:3001");
assert.equal(USERSCRIPT_PATH, "/api/admin/armory-gear/userscript.user.js");
assert.equal(LOCAL_USERSCRIPT_PATH, "/api/admin/armory-gear/userscript.local.user.js");
assert.equal(USERSCRIPT_URL, `${PIZZA_LOGS_ORIGIN}/api/admin/armory-gear/userscript.user.js`);
assert.equal(LOCAL_USERSCRIPT_URL, `${PIZZA_LOGS_LOCAL_ORIGIN}/api/admin/armory-gear/userscript.local.user.js`);
assert.match(userscript, /\/\/ ==UserScript==/);
assert.match(userscript, /\/\/ @name\s+Pizza Logs Warmane Gear Auto Sync/);
assert.match(userscript, new RegExp(`// @downloadURL\\s+${USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(userscript, new RegExp(`// @updateURL\\s+${USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, /\/\/ @name\s+Pizza Logs Warmane Gear Auto Sync \(Local\)/);
assert.match(localUserscript, new RegExp(`// @namespace\\s+${PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, new RegExp(`// @downloadURL\\s+${LOCAL_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, new RegExp(`// @updateURL\\s+${LOCAL_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, new RegExp(PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(localUserscript, /\/api\/admin\/armory-gear\/import/);
assert.match(userscript, /\/\/ @version\s+1\.8\.1/);
assert.match(userscript, /\/\/ @match\s+https:\/\/armory\.warmane\.com\/character\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/armory\.warmane\.com\/character\/\*/);
assert.match(userscript, new RegExp(`pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, new RegExp(`pizzaLogsAdminSecret:${PIZZA_LOGS_LOCAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.doesNotMatch(localUserscript, new RegExp(`pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
assert.match(localUserscript, /127\.0\.0\.1:3001/);
assert.match(localUserscript, /Target:/);
assert.match(localUserscript, /Admin secret rejected by/);
assert.match(userscript, /isCharacterPage/);
assert.match(userscript, /mergePageIconsIntoWarmaneData/);
assert.match(userscript, /readPageItemIcons/);
assert.match(userscript, /fetchPlayerPageItemIcons/);
assert.match(userscript, /querySelectorAll\("a\[href\*='\/item\/'\], a\[href\*='item='\]"\)/);
assert.match(userscript, /iconUrl/);
assert.match(userscript, /\/\/ @run-at\s+document-idle/);
assert.match(userscript, /DOMContentLoaded/);
assert.match(userscript, /Pizza Logs userscript starting/);
assert.match(userscript, /Pizza Logs panel injection failed/);
assert.match(userscript, /Pizza Logs Gear Sync/);
assert.match(userscript, /Refreshing known Pizza Logs players/);
assert.match(userscript, /mode\s*:\s*"refresh-all"/);
assert.match(userscript, /scheduleNextAutoSync/);
assert.match(userscript, /autoTimer/);
assert.match(userscript, /clearTimeout/);
assert.match(bookmarklet, /mode\s*:\s*"refresh-all"/);
assert.match(bookmarklet, /no Pizza Logs players found to refresh/i);

const rosterUserscript = buildGuildRosterUserscript();
const gearBottom = userscript.match(/"bottom:([^"]+)"/)?.[1];
const rosterBottom = rosterUserscript.match(/"bottom:([^"]+)"/)?.[1];
assert.ok(gearBottom);
assert.ok(rosterBottom);
assert.notEqual(gearBottom, rosterBottom);

async function verifyUserscriptMergesDomIconFallback() {
  const pending: Promise<unknown>[] = [];
  const importBodies: Array<{ equipment?: Array<{ item?: string; iconUrl?: string }> }> = [];
  const queueBodies: Array<{ mode?: string }> = [];
  const storage = new Map<string, string>([
    [`pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN}`, "secret"],
    [`pizzaLogsLastGearSyncAt:${PIZZA_LOGS_ORIGIN}`, "0"],
  ]);

  const context = {
    console: { info() {}, warn() {}, error() {} },
    location: {
      href: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary",
      hostname: "armory.warmane.com",
      pathname: "/character/Lausudo/Lordaeron/summary",
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    prompt: () => "secret",
    setTimeout: (callback: () => unknown, delay?: number) => {
      if (typeof delay === "number" && delay > 5000) return 1;
      const result = callback();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        pending.push(result as Promise<unknown>);
      }
      return 1;
    },
    clearTimeout() {},
    document: {
      body: { appendChild() {} },
      addEventListener() {},
      createElement: () => ({
        style: { cssText: "" },
        append() {},
        addEventListener() {},
        textContent: "",
        type: "",
        disabled: false,
      }),
      querySelectorAll: (selector: string) => {
        assert.equal(selector, "a[href*='/item/'], a[href*='item=']");
        return [{
          href: "https://armory.warmane.com/item/50024",
          querySelector: () => ({
            getAttribute: () => "/images/wow/icons/large/inv_chest_plate_26.jpg",
            src: "https://armory.warmane.com/images/wow/icons/large/inv_chest_plate_26.jpg",
          }),
        }];
      },
    },
    fetch: async (url: string, init?: { body?: string }) => {
      if (url.endsWith("/api/admin/armory-gear/missing")) {
        queueBodies.push(JSON.parse(init?.body ?? "{}"));
        return { ok: true, json: async () => ({ ok: true, players: [{ characterName: "Lausudo", realm: "Lordaeron" }] }) };
      }
      if (url.includes("/api/character/Lausudo/Lordaeron/summary")) {
        return { ok: true, json: async () => ({ name: "Lausudo", realm: "Lordaeron", equipment: [{ item: "50024", name: "Blightborne Warplate" }] }) };
      }
      if (url.endsWith("/api/admin/armory-gear/import")) {
        importBodies.push(JSON.parse(init?.body ?? "{}"));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  };

  vm.runInNewContext(userscript, context);
  while (pending.length > 0) {
    await Promise.all(pending.splice(0));
  }

  assert.equal(importBodies.length, 1);
  assert.equal(queueBodies[0]?.mode, "refresh-all");
  assert.equal(
    importBodies[0].equipment?.[0]?.iconUrl,
    "https://wow.zamimg.com/images/wow/icons/large/inv_chest_plate_26.jpg",
  );
}

async function verifyUserscriptFetchesQueuedPlayerPageIcons() {
  const pending: Promise<unknown>[] = [];
  const importBodies: Array<{ equipment?: Array<{ item?: string; iconUrl?: string }> }> = [];
  const queueBodies: Array<{ mode?: string }> = [];
  const storage = new Map<string, string>([
    [`pizzaLogsAdminSecret:${PIZZA_LOGS_ORIGIN}`, "secret"],
    [`pizzaLogsLastGearSyncAt:${PIZZA_LOGS_ORIGIN}`, "0"],
  ]);

  const makeIconDocument = () => ({
    querySelectorAll: (selector: string) => {
      assert.equal(selector, "a[href*='/item/'], a[href*='item=']");
      return [{
        href: "https://armory.warmane.com/item/50244",
        querySelector: () => ({
          getAttribute: () => "/images/wow/icons/large/inv_helmet_158.jpg",
          src: "https://armory.warmane.com/images/wow/icons/large/inv_helmet_158.jpg",
        }),
      }];
    },
  });

  const context = {
    console: { info() {}, warn() {}, error() {} },
    location: {
      href: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary",
      hostname: "armory.warmane.com",
      pathname: "/character/Lausudo/Lordaeron/summary",
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    prompt: () => "secret",
    setTimeout: (callback: () => unknown, delay?: number) => {
      if (typeof delay === "number" && delay > 5000) return 1;
      const result = callback();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        pending.push(result as Promise<unknown>);
      }
      return 1;
    },
    clearTimeout() {},
    DOMParser: class {
      parseFromString() {
        return makeIconDocument();
      }
    },
    document: {
      body: { appendChild() {} },
      addEventListener() {},
      createElement: () => ({
        style: { cssText: "" },
        append() {},
        addEventListener() {},
        textContent: "",
        type: "",
        disabled: false,
      }),
      querySelectorAll: () => [],
    },
    fetch: async (url: string, init?: { body?: string }) => {
      if (url.endsWith("/api/admin/armory-gear/missing")) {
        queueBodies.push(JSON.parse(init?.body ?? "{}"));
        return { ok: true, json: async () => ({ ok: true, players: [{ characterName: "Maxximusboom", realm: "Lordaeron" }] }) };
      }
      if (url.includes("/api/character/Maxximusboom/Lordaeron/summary")) {
        return { ok: true, json: async () => ({ name: "Maxximusboom", realm: "Lordaeron", equipment: [{ item: "50244", name: "Lasherweave Helmet" }] }) };
      }
      if (url.includes("/character/Maxximusboom/Lordaeron/summary")) {
        return { ok: true, text: async () => "<html></html>" };
      }
      if (url.endsWith("/api/admin/armory-gear/import")) {
        importBodies.push(JSON.parse(init?.body ?? "{}"));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  };

  vm.runInNewContext(userscript, context);
  while (pending.length > 0) {
    await Promise.all(pending.splice(0));
  }

  assert.equal(importBodies.length, 1);
  assert.equal(queueBodies[0]?.mode, "refresh-all");
  assert.equal(
    importBodies[0].equipment?.[0]?.iconUrl,
    "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_158.jpg",
  );
}

Promise.all([
  verifyUserscriptMergesDomIconFallback(),
  verifyUserscriptFetchesQueuedPlayerPageIcons(),
])
  .then(() => console.log("armory-gear-client-scripts tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
