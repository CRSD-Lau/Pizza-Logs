import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

// Read-only browser checks. Run test:e2e first to create the synthetic fixtures.
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "UX checks require an isolated loopback stack");
assert.equal(base.username + base.password, "", "Do not put credentials in the browser URL");
const out = path.resolve(process.env.PIZZA_UX_ARTIFACTS ?? ".test-artifacts/ux-navigation");
await fs.mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const observations = [];
const failures = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
// Do not depend on third-party images/models for navigation or accessibility.
// Application pages and report data are real responses from the local stack.
await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
const page = await context.newPage();
page.setDefaultTimeout(12_000);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push({ route: page.url(), message: error.message }));

async function poll(check, message, timeout = 12_000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < end);
  throw new Error(message);
}
async function readDuplicateIds(targetPage) {
  return targetPage.locator("[id]").evaluateAll(elements => {
    const ids = elements.map(element => element.id);
    return [...new Set(ids)].filter(id => ids.filter(candidate => candidate === id).length > 1);
  });
}
async function settledDuplicateIds(targetPage, timeout = 12_000) {
  const end = Date.now() + timeout;
  let duplicates = await readDuplicateIds(targetPage);
  // React's streamed Suspense HTML temporarily contains both the fallback and a
  // hidden completed segment until its scheduled swap runs. Keep hidden IDs in
  // the audit and return any duplicates that persist beyond the settling window.
  while (duplicates.length > 0 && Date.now() < end) {
    await new Promise(resolve => setTimeout(resolve, Math.min(50, Math.max(0, end - Date.now()))));
    duplicates = await readDuplicateIds(targetPage);
  }
  return duplicates;
}
async function verifyDuplicateIdSettling(context) {
  const probe = await context.newPage();
  try {
    await probe.setContent('<div id="transient-probe"></div><div hidden id="transient-probe" data-completed></div>');
    assert.deepEqual(await readDuplicateIds(probe), ["transient-probe"]);
    await probe.evaluate(() => { setTimeout(() => document.querySelector("[data-completed]").remove(), 150); });
    assert.deepEqual(await settledDuplicateIds(probe, 2_000), [], "A temporary streamed duplicate must settle");
    await probe.setContent('<div id="persistent-probe"></div><div hidden id="persistent-probe"></div>');
    assert.deepEqual(await settledDuplicateIds(probe, 150), ["persistent-probe"], "Persistent hidden duplicates must still fail the audit");
  } finally {
    await probe.close();
  }
}
async function visit(route, expectedStatus = 200) {
  const previousUrl = new URL(page.url());
  const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (response) assert.equal(response.status(), expectedStatus, `${route} response`);
  else {
    // Browsers perform same-document hash navigation without a new HTTP request.
    const currentUrl = new URL(page.url());
    assert.equal(currentUrl.pathname + currentUrl.search, previousUrl.pathname + previousUrl.search);
    assert.equal(expectedStatus, 200);
  }
  await page.locator("main").waitFor();
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
}
async function check(name, run, recordPass = true) {
  try {
    const details = await run();
    if (recordPass) observations.push({ check: name, status: "pass", ...details });
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ check: name, error: error.stack ?? String(error) });
    console.error(`FAIL ${name}: ${error.message}`);
    await page.screenshot({ path: path.join(out, `failure-${observations.length}-${failures.length}.png`), fullPage: true, animations: "disabled" }).catch(() => {});
  }
}
const idFromHref = href => new URL(href, base).pathname.split("/").at(-1);
const shortDate = value => new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
async function encounterLinks(scope = page.locator("main")) {
  return scope.locator('a[href^="/encounters/"]').evaluateAll(links => links.map(link => link.getAttribute("href")));
}
async function applyDifficulty(value) {
  await page.getByLabel("Difficulty", { exact: true }).selectOption(value);
  await Promise.all([
    page.waitForURL(url => url.searchParams.get("difficulty") === value),
    page.getByRole("button", { name: "Apply filters", exact: true }).click(),
  ]);
  await page.evaluate(() => document.fonts.ready);
}
async function audit(route, width, screenshotName) {
  await page.setViewportSize({ width, height: 1000 });
  await visit(route);
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main *")].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1) && getComputedStyle(element).position !== "fixed";
    }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className, text: element.textContent?.trim().slice(0, 80) })),
  }));
  if (overflow.documentWidth > width) failures.push({ route, width, issue: "horizontal overflow", ...overflow });
  const clippedNames = ["/weekly", "/leaderboards"].includes(route) ? await page.locator('main a[href^="/players/"] > span').evaluateAll(names => names.filter(name => name.getBoundingClientRect().width > 0 && name.scrollWidth > name.clientWidth + 1).map(name => ({ text: name.textContent, width: name.clientWidth, requiredWidth: name.scrollWidth }))) : [];
  if (clippedNames.length > 0) failures.push({ route, width, issue: "leaderboard player names clipped", clippedNames });
  await page.evaluate(axeSource);
  const accessibility = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return {
      violations: result.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })),
      incomplete: result.incomplete.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })),
      passes: result.passes.length,
    };
  });
  failures.push(...accessibility.violations.map(item => ({ route, width, ...item })));
  const duplicateIds = await settledDuplicateIds(page);
  if (duplicateIds.length > 0) failures.push({ route, width, issue: "duplicate element IDs", duplicateIds });
  await page.screenshot({ path: path.join(out, screenshotName), fullPage: true, animations: "disabled" });
  observations.push({ check: "public page accessibility and overflow", route, width, status: accessibility.violations.length === 0 && overflow.documentWidth <= width && clippedNames.length === 0 && duplicateIds.length === 0 ? "pass" : "fail", accessibility, clippedNames, duplicateIds, screenshot: screenshotName });
  console.log(`RENDER ${width} ${route}: ${accessibility.violations.length} axe violations, overflow=${overflow.documentWidth > width}`);
}

try {
  await check("duplicate-ID audit tolerates streamed swaps and catches persistent hidden duplicates", () => verifyDuplicateIdSettling(context));
  const response = await fetch(new URL("/api/encounters?take=200", base), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, "Synthetic fixture discovery API");
  const encounters = await response.json();
  const phyre = encounters.find(encounter => encounter.participants.some(participant => participant.player.name === "Phyre"));
  const policy = encounters.find(encounter => encounter.upload.filename === "synthetic-short-pulls.txt" && encounter.outcome === "KILL");
  assert.ok(phyre && policy, "Run test:e2e first: frozen Phyre and current-week short-pull fixtures are required");
  const byId = new Map(encounters.map(encounter => [encounter.id, encounter]));
  await visit(`/uploads/${phyre.uploadId}/sessions/${phyre.sessionIndex}`);
  const report = new URL(page.url()).pathname;
  assert.match(report, /^\/raids\/[^/]+\/sessions\/[^/]+$/, "Legacy fixture route must resolve to its public raid URL");
  const bossPath = `/bosses/${policy.boss.slug}`;
  observations.push({ check: "read-only synthetic fixture discovery", status: "pass", report, encounterId: phyre.id, weeklyEncounterId: policy.id, weeklyDate: policy.startedAt });

  await check("weekly rows show actual encounter dates and working report links", async () => {
    await visit("/weekly");
    assert.equal(await page.getByRole("heading", { name: "Top DPS Attempts This Week", exact: true }).count(), 1);
    const links = page.getByRole("link", { name: /^View .+ attempt$/ });
    assert.ok(await links.count() > 0, "Weekly DPS fixture must be visible");
    const evidence = [];
    for (const link of await links.all()) {
      const href = await link.getAttribute("href");
      const encounter = byId.get(idFromHref(href));
      assert.ok(encounter, `Weekly link must identify a persisted encounter: ${href}`);
      const rowText = await link.locator("../..").innerText();
      assert.ok(rowText.includes(shortDate(encounter.startedAt)), `Row must show actual date ${shortDate(encounter.startedAt)}: ${rowText}`);
      evidence.push({ href, date: shortDate(encounter.startedAt) });
    }
    assert.ok(evidence.some(item => idFromHref(item.href) === policy.id), "Current-week kill must be linked");
    assert.equal(await page.getByText("Week view", { exact: true }).count(), 0);
    await links.filter({ hasText: "View" }).first().click();
    await page.waitForURL(/\/encounters\//);
    assert.ok(await page.getByRole("heading", { level: 1 }).innerText());
    return { evidence };
  });

  await check("weekly difficulty selection preserves other query values and short-pull toggle", async () => {
    await visit("/weekly?includeShortPulls=1&context=ux&context=second");
    await applyDifficulty(policy.difficulty);
    const query = new URL(page.url()).searchParams;
    assert.deepEqual(query.getAll("context"), ["ux", "second"]);
    assert.equal(query.get("includeShortPulls"), "1");
    const links = await encounterLinks();
    assert.ok(links.length > 0);
    for (const href of links) assert.equal(byId.get(idFromHref(href)).difficulty, policy.difficulty);
    const notice = page.locator("details").filter({ has: page.getByRole("link", { name: "Exclude short pulls", exact: true, includeHidden: true }) });
    await notice.locator("summary").click();
    await page.getByRole("link", { name: "Exclude short pulls", exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has("includeShortPulls"));
    assert.equal(new URL(page.url()).searchParams.get("difficulty"), policy.difficulty);
    assert.deepEqual(new URL(page.url()).searchParams.getAll("context"), ["ux", "second"]);
  });

  await check("unknown and empty difficulty are explicit; invalid difficulty defaults to pooled data", async () => {
    await visit("/weekly?difficulty=UNKNOWN");
    assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), "UNKNOWN");
    const unknown = await encounterLinks();
    for (const href of unknown) assert.equal(byId.get(idFromHref(href)).difficulty, "UNKNOWN");
    if (unknown.length === 0) await page.getByText("No damage attempts for this selection", { exact: true }).waitFor();
    await applyDifficulty("10H");
    for (const href of await encounterLinks()) assert.equal(byId.get(idFromHref(href)).difficulty, "10H");
    await visit("/weekly?difficulty=invalid-mode&context=ux");
    assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), "all");
    await page.getByText(/All difficulties pooled/).waitFor();
    assert.ok((await encounterLinks()).some(href => idFromHref(href) === policy.id));
  });

  await check("leaderboard boss selection and difficulty filter lead to matching attempts", async () => {
    await visit("/leaderboards?context=ux&includeShortPulls=1");
    await page.getByLabel("Boss", { exact: true }).selectOption(policy.boss.slug);
    await applyDifficulty(policy.difficulty);
    assert.equal(new URL(page.url()).searchParams.get("boss"), policy.boss.slug);
    assert.equal(new URL(page.url()).searchParams.get("context"), "ux");
    const boards = page.locator('main section[id^="boss-"]');
    assert.equal(await boards.count(), 1);
    assert.equal(await boards.first().getAttribute("id"), `boss-${policy.boss.slug}`);
    const links = await encounterLinks();
    assert.ok(links.length > 0);
    for (const href of links) {
      const encounter = byId.get(idFromHref(href));
      assert.equal(encounter.boss.slug, policy.boss.slug);
      assert.equal(encounter.difficulty, policy.difficulty);
      assert.equal(encounter.outcome, "KILL");
    }
    await page.getByRole("link", { name: `View ${policy.boss.name} history`, exact: false }).click();
    await page.waitForURL(url => url.pathname === bossPath && url.hash === "#boss-history");
    assert.equal(new URL(page.url()).searchParams.get("difficulty"), policy.difficulty);
    assert.equal(new URL(page.url()).searchParams.get("context"), "ux");
    await visit("/leaderboards?boss=invalid-boss&difficulty=invalid-mode");
    assert.equal(await page.getByLabel("Boss", { exact: true }).inputValue(), "");
    assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), "all");
    assert.ok(await page.locator('main section[id^="boss-"]').count() > 0);
  });

  await check("boss index and history retain filters without mixing raid sizes", async () => {
    await visit("/bosses?includeShortPulls=1&context=ux");
    await applyDifficulty(policy.difficulty);
    assert.equal(new URL(page.url()).searchParams.get("includeShortPulls"), "1");
    const bossLink = page.locator(`main a[href^="${bossPath}?"]`).first();
    await bossLink.click();
    await page.waitForURL(url => url.pathname === bossPath);
    assert.equal(new URL(page.url()).searchParams.get("difficulty"), policy.difficulty);
    const history = await encounterLinks(page.locator("#boss-history"));
    assert.ok(history.length > 0);
    for (const href of history) assert.equal(byId.get(idFromHref(href)).difficulty, policy.difficulty);
    await applyDifficulty("UNKNOWN");
    for (const href of await encounterLinks(page.locator("#boss-history"))) assert.equal(byId.get(idFromHref(href)).difficulty, "UNKNOWN");
    await page.getByText(/Unknown difficulty only/).waitFor();
    await visit(`${bossPath}?difficulty=invalid-mode`);
    assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), "all");
    assert.ok((await encounterLinks(page.locator("#boss-history"))).length > 0);
  });

  await check("native section links open collapsed rankings with keyboard and browser history", async () => {
    await visit(bossPath);
    const dps = page.locator("#boss-dps h2 button");
    const hps = page.locator("#boss-hps h2 button");
    assert.equal(await dps.getAttribute("aria-expanded"), "false");
    assert.equal(await hps.getAttribute("aria-expanded"), "false");
    const nav = page.getByRole("navigation", { name: "Boss page sections", exact: true });
    await nav.getByRole("link", { name: "DPS rankings", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(url => url.hash === "#boss-dps");
    await poll(async () => await dps.getAttribute("aria-expanded") === "true", "DPS hash must reveal rankings");
    await poll(() => dps.evaluate(button => button === document.activeElement), "Hash destination heading must receive focus");
    await page.keyboard.press("Enter");
    await poll(async () => await dps.getAttribute("aria-expanded") === "false", "Enter on the focused ranking heading must collapse it");
    await nav.getByRole("link", { name: "HPS rankings", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(url => url.hash === "#boss-hps");
    await poll(async () => await hps.getAttribute("aria-expanded") === "true", "HPS hash must reveal rankings");
    await page.goBack();
    await page.waitForURL(url => url.hash === "#boss-dps");
    await poll(async () => await dps.getAttribute("aria-expanded") === "true", "Back navigation must reopen collapsed DPS destination");
    await nav.getByRole("link", { name: "Fight history", exact: true }).click();
    await page.waitForURL(url => url.hash === "#boss-history");
    assert.ok(await page.locator("#boss-history").isVisible());
    await visit(`${bossPath}#boss-hps`);
    await poll(async () => await hps.getAttribute("aria-expanded") === "true", "A direct bookmarked hash must reveal its section");
  });

  await check("boss and encounter round trip preserves only validated comparison filters", async () => {
    await visit(`${bossPath}?difficulty=${policy.difficulty}&includeShortPulls=1&context=ux`);
    await page.locator(`#boss-history a[href^="/encounters/${policy.id}?"]`).click();
    await page.waitForURL(url => url.pathname === `/encounters/${policy.id}`);
    const bossLink = page.locator(`main a[href^="${bossPath}?"]`).first();
    const back = new URL(await bossLink.getAttribute("href"), base);
    assert.equal(back.searchParams.get("difficulty"), policy.difficulty);
    assert.equal(back.searchParams.get("includeShortPulls"), "1");
    assert.equal(back.searchParams.has("context"), false);
    const unrelated = await page.locator('main a[href^="/raids"], main a[href^="/players/"]').evaluateAll(links => links.map(link => link.getAttribute("href")));
    for (const href of unrelated) {
      const query = new URL(href, base).searchParams;
      assert.equal(query.has("difficulty"), false, "Comparison difficulty is not a raid or player report filter");
      assert.equal(query.has("context"), false);
    }
    await bossLink.click();
    await page.waitForURL(url => url.pathname === bossPath);
    assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), policy.difficulty);

    const short = encounters.filter(encounter => encounter.upload.filename === "synthetic-short-pulls.txt" && encounter.outcome === "WIPE")
      .sort((left, right) => left.durationMs - right.durationMs)[0];
    assert.ok(short, "Short-pull fixture must exist");
    await visit(`/encounters/${short.id}?difficulty=${policy.difficulty}&context=ux`);
    for (const [label, included] of [["Include short pulls", true], ["Exclude short pulls", false]]) {
      const link = page.getByRole("link", { name: label, exact: true, includeHidden: true });
      const notice = page.locator("details").filter({ has: link });
      if (await notice.getAttribute("open") === null) await notice.locator("summary").click();
      await page.getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL(url => url.searchParams.has("includeShortPulls") === included);
      const query = new URL(page.url()).searchParams;
      assert.equal(query.get("difficulty"), policy.difficulty);
      assert.equal(query.has("context"), false);
    }
    await visit(`/encounters/${short.id}?difficulty=invalid-mode&context=ux`);
    for (const href of await page.locator('main a[href^="/bosses"]').evaluateAll(links => links.map(link => link.getAttribute("href")))) {
      assert.equal(new URL(href, base).searchParams.has("difficulty"), false, "Invalid difficulty must not propagate");
      assert.equal(new URL(href, base).searchParams.has("context"), false);
    }
  });

  await check("shared player search exposes active descendant and supports Escape and Enter", async () => {
    await visit("/players");
    const input = page.getByRole("combobox", { name: "Search players", exact: true }).filter({ visible: true });
    await input.fill("Phy");
    const listbox = page.getByRole("listbox", { name: "Player search results", exact: true });
    await listbox.waitFor();
    await input.press("ArrowDown");
    const activeId = await input.getAttribute("aria-activedescendant");
    assert.ok(activeId);
    const active = page.locator(`[id="${activeId}"]`);
    assert.equal(await active.getAttribute("role"), "option");
    assert.equal(await active.getAttribute("aria-selected"), "true");
    assert.match(await active.innerText(), /Phyre/);
    await input.press("Escape");
    assert.equal(await input.getAttribute("aria-expanded"), "false");
    assert.equal(await input.getAttribute("aria-activedescendant"), null);
    await input.press("Enter");
    assert.equal(new URL(page.url()).pathname, "/players", "Enter after Escape must not navigate hidden results");
    await input.press("ArrowDown");
    await input.press("Enter");
    await page.waitForURL(url => url.pathname === "/players/Phyre");
  });

  await check("pending and superseded search requests cannot navigate or restore stale results", async () => {
    await visit("/players");
    const waiting = new Map();
    const releases = new Map();
    let pendingFinished = false;
    const result = name => ({ name, profilePath: `/players/${name}`, realmName: "Lordaeron", className: "Rogue", raceName: "Human", level: 80, guildName: null, source: "logs" });
    const handler = async route => {
      const query = new URL(route.request().url()).searchParams.get("q");
      if (!["Old", "Pending", "Newest"].includes(query)) return route.fallback();
      if (query === "Pending") await new Promise(resolve => { releases.set(query, resolve); waiting.set(query, true); });
      await route.fulfill({ json: { ok: true, query, results: [result(query === "Old" || query === "Pending" ? "Phyre" : "SyntheticFirst")] } }).catch(() => {});
      if (query === "Pending") pendingFinished = true;
    };
    await context.route("**/api/players/search?**", handler);
    try {
      const input = page.getByRole("combobox", { name: "Search players", exact: true }).filter({ visible: true });
      await input.fill("Old");
      await page.getByRole("option").filter({ hasText: "Phyre" }).waitFor();
      await input.press("ArrowDown");
      await input.fill("Pending");
      await input.press("Enter");
      assert.equal(new URL(page.url()).pathname, "/players", "Changed query must immediately invalidate the old selection before debounce");
      await poll(() => waiting.get("Pending"), "Delayed search request must start");
      await input.press("Enter");
      assert.equal(new URL(page.url()).pathname, "/players", "Pending response must not expose stale navigation");
      assert.equal(await input.getAttribute("aria-activedescendant"), null);
      await input.fill("Newest");
      await page.getByRole("option").filter({ hasText: "SyntheticFirst" }).waitFor();
      releases.get("Pending")();
      await poll(() => pendingFinished, "Superseded request must finish before checking its effect");
      assert.equal(await page.getByRole("option").filter({ hasText: "Phyre" }).count(), 0);
      await input.press("ArrowDown");
      await input.press("Enter");
      await page.waitForURL(url => url.pathname === "/players/SyntheticFirst");
    } finally {
      for (const release of releases.values()) release();
      await context.unroute("**/api/players/search?**", handler);
    }
  });

  await check("keyboard search keeps the last and first of 12 options visible", async () => {
    await visit("/players");
    const handler = route => route.fulfill({ json: { ok: true, query: "Many", results: Array.from({ length: 12 }, (_, index) => ({
      name: `SyntheticOption${index + 1}`, profilePath: "/players/Phyre", realmName: "Lordaeron", className: "Mage", raceName: "Human", level: 80, guildName: "Synthetic Guild", source: "logs",
    })) } });
    await context.route("**/api/players/search?q=Many", handler);
    try {
      const input = page.getByRole("combobox", { name: "Search players", exact: true }).filter({ visible: true });
      await input.fill("Many");
      await page.getByRole("option").nth(11).waitFor({ state: "attached" });
      await input.press("ArrowUp");
      const optionIsVisible = async index => {
        const activeId = await input.getAttribute("aria-activedescendant");
        if (!activeId) return false;
        return page.locator(`[id="${activeId}"]`).evaluate((option, expectedIndex) => {
          const panel = option.parentElement.parentElement;
          const rowBounds = option.getBoundingClientRect();
          const panelBounds = panel.getBoundingClientRect();
          return option.id.endsWith(`-option-${expectedIndex}`) && rowBounds.top >= panelBounds.top - 1 && rowBounds.bottom <= panelBounds.bottom + 1;
        }, index);
      };
      await poll(() => optionIsVisible(11), "ArrowUp from no selection must reveal the last option inside the scroll panel");
      await input.press("ArrowDown");
      await poll(() => optionIsVisible(0), "ArrowDown wrapping to first must scroll back to the first option");
      await input.press("Escape");
    } finally {
      await context.unroute("**/api/players/search?q=Many", handler);
    }
  });

  await check("1024px navigation identifies the current page and Escape restores menu focus", async () => {
    await page.setViewportSize({ width: 1024, height: 1000 });
    await visit("/players");
    const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
    assert.equal(await toggle.getAttribute("aria-controls"), "mobile-navigation");
    await toggle.click();
    const menu = page.locator("#mobile-navigation");
    await menu.waitFor();
    assert.equal(await menu.getByRole("link", { name: "Players", exact: true }).getAttribute("aria-current"), "page");
    await menu.getByRole("link", { name: "Players", exact: true }).focus();
    await page.keyboard.press("Escape");
    await poll(async () => await menu.count() === 0, "Escape must close menu");
    assert.equal(await page.getByRole("button", { name: "Open navigation", exact: true }).evaluate(button => button === document.activeElement), true);
  });

  await check("skip link moves keyboard focus to main content", async () => {
    await visit("/raids");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content", exact: true });
    assert.equal(await skip.evaluate(link => link === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.waitForURL(url => url.hash === "#main-content");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");
  });

  await check("404 page provides working raid and player recovery links", async () => {
    await visit("/synthetic-ux-missing-page", 404);
    await page.getByRole("heading", { name: "Page not found", exact: true }).waitFor();
    await page.locator("main").getByRole("link", { name: "Browse raids", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/raids");
    await visit("/synthetic-ux-missing-page", 404);
    await page.locator("main").getByRole("link", { name: "Find a player", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/players");
  });

  // Twelve representative public routes; private admin and upload submission
  // have separate security/journey tests. Axe includes contrast with no exclusions.
  const routes = ["/", "/raids", "/bosses", bossPath, "/leaderboards", "/players", "/weekly", "/guild-roster", report, `/encounters/${phyre.id}`, "/players/Phyre", `${report}/players/Phyre`];
  for (const width of [375, 768, 1024, 1440]) {
    for (const [index, route] of routes.entries()) {
      await check(`render ${width}px ${route}`, () => audit(route, width, `${width}-${index}-${route.replaceAll("/", "_")}.png`), false);
    }
  }
  failures.push(...pageErrors.map(error => ({ issue: "uncaught browser error", ...error })));
} catch (error) {
  failures.push({ check: "setup or unhandled error", error: error.stack ?? String(error) });
} finally {
  await browser.close();
  const evidence = { author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell", generatedAt: new Date().toISOString(), base: base.origin, readOnly: true, limitations: ["Synthetic local reports; no production data or writes.", "Browser third-party assets blocked; upstream model rendering is validated by the separate quick-look tests.", "Axe is automated coverage; incomplete results and screenshots need manual review."], observations, failures };
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify({ observations: observations.length, failures: failures.length, artifact: path.join(out, "results.json") }));
assert.equal(failures.length, 0, `UX navigation/accessibility checks failed; see ${path.join(out, "results.json")}`);
