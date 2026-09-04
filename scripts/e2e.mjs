import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("E2E uploads are restricted to an isolated loopback test stack.");
}
const out = path.resolve(process.env.PIZZA_TEST_ARTIFACTS ?? ".test-artifacts/e2e");
await fs.mkdir(out, { recursive: true });
const observations = [];
let stackReady = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    stackReady = (await fetch(new URL("/api/health/ready", base), { signal: AbortSignal.timeout(2000) })).ok;
  } catch { /* container startup may still be applying migrations */ }
  if (stackReady) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.equal(stackReady, true, "Isolated stack must become ready before upload tests");
async function upload(bytes, filename = "synthetic.txt") {
  const params = new URLSearchParams({ filename, fileSize: String(bytes.length), uploaderName: "Audit", guildName: "Synthetic Audit" });
  const response = await fetch(new URL(`/api/upload?${params}`, base), {
    method: "POST", body: bytes, signal: AbortSignal.timeout(120000),
    headers: { "content-type": "application/octet-stream", "x-upload-id": randomUUID() },
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.some(event => event.type === "error"), false, JSON.stringify(events));
  const complete = events.find(event => event.type === "complete");
  assert.ok(complete, "Upload must complete and persist");
  return complete.result;
}
const input = await fs.readFile(new URL("../parser/tests/fixtures/icc-25n-synthetic/combatlog.txt", import.meta.url));
const first = await upload(input);
const duplicates = await Promise.all([upload(input), upload(input)]);
assert.ok(duplicates.every(result => result.status === "DUPLICATE" && result.uploadId === first.uploadId));
observations.push({ check: "upload and concurrent duplicate", status: "pass" });
const archived = spawnSync(process.env.PARSER_CONTRACT_PYTHON ?? "python", ["-c",
  "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED); z.writestr('synthetic.txt',sys.stdin.buffer.read()); z.close(); sys.stdout.buffer.write(b.getvalue())",
], { input, maxBuffer: 1024 * 1024 });
assert.equal(archived.status, 0, "Python must generate the synthetic archive");
await upload(archived.stdout, "synthetic.zip");
observations.push({ check: "ZIP upload through web, parser and persistence", status: "pass" });
for (const endpoint of ["/api/encounters?take=-1", "/api/encounters?skip=NaN", "/api/leaderboard?metric=invalid"]) {
  assert.equal((await fetch(new URL(endpoint, base))).status, 400);
}
assert.equal((await fetch(new URL("/api/guild-roster/sync", base), { method: "POST", body: "null", headers: { "content-type": "application/json" } })).status, 400);
assert.equal((await fetch(new URL("/admin", base), { redirect: "manual" })).status, 307);
assert.equal((await fetch(new URL("/api/health/ready", base))).status, 200);
const report = `/raids/${first.publicReportSlug}/sessions/${first.firstSessionSlug}`;
const encounters = await (await fetch(new URL("/api/encounters", base))).json();
const encounter = encounters.find(value => value.uploadId === first.uploadId);
assert.ok(encounter);
assert.equal(encounter.totalDamage, 54000, "Rendered report input uses the frozen synthetic damage primitive");
assert.equal(encounter.durationMs, 26000);
const routes = ["/", "/raids", "/bosses", "/leaderboards", "/players", "/weekly", "/guild-roster", "/admin/login", report, `/encounters/${encounter.id}`, "/players/Phyre"];
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  // Fix browser assets; server-side Warmane fallback is separately bounded.
  // Use an egress-isolated container network for completely offline rendering.
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const started = performance.now();
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(response.status(), 200, route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) failures.push({ route, width, issue: "horizontal overflow" });
      if (width === 390 || width === 1440) {
        await page.evaluate(axe);
        const accessibility = await page.evaluate(async () => {
          const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
          return result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }));
        });
        failures.push(...accessibility.map(item => ({ route, width, ...item })));
      }
      const screenshot = `${width}-${route.replaceAll("/", "_")}.png`;
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: "disabled" });
      observations.push({ route, width, status: response.status(), elapsedMs: Math.round(performance.now() - started), screenshot });
    }
  }
  await page.goto(new URL(report, base).href);
  assert.match(await page.locator("main").innerText(), /54[.,]0K|54,000/, "UI must display the same damage primitive");
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
  await page.goto(base.href);
  await page.getByLabel("Character", { exact: false }).fill("Synthetic Auditor");
  await context.route("**/api/upload?**", async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose File", exact: true }).click();
  await (await chooser).setFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: input });
  await page.getByRole("progressbar", { name: "Combat log upload" }).waitFor();
  await page.screenshot({ path: path.join(out, "1920-upload-progress.png"), fullPage: true });
  await page.getByText("Already Parsed", { exact: true }).waitFor();
  await page.getByRole("link", { name: /View your raid report/ }).click();
  await page.waitForURL(new URL(report, base).href);
  assert.match(await page.locator("main").innerText(), /54[.,]0K|54,000/);
  observations.push({ check: "native file chooser, announced progress and duplicate report navigation", status: "pass" });
  await page.goto(base.href);
  await page.getByLabel("Character", { exact: false }).fill("Synthetic Auditor");
  const invalidChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose File", exact: true }).click();
  await (await invalidChooser).setFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("This is deliberately not a combat log.") });
  await page.getByRole("alert").filter({ hasText: "Upload Failed" }).waitFor();
  assert.doesNotMatch(await page.getByRole("alert").innerText(), /Traceback|postgresql:|node_modules/);
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await page.getByRole("button", { name: "Choose File", exact: true }).waitFor();
  observations.push({ check: "invalid log error announcement and retry", status: "pass" });
  const adminSecret = process.env.PIZZA_TEST_ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  assert.ok(adminSecret, "Set the isolated stack's test admin secret for authenticated acceptance");
  await page.goto(new URL("/admin/login", base).href);
  await page.getByLabel("Admin Secret").fill(adminSecret);
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await page.waitForURL(new URL("/admin", base).href);
  assert.match(await page.locator("main").innerText(), /Diagnostics/i);
  await page.evaluate(axe);
  const adminViolations = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })));
  failures.push(...adminViolations.map(item => ({ route: "/admin", width: 1920, ...item })));
  await page.screenshot({ path: path.join(out, "1920-admin-authenticated.png"), fullPage: true });
  observations.push({ check: "authenticated admin diagnostics, no destructive actions", status: "pass" });
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations, failures }, null, 2));
}
assert.equal(failures.length, 0, JSON.stringify(failures));
console.log(`E2E passed: text/ZIP upload, duplicate persistence, API validation, admin isolation and login, ${observations.filter(item => item.route).length} responsive renders, accessibility.`);
