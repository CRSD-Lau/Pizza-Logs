import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Client } from "pg";

const CHARACTER = "Phyre";
const REALM = "Lordaeron";
const GUILD = "PizzaWarriors";
const JQUERY_URL = "https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js";
const VIEWER_URL = "https://cdn.warmane.com/wmmv/wmmv.js?v=1736749263";
const FRAME = `iframe[title="${CHARACTER} 3D character model"]`;
const appearance = {
  modelId: "humanfemale", skin: 0, hairStyle: 1, hairColor: 0, face: 0,
  facialHair: 0, faceColor: 0, earPiercing: 0, hornStyle: 0, tattoo: 0,
  classId: 8, items: [[1, 63931]],
};

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function ownedRosterFixture() {
  // No dotenv or implicit connection defaults. URL parameters cannot override
  // the explicitly selected loopback host, port, database or user.
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.length > 1 && url.username && !url.hash);
  assert.ok([...url.searchParams.keys()].every(key => key === "schema"));
  assert.ok(url.searchParams.getAll("schema").length <= 1);
  assert.equal(url.searchParams.get("schema") ?? "public", "public", "Quick-look fixtures require the isolated public schema");
  const database = new Client({
    host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    connectionTimeoutMillis: 5000,
  });
  await database.connect();
  const id = `pizza-model-e2e-${randomUUID()}`;
  let inserted = false;
  const cleanup = async () => {
    try {
      if (inserted) {
        const removed = await database.query(`DELETE FROM public.guild_roster_members
          WHERE id = $1 AND normalized_character_name = $2 AND guild_name = $3 AND realm = $4`,
        [id, CHARACTER.toLowerCase(), GUILD, REALM]);
        assert.equal(removed.rowCount, 1, "Only the exact owned synthetic roster row is removed");
        assert.equal((await database.query("SELECT id FROM public.guild_roster_members WHERE id = $1", [id])).rowCount, 0);
      }
    } finally {
      await database.end();
    }
  };
  try {
    const identity = (await database.query("SELECT current_database() AS database, current_user AS username")).rows[0];
    assert.equal(identity.database, decodeURIComponent(url.pathname.slice(1)));
    assert.equal(identity.username, decodeURIComponent(url.username));
    const existing = await database.query(`SELECT id FROM public.guild_roster_members
      WHERE normalized_character_name = $1 AND guild_name = $2 AND realm = $3`, [CHARACTER.toLowerCase(), GUILD, REALM]);
    assert.equal(existing.rowCount, 0, "Refuse to replace an existing roster identity");
    await database.query(`INSERT INTO public.guild_roster_members
      (id, character_name, normalized_character_name, guild_name, realm, class_name, race_name,
       level, rank_order, armory_url, last_synced_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'Mage', 'Human', 80, 0, $6, now(), now())`,
    [id, CHARACTER, CHARACTER.toLowerCase(), GUILD, REALM, `https://armory.warmane.com/character/${CHARACTER}/${REALM}/summary`]);
    inserted = true;
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function gearResponse(hasAppearance, cachedAppearance) {
  return {
    ok: true, stale: false, className: "Mage", raceName: "Human", guildName: GUILD,
    gearScore: { score: 6000, averageItemLevel: 264, quality: "Epic" },
    gear: {
      characterName: CHARACTER, realm: REALM, className: "Mage", raceName: "Human", guildName: GUILD,
      sourceUrl: `https://armory.warmane.com/character/${CHARACTER}/${REALM}/summary`,
      fetchedAt: "2026-09-05T12:00:00.000Z", appearance: hasAppearance ? appearance : null,
      appearanceStale: cachedAppearance,
      items: [{ slot: "Head", name: "Synthetic Mage Hood", itemId: "50275", itemLevel: 264 }],
    },
  };
}

// Deliberately substitutes only the two actual upstream scripts. The real
// sandboxed srcDoc still constructs the viewer and sends its readiness message.
// This proves integration/layout, not Warmane's WebGL renderer or asset health.
const jqueryFixture = `window.$ = selector => [document.querySelector(selector)];`;
const viewerFixture = `
  window.ModelViewer = class {
    static WOW = 1;
    static WEBGL = 1;
    static FLASH = 2;
    static Wow = { Types: { CHARACTER: 1 } };
    constructor(options) {
      this.mode = ModelViewer.WEBGL;
      const target = options.container[0];
      const bounds = target.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0 && options.aspect > 0)) throw new Error('Zero-size model');
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bounds.width);
      canvas.height = Math.round(bounds.height);
      canvas.dataset.syntheticModel = options.models.id;
      target.appendChild(canvas);
      const paint = canvas.getContext('2d');
      paint.fillStyle = '#d8ad42';
      paint.fillRect(canvas.width / 3, 20, canvas.width / 3, canvas.height - 40);
      this.renderer = { zoom: { current: 0, target: 0 }, projMatrix: Array(16).fill(0) };
    }
    method(name) {
      window.syntheticModelChecks = (window.syntheticModelChecks || 0) + 1;
      return name === 'isLoaded' && window.syntheticModelLoaded !== false;
    }
  };`;

async function previewContext(browser, base, { mobile = false, missingAppearance = false, failedViewer = false, unavailableWebgl = false, cachedAppearance = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: mobile ? 390 : 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC",
  });
  const requests = { gear: 0, jquery: 0, viewer: 0, forbidden: 0 };
  const control = { gearGate: null, viewerGate: null, holdModel: false };
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === base.origin && url.pathname === `/api/players/${CHARACTER}/gear`) {
      assert.equal(url.searchParams.get("realm"), REALM, "Every surface forwards the actual realm");
      requests.gear += 1;
      if (control.gearGate) await control.gearGate.promise;
      return route.fulfill({ json: gearResponse(!missingAppearance, cachedAppearance) });
    }
    if (url.href === JQUERY_URL) {
      requests.jquery += 1;
      return route.fulfill({ contentType: "text/javascript", body: jqueryFixture });
    }
    if (url.href === VIEWER_URL) {
      requests.viewer += 1;
      if (control.viewerGate) await control.viewerGate.promise;
      const script = failedViewer
        ? viewerFixture.replace("const target = options.container[0];", "throw new Error('Synthetic renderer unavailable');")
        : unavailableWebgl
          ? viewerFixture.replace("this.mode = ModelViewer.WEBGL;", "this.mode = ModelViewer.FLASH; return;")
          : viewerFixture;
      return route.fulfill({ contentType: "text/javascript", body: `${control.holdModel ? "window.syntheticModelLoaded = false;" : ""}\n${script}` });
    }
    if (url.hostname === "forbidden-model.invalid") requests.forbidden += 1;
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  return { context, requests, control };
}

async function openSurface(page, base, surface) {
  const response = await page.goto(new URL(surface.route, base).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response.status(), 200, surface.name);
  await page.evaluate(() => document.fonts.ready);
  if (surface.accordion) {
    const accordion = page.getByRole("button", { name: new RegExp(`^${surface.accordion}`) });
    if (await accordion.getAttribute("aria-expanded") === "false") await accordion.click();
    await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).opacity === "1", await accordion.getAttribute("aria-controls"));
  }
  const avatar = page.getByRole("button", { name: `View live gear for ${CHARACTER}`, exact: true }).filter({ visible: true });
  await avatar.waitFor({ state: "visible" });
  assert.equal(await avatar.count(), 1, surface.name);
  await avatar.scrollIntoViewIfNeeded();
  assert.equal(await avatar.evaluate(async element => {
    const animations = [];
    for (let node = element; node; node = node.parentElement) {
      animations.push(...node.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)));
    }
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
    return new Promise(resolve => {
      let previous = "";
      let stable = 0;
      const timeout = setTimeout(() => resolve(false), 3000);
      const sample = () => {
        const rect = element.getBoundingClientRect();
        const current = [rect.x, rect.y, rect.width, rect.height].join(",");
        stable = current === previous && rect.width > 0 && rect.height > 0 ? stable + 1 : 0;
        previous = current;
        if (stable >= 8) { clearTimeout(timeout); resolve(true); }
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }), true, `${surface.name}: avatar geometry settles before hover`);
  return avatar;
}

async function visibleModel(page) {
  try {
    await page.locator(FRAME).waitFor({ state: "attached", timeout: 12_000 });
    await page.waitForFunction(selector => {
      const frame = document.querySelector(selector);
      return frame && getComputedStyle(frame).opacity === "1";
    }, FRAME, { timeout: 12_000 });
  } catch (cause) {
    const state = await page.evaluate(selector => ({
      path: location.pathname, tooltip: document.querySelector('[role="tooltip"]')?.textContent,
      frame: document.querySelector(selector)?.outerHTML.slice(0, 300),
    }), FRAME);
    const handle = await page.locator(FRAME).count() ? await page.locator(FRAME).elementHandle() : null;
    const frame = handle && await handle.contentFrame();
    if (frame) state.viewer = await frame.evaluate(() => ({
      checks: window.syntheticModelChecks, loaded: window.syntheticModelLoaded,
      canvas: document.querySelector("canvas")?.outerHTML,
    }));
    throw new Error(`Visible model did not start: ${JSON.stringify(state)}`, { cause });
  }
  const element = await page.locator(FRAME).elementHandle();
  const frame = await element.contentFrame();
  assert.ok(frame);
  assert.equal(await frame.locator('canvas[data-synthetic-model="humanfemale"]').count(), 1);
  assert.equal(await frame.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const pixel = canvas.getContext("2d").getImageData(Math.floor(canvas.width / 2), 30, 1, 1).data;
    return pixel[3] === 255;
  }), true, "The deterministic model actually painted into the canvas");
  const geometry = await page.locator(FRAME).evaluate(element => {
    const rect = node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const center = element.parentElement;
    const grid = center.parentElement;
    return { frame: rect(element), center: rect(center), left: rect(grid.children[0]), right: rect(grid.children[2]),
      tooltip: rect(element.closest('[role="tooltip"]')), viewport: innerWidth };
  });
  assert.ok(geometry.frame.width >= 170 && geometry.frame.height >= 300);
  assert.ok(Math.abs((geometry.frame.x + geometry.frame.width / 2) - (geometry.center.x + geometry.center.width / 2)) <= 1);
  assert.ok(geometry.left.x + geometry.left.width <= geometry.frame.x);
  assert.ok(geometry.frame.x + geometry.frame.width <= geometry.right.x);
  assert.ok(geometry.tooltip.x >= 0 && geometry.tooltip.x + geometry.tooltip.width <= geometry.viewport);
  assert.equal(await page.locator(FRAME).getAttribute("sandbox"), "allow-scripts");
  assert.equal(await page.locator(FRAME).getAttribute("referrerpolicy"), "no-referrer");
  return { frame, geometry };
}

export async function verifyPlayerQuickLooks({ browser, base, out, report, encounterId }) {
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname));
  const cleanup = await ownedRosterFixture();
  const observations = [];
  const surfaces = [
    { name: "guild roster", route: "/guild-roster" },
    { name: "raid session roster", route: report, accordion: "Raid Roster" },
    { name: "encounter roster", route: `/encounters/${encounterId}`, accordion: "Full Roster" },
    { name: "player index", route: "/players" },
    { name: "player detail header", route: `/players/${CHARACTER}` },
    { name: "raid player detail header", route: `${report}/players/${CHARACTER}` },
  ];
  try {
    const { context, requests, control } = await previewContext(browser, base);
    try {
      const page = await context.newPage();
      for (const [index, surface] of surfaces.entries()) {
        await page.mouse.move(0, 0);
        const before = { ...requests };
        const avatar = await openSurface(page, base, surface);
        assert.equal(requests.gear, before.gear, `${surface.name}: rendering must not eagerly fetch gear`);
        assert.equal(requests.viewer, before.viewer, `${surface.name}: rendering must not start the viewer`);
        if (index === 0) {
          control.gearGate = deferred();
          control.viewerGate = deferred();
          control.holdModel = true;
        }
        await avatar.hover();
        const tooltip = page.getByRole("tooltip");
        await tooltip.waitFor();
        if (index === 0) {
          await tooltip.getByText("Loading gear from Warmane…", { exact: true }).waitFor();
          await avatar.focus();
          assert.equal(await avatar.evaluate(element => element === document.activeElement), true);
          assert.equal(requests.gear, before.gear + 1, "Hover/focus share one in-flight gear request");
          control.gearGate.resolve();
          await page.locator(FRAME).waitFor({ state: "attached" });
          await tooltip.getByText("Loading 3D model…", { exact: true }).waitFor();
          await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", {
            source: window, data: { type: "pizza-logs-warmane-model", status: "ready" },
          })));
          assert.equal(await page.locator(FRAME).evaluate(element => getComputedStyle(element).opacity), "0", "Other windows cannot spoof viewer readiness");
          control.viewerGate.resolve();
          const element = await page.locator(FRAME).elementHandle();
          const frame = await element.contentFrame();
          await frame.waitForFunction(() => window.syntheticModelChecks > 0);
          assert.equal(await frame.locator("canvas").count(), 1);
          assert.equal(await page.locator(FRAME).evaluate(element => getComputedStyle(element).opacity), "0", "A sized canvas is not proof that the model loaded");
          await tooltip.getByText("Loading 3D model…", { exact: true }).waitFor();
          await frame.evaluate(() => { window.syntheticModelLoaded = true; });
          control.holdModel = false;
        }
        const { frame, geometry } = await visibleModel(page);
        if (index === 0) {
          assert.equal(await frame.evaluate(() => {
            try { void parent.document.body; return false; } catch { return true; }
          }), true, "The sandbox cannot read the parent document");
          const csp = await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
          assert.match(csp, /default-src 'none'/);
          assert.match(csp, /script-src 'unsafe-inline' https:\/\/ajax\.googleapis\.com https:\/\/cdn\.warmane\.com/);
          assert.equal(await frame.evaluate(() => new Promise(resolve => {
            const script = document.createElement("script");
            script.src = "https://forbidden-model.invalid/blocked.js";
            script.onerror = () => resolve(true);
            script.onload = () => resolve(false);
            document.body.appendChild(script);
          })), true);
          assert.equal(requests.forbidden, 0, "CSP blocks unauthorized scripts before a network request");
        }
        const screenshot = `1440-quicklook-${index}.png`;
        await page.screenshot({ path: path.join(out, screenshot), animations: "disabled" });
        let overlap = null;
        if (surface.name === "player index") {
          overlap = await avatar.evaluate(element => {
            const trigger = element.getBoundingClientRect();
            const panel = document.querySelector('[role="tooltip"]').getBoundingClientRect();
            const left = Math.max(trigger.left, panel.left);
            const right = Math.min(trigger.right, panel.right);
            const top = Math.max(trigger.top, panel.top);
            const bottom = Math.min(trigger.bottom, panel.bottom);
            return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null;
          });
          assert.ok(overlap, "Player-index fixture must exercise a tooltip overlapping its trigger");
          await page.mouse.move(overlap.x, overlap.y);
          assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="tooltip"]'), overlap), true);
          await avatar.evaluate(element => {
            element.dataset.escapeReentry = "pending";
            element.addEventListener("pointerenter", () => { element.dataset.escapeReentry = "observed"; }, { once: true });
          });
        }
        await page.keyboard.press("Escape");
        if (overlap) {
          await page.waitForFunction(element => element.dataset.escapeReentry === "observed", await avatar.elementHandle());
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await tooltip.count(), 0, "Escape remains dismissed when the exposed trigger receives pointerenter");
        }
        await tooltip.waitFor({ state: "detached" });
        if (overlap) {
          await page.mouse.move(0, 0);
          await page.mouse.move(overlap.x, overlap.y);
          await visibleModel(page);
          await page.mouse.move(0, 0);
          await page.keyboard.press("Escape");
          await tooltip.waitFor({ state: "detached" });
          // Escape with the pointer outside must not suppress the next hover.
          await page.mouse.move(overlap.x, overlap.y);
          await visibleModel(page);
          await page.mouse.move(0, 0);
          await page.keyboard.press("Escape");
          await tooltip.waitFor({ state: "detached" });
        }
        // Move focus through the keyboard after Escape; reopening uses the
        // existing response rather than repeating the upstream API request.
        await avatar.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await tooltip.waitFor();
        // Finish this surface's intentional viewer startup before the next
        // surface snapshots the context-wide request counters.
        await visibleModel(page);
        assert.equal(requests.gear, before.gear + 1, `${surface.name}: cached keyboard reopen`);
        await page.keyboard.press("Escape");
        await tooltip.waitFor({ state: "detached" });
        observations.push({ check: `shared quick look: ${surface.name}`, status: "pass", screenshot, geometry });
      }
    } finally {
      control.gearGate?.resolve();
      control.viewerGate?.resolve();
      await context.close();
    }

    const fallbackStates = [
      { missingAppearance: true, check: "missing appearance preserves equipment and portrait fallback" },
      { failedViewer: true, check: "failed viewer reports unavailability without hiding equipment" },
      { unavailableWebgl: true, check: "upstream WebGL fallback explains browser incompatibility without hiding equipment" },
      { cachedAppearance: true, check: "cached appearance remains visible with an honest cached label" },
      { blockedViewer: true, check: "silent blocked viewer reaches the outer timeout while equipment stays readable" },
    ];
    for (const state of fallbackStates) {
      const { context, requests, control } = await previewContext(browser, base, state);
      if (state.blockedViewer) control.viewerGate = deferred();
      try {
        const page = await context.newPage();
        const avatar = await openSurface(page, base, surfaces[3]);
        await avatar.focus();
        const tooltip = page.getByRole("tooltip");
        await tooltip.getByText("Synthetic Mage Hood", { exact: true }).filter({ visible: true }).waitFor();
        if (state.missingAppearance) {
          assert.equal(await page.locator(FRAME).count(), 0);
          assert.equal(requests.viewer, 0);
          await tooltip.getByText("Appearance unavailable from Armory", { exact: true }).waitFor();
        } else if (state.cachedAppearance) {
          await visibleModel(page);
          await tooltip.getByText("· Cached appearance", { exact: true }).waitFor();
        } else {
          if (state.blockedViewer) await tooltip.getByText("Loading 3D model…", { exact: true }).waitFor();
          await tooltip.getByText("3D model unavailable", { exact: true }).waitFor({ timeout: 18_000 });
          if (state.unavailableWebgl) await tooltip.getByText("This browser cannot display 3D models.", { exact: true }).waitFor();
          assert.equal(await page.locator(FRAME).evaluate(element => getComputedStyle(element).opacity), "0");
        }
        assert.equal(await tooltip.locator('div[class*="min-h-80"]').isVisible(), true);
        await page.keyboard.press("Escape");
        await tooltip.waitFor({ state: "detached" });
        observations.push({ check: state.check, status: "pass" });
      } finally {
        control.viewerGate?.resolve();
        await context.close();
      }
    }

    const { context: mobileContext, requests: mobileRequests } = await previewContext(browser, base, { mobile: true });
    try {
      const page = await mobileContext.newPage();
      const avatar = await openSurface(page, base, surfaces[3]);
      await avatar.tap();
      const tooltip = page.getByRole("tooltip");
      await tooltip.getByText("Synthetic Mage Hood", { exact: true }).filter({ visible: true }).waitFor();
      assert.equal(await page.locator(FRAME).count(), 0);
      assert.equal(mobileRequests.jquery + mobileRequests.viewer, 0, "Compact touch preview loads no model scripts");
      await page.screenshot({ path: path.join(out, "390-quicklook-compact.png"), animations: "disabled" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await visibleModel(page);
      assert.equal(mobileRequests.gear, 1, "Late desktop resize reuses gear without a refresh");
      await page.keyboard.press("Escape");
      await tooltip.waitFor({ state: "detached" });
      observations.push({ check: "compact touch preview, no mobile viewer requests, late desktop resize starts visible model", status: "pass" });
    } finally { await mobileContext.close(); }
  } finally {
    await cleanup();
  }
  observations.push({ check: "exact owned synthetic roster row removed and absence verified", status: "pass" });
  return observations;
}
