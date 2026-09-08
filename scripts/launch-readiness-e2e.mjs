import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

// GET-only acceptance: safe against a disposable stack or the public deployment.
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? process.env.PIZZA_LOGS_BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(base.username + base.password, "");
const out = path.resolve(process.env.PIZZA_LAUNCH_ARTIFACTS ?? ".test-artifacts/launch-readiness");
await fs.mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const observations = [];
const failures = [];
const browser = await chromium.launch({ headless: true });

async function audit(page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return {
      violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
      incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) })),
    };
  });
}

try {
  const request = await browser.newContext();
  await request.route("**/*", r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.abort());
  const discovery = await request.newPage();
  await discovery.goto(new URL("/raids", base).href);
  await waitForPageContent(discovery);
  const report = await discovery.locator('main a[href^="/raids/"][href*="/sessions/"]').first().getAttribute("href");
  assert.ok(report, "A real or synthetic report must be available for layout acceptance");
  await request.close();
  const routes = ["/", "/privacy", "/terms", "/upload-policy", "/raids", "/players", "/leaderboards", "/bosses", report];
  for (const width of [375, 1440]) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.route("**/*", r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.abort());
      await context.addInitScript(() => {
        window.__layoutShifts = [];
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__layoutShifts.push({ value: entry.value, time: entry.startTime, sources: entry.sources?.map(s => ({ tag: s.node?.tagName, className: s.node?.className })) });
        }).observe({ type: "layout-shift", buffered: true });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      try {
        const response = await page.goto(new URL(route, base).href, { waitUntil: "load", timeout: 45_000 });
        assert.equal(response.status(), 200);
        await waitForPageContent(page);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const accessibility = await audit(page);
        const layout = await page.evaluate(() => {
          let cls = 0, session = 0, start = 0, last = 0;
          for (const shift of window.__layoutShifts) {
            if (shift.time - last < 1000 && shift.time - start < 5000) session += shift.value;
            else { session = shift.value; start = shift.time; }
            last = shift.time;
            cls = Math.max(cls, session);
          }
          return { cls, shifts: window.__layoutShifts, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family), title: document.title };
        });
        const entry = { route, width, ...layout, ...accessibility, errors };
        observations.push(entry);
        if (layout.cls > 0.1) failures.push({ route, width, issue: "initial lab CLS exceeds 0.1", cls: layout.cls });
        if (layout.scrollWidth > width) failures.push({ route, width, issue: "horizontal overflow" });
        failures.push(...accessibility.violations.map(v => ({ route, width, ...v })), ...errors.map(message => ({ route, width, message })));
        assert.equal(await page.locator('footer a[href="/privacy"]').count(), 1);
        assert.equal(await page.locator('footer a[href="/terms"]').count(), 1);
        if (route === "/") {
          await page.keyboard.press("Tab");
          assert.equal(await page.locator(".skip-link").evaluate(e => e === document.activeElement), true);
          await page.keyboard.press("Enter");
          assert.equal(await page.locator("main").evaluate(e => e === document.activeElement), true);
          const character = page.getByLabel("Character (required)");
          await character.fill("Reviewmage");
          const agreement = page.getByRole("checkbox").first();
          assert.equal(await agreement.isChecked(), false);
          await agreement.check();
          await agreement.uncheck();
          if (width === 375) {
            const menu = page.getByRole("button", { name: "Open navigation" });
            await menu.click();
            assert.equal(await page.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded"), "true");
            failures.push(...(await audit(page)).violations.map(v => ({ route, width, state: "menu open", ...v })));
            await page.keyboard.press("Escape");
            assert.equal(await menu.evaluate(e => e === document.activeElement), true);
          }
          await page.getByRole("button", { name: /Watch guild intro/i }).click();
          await page.getByRole("dialog").waitFor();
          failures.push(...(await audit(page)).violations.map(v => ({ route, width, state: "intro open", ...v })));
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
        await page.screenshot({ path: path.join(out, `${width}-${route.replaceAll(/[^a-z0-9]/gi, "-") || "home"}.png`), fullPage: true });
        console.log(`${width} ${route}: CLS=${layout.cls.toFixed(3)}, axe=${accessibility.violations.length}, incomplete=${accessibility.incomplete.length}`);
      } catch (e) {
        failures.push({ route, width, error: e.message });
        console.error(`FAIL ${width} ${route}: ${e.message}`);
      } finally { await context.close(); }
    }
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJS.newPage();
  for (const route of ["/privacy", "/terms"]) {
    await page.goto(new URL(route, base).href);
    assert.ok((await page.locator("main").innerText()).length > 1000, "Policies remain readable without JavaScript");
  }
  await noJS.close();
} finally {
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ base: base.origin, observations, failures }, null, 2));
  await browser.close();
}
assert.deepEqual(failures, [], "Launch acceptance findings must be resolved; inspect results.json");
console.log(`Launch acceptance passed (${observations.length} page/viewport checks plus keyboard, dialogs and no-JS policies).`);
