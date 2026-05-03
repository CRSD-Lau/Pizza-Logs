import assert from "node:assert/strict";
import vm from "node:vm";
import {
  buildPlayerPortraitUserscript,
  PORTRAIT_USERSCRIPT_PATH,
  PORTRAIT_USERSCRIPT_URL,
} from "../lib/player-portrait-client-scripts";

const userscript = buildPlayerPortraitUserscript();

assert.equal(PORTRAIT_USERSCRIPT_PATH, "/api/player-portraits/userscript.user.js");
assert.equal(PORTRAIT_USERSCRIPT_URL, "https://pizza-logs-production.up.railway.app/api/player-portraits/userscript.user.js");
assert.match(userscript, /\/\/ ==UserScript==/);
assert.match(userscript, /\/\/ @name\s+Pizza Logs Warmane Portraits/);
assert.match(userscript, /\/\/ @match\s+https:\/\/pizza-logs-production\.up\.railway\.app\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/localhost:3000\/\*/);
assert.match(userscript, /\/\/ @match\s+http:\/\/127\.0\.0\.1:3000\/\*/);
assert.match(userscript, /\/\/ @match\s+https:\/\/armory\.warmane\.com\/character\/\*/);
assert.match(userscript, /\/\/ @match\s+https:\/\/www\.wowhead\.com\/modelviewer\*/);
assert.match(userscript, /\/\/ @match\s+https:\/\/wow\.zamimg\.com\/modelviewer\*/);
assert.match(userscript, /\/\/ @grant\s+GM_xmlhttpRequest/);
assert.match(userscript, /\/\/ @grant\s+GM_getValue/);
assert.match(userscript, /\/\/ @grant\s+GM_setValue/);
assert.match(userscript, /data-pizza-avatar/);
assert.match(userscript, /findPortraitUrl/);
assert.match(userscript, /pizzaLogsWarmanePortraitCache/);
assert.match(userscript, /toDataURL/);

async function verifyUserscriptReplacesInitialsWithFetchedPortrait() {
  const avatar = {
    dataset: {
      pizzaAvatar: "character",
      characterName: "Lichkingspet",
      characterRealm: "Lordaeron",
      characterClass: "Death Knight",
      initials: "LI",
    } as Record<string, string>,
    innerHTML: "LI",
    textContent: "LI",
    appendChild(child: { tagName: string; src: string }) {
      this.child = child;
    },
    querySelector: () => null,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    attributes: {} as Record<string, string>,
    child: null as null | { tagName: string; src: string },
  };

  const storage = new Map<string, string>();
  const timers: Promise<void>[] = [];

  const context = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "pizza-logs-production.up.railway.app",
      pathname: "/players/Lichkingspet",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelectorAll: (selector: string) => {
        if (selector === "[data-pizza-avatar='character']") return [avatar];
        if (selector === "h1") return [];
        if (selector === "a[href*='/players/']") return [];
        throw new Error(`Unexpected selector ${selector}`);
      },
      createElement: (tagName: string) => ({
        tagName,
        dataset: {},
        style: { cssText: "" },
        set alt(value: string) { this.altText = value; },
        set src(value: string) { this.srcValue = value; },
        get src() { return this.srcValue; },
        altText: "",
        srcValue: "",
      }),
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [{
            getAttribute: (name: string) => name === "src" ? "/images/characters/lichkingspet.jpg" : "character-portrait",
            matches: (selector: string) => selector.includes("portrait") || selector.includes("character"),
          }],
        };
      }
    },
    GM_xmlhttpRequest: ({ onload }: { onload: (response: { status: number; responseText: string; finalUrl: string }) => void }) => {
      onload({
        status: 200,
        responseText: '<img class="character-portrait" src="/images/characters/lichkingspet.jpg">',
        finalUrl: "https://armory.warmane.com/character/Lichkingspet/Lordaeron/summary",
      });
    },
  };

  vm.runInNewContext(userscript, context);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  assert.equal(
    avatar.child?.src,
    "https://armory.warmane.com/images/characters/lichkingspet.jpg",
  );
  assert.equal(avatar.dataset.pizzaAvatarState, "portrait");
}

async function verifyUserscriptFindsLegacyPlayerHeader() {
  const avatar = {
    dataset: {} as Record<string, string>,
    innerHTML: "LI",
    textContent: "LI",
    children: [],
    parentElement: null,
    appendChild(child: { src: string }) {
      this.child = child;
    },
    querySelector: () => null,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    attributes: { class: "w-14 h-14 rounded-sm" } as Record<string, string>,
    child: null as null | { src: string },
  };
  const title: { textContent: string; parentElement: unknown } = {
    textContent: "Lichkingspet",
    parentElement: null,
  };
  const info = { textContent: "Lichkingspet Death Knight Human Level 80 Lordaeron PizzaWarriors Lich" };
  const headingWrap: { textContent: string; parentElement: unknown; children: unknown[] } = {
    textContent: info.textContent,
    parentElement: null,
    children: [title, info],
  };
  const header = { textContent: info.textContent, children: [avatar, headingWrap] };
  title.parentElement = headingWrap;
  headingWrap.parentElement = header;

  const storage = new Map<string, string>();
  const timers: Promise<void>[] = [];

  const context = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "pizza-logs-production.up.railway.app",
      pathname: "/players/Lichkingspet",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelectorAll: (selector: string) => {
        if (selector === "[data-pizza-avatar='character']") return [];
        if (selector === "h1") return [title];
        if (selector === "a[href*='/players/']") return [];
        throw new Error(`Unexpected selector ${selector}`);
      },
      createElement: (tagName: string) => ({
        tagName,
        dataset: {},
        style: { cssText: "" },
        set alt(value: string) { this.altText = value; },
        set src(value: string) { this.srcValue = value; },
        get src() { return this.srcValue; },
        altText: "",
        srcValue: "",
      }),
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [{
            getAttribute: (name: string) => name === "src" ? "/images/characters/lichkingspet.jpg" : "character-portrait",
          }],
        };
      }
    },
    GM_xmlhttpRequest: ({ onload }: { onload: (response: { status: number; responseText: string }) => void }) => {
      onload({
        status: 200,
        responseText: '<img class="character-portrait" src="/images/characters/lichkingspet.jpg">',
      });
    },
  };

  vm.runInNewContext(userscript, context);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  assert.equal(avatar.dataset.characterName, "Lichkingspet");
  assert.equal(avatar.dataset.characterRealm, "Lordaeron");
  assert.equal(avatar.dataset.characterClass, "Death Knight");
  assert.equal(
    avatar.child?.src,
    "https://armory.warmane.com/images/characters/lichkingspet.jpg",
  );
}

async function verifyUserscriptCachesWarmaneCanvasForPizzaLogsPages() {
  const gmStorage = new Map<string, string>();
  const timers: Promise<void>[] = [];

  const warmaneContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "armory.warmane.com",
      pathname: "/character/Maximusboom/Lordaeron/summary",
      href: "https://armory.warmane.com/character/Maximusboom/Lordaeron/summary",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      addEventListener() {},
      documentElement: { outerHTML: "<html></html>" },
      querySelectorAll: (selector: string) => {
        if (selector === "canvas") {
          return [{
            width: 512,
            height: 512,
            toDataURL: () => "data:image/png;base64," + "a".repeat(1200),
          }];
        }
        return [];
      },
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
  };

  vm.runInNewContext(userscript, warmaneContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  const avatar = {
    dataset: {
      pizzaAvatar: "character",
      characterName: "Maximusboom",
      characterRealm: "Lordaeron",
      characterClass: "Druid",
      initials: "MA",
    } as Record<string, string>,
    innerHTML: "MA",
    textContent: "MA",
    appendChild(child: { tagName: string; src: string }) {
      this.child = child;
    },
    querySelector: () => null,
    setAttribute() {},
    child: null as null | { tagName: string; src: string },
  };

  const pizzaContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "pizza-logs-production.up.railway.app",
      pathname: "/players/Maximusboom",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelectorAll: (selector: string) => {
        if (selector === "[data-pizza-avatar='character']") return [avatar];
        if (selector === "h1") return [];
        if (selector === "a[href*='/players/']") return [];
        throw new Error(`Unexpected selector ${selector}`);
      },
      createElement: (tagName: string) => ({
        tagName,
        dataset: {},
        style: { cssText: "" },
        set alt(value: string) { this.altText = value; },
        set src(value: string) { this.srcValue = value; },
        get src() { return this.srcValue; },
        altText: "",
        srcValue: "",
      }),
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
    GM_xmlhttpRequest: () => {
      throw new Error("Should use cached Warmane canvas before fetching");
    },
  };

  vm.runInNewContext(userscript, pizzaContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  assert.match(avatar.child?.src ?? "", /^data:image\/png;base64,/);
  assert.equal(avatar.dataset.pizzaAvatarState, "portrait");
}

async function verifyUserscriptCachesWowheadFrameCanvasUsingWarmaneReferrer() {
  const gmStorage = new Map<string, string>();
  const timers: Promise<void>[] = [];

  const modelViewerContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "wow.zamimg.com",
      pathname: "/modelviewer/live/viewer.html",
      href: "https://wow.zamimg.com/modelviewer/live/viewer.html?model=humanmale",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      referrer: "https://armory.warmane.com/character/Lausudo/Lordaeron/profile",
      addEventListener() {},
      documentElement: { outerHTML: "<html></html>" },
      querySelectorAll: (selector: string) => {
        if (selector === "canvas") {
          return [{
            width: 512,
            height: 512,
            toDataURL: () => "data:image/png;base64," + "b".repeat(1400),
          }];
        }
        return [];
      },
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
  };

  vm.runInNewContext(userscript, modelViewerContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  const avatar = {
    dataset: {
      pizzaAvatar: "character",
      characterName: "Lausudo",
      characterRealm: "Lordaeron",
      characterClass: "Paladin",
      initials: "LA",
    } as Record<string, string>,
    innerHTML: "LA",
    textContent: "LA",
    appendChild(child: { tagName: string; src: string }) {
      this.child = child;
    },
    querySelector: () => null,
    setAttribute() {},
    child: null as null | { tagName: string; src: string },
  };

  const pizzaContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "pizza-logs-production.up.railway.app",
      pathname: "/players/Lausudo",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelectorAll: (selector: string) => {
        if (selector === "[data-pizza-avatar='character']") return [avatar];
        if (selector === "h1") return [];
        if (selector === "a[href*='/players/']") return [];
        throw new Error(`Unexpected selector ${selector}`);
      },
      createElement: (tagName: string) => ({
        tagName,
        dataset: {},
        style: { cssText: "" },
        set alt(value: string) { this.altText = value; },
        set src(value: string) { this.srcValue = value; },
        get src() { return this.srcValue; },
        altText: "",
        srcValue: "",
      }),
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
    GM_xmlhttpRequest: () => {
      throw new Error("Should use cached modelviewer canvas before fetching");
    },
  };

  vm.runInNewContext(userscript, pizzaContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  assert.match(avatar.child?.src ?? "", /^data:image\/png;base64,/);
  assert.equal(avatar.dataset.pizzaAvatarState, "portrait");
}

async function verifyUserscriptCachesModelViewerCanvasUsingRecentWarmaneTargetWhenReferrerIsBlank() {
  const gmStorage = new Map<string, string>();
  const timers: Promise<void>[] = [];

  const warmaneContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "armory.warmane.com",
      pathname: "/character/Lausudo/Lordaeron/profile",
      href: "https://armory.warmane.com/character/Lausudo/Lordaeron/profile",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      referrer: "",
      addEventListener() {},
      documentElement: { outerHTML: "<html></html>" },
      querySelectorAll: () => [],
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
  };

  vm.runInNewContext(userscript, warmaneContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  const modelViewerContext = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    location: {
      hostname: "www.wowhead.com",
      pathname: "/modelviewer",
      href: "https://www.wowhead.com/modelviewer?model=humanfemale",
    },
    setTimeout: (callback: () => void) => {
      const promise = Promise.resolve().then(callback);
      timers.push(promise);
      return 1;
    },
    localStorage: {
      getItem: (key: string) => gmStorage.get(`local:${key}`) ?? null,
      setItem: (key: string, value: string) => gmStorage.set(`local:${key}`, value),
      removeItem: (key: string) => gmStorage.delete(`local:${key}`),
    },
    GM_getValue: (key: string, fallback: string) => gmStorage.get(key) ?? fallback,
    GM_setValue: (key: string, value: string) => gmStorage.set(key, value),
    document: {
      readyState: "complete",
      referrer: "",
      addEventListener() {},
      documentElement: { outerHTML: "<html></html>" },
      querySelectorAll: (selector: string) => {
        if (selector === "canvas") {
          return [{
            width: 512,
            height: 512,
            toDataURL: () => "data:image/png;base64," + "c".repeat(1400),
          }];
        }
        return [];
      },
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
        };
      }
    },
  };

  vm.runInNewContext(userscript, modelViewerContext);
  await Promise.all(timers);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }

  const cache = JSON.parse(gmStorage.get("pizzaLogsWarmanePortraitCache") ?? "{}");
  assert.match(cache["lordaeron:lausudo"]?.url ?? "", /^data:image\/png;base64,/);
}

Promise.all([
  verifyUserscriptReplacesInitialsWithFetchedPortrait(),
  verifyUserscriptFindsLegacyPlayerHeader(),
  verifyUserscriptCachesWarmaneCanvasForPizzaLogsPages(),
  verifyUserscriptCachesWowheadFrameCanvasUsingWarmaneReferrer(),
  verifyUserscriptCachesModelViewerCanvasUsingRecentWarmaneTargetWhenReferrerIsBlank(),
])
  .then(() => console.log("player-portrait-client-scripts tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
