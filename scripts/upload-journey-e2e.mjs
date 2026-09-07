import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
assert.ok(["http:", "https:"].includes(base.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use an isolated loopback test stack");
const out = path.resolve(process.env.PIZZA_UX_UPLOAD_ARTIFACTS ?? ".test-artifacts/ux-upload");
await fs.mkdir(out, { recursive: true });
const observations = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const mediaRequests = [];
  context.on("request", request => { if (new URL(request.url()).pathname.startsWith("/animations/")) mediaRequests.push(request.url()); });
  await context.addInitScript(() => {
    window.uploadNotificationRequests = 0;
    window.uploadNotifications = [];
    class SyntheticNotification {
      static permission = "default";
      static async requestPermission() {
        window.uploadNotificationRequests += 1;
        this.permission = "granted";
        return "granted";
      }
      constructor(title) { window.uploadNotifications.push(title); }
      close() {}
    }
    Object.defineProperty(window, "Notification", { configurable: true, value: SyntheticNotification });
  });
  const page = await context.newPage();
  const response = await page.goto(base.href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await waitForPageContent(page);
  const modal = page.getByRole("dialog", { name: "Pizza Logs guild intro", includeHidden: true });
  assert.equal(await modal.isVisible(), false, "A first visit is never covered by the cinematic");
  assert.equal(mediaRequests.length, 0, "A first visit downloads no intro video or poster");
  const character = page.getByRole("textbox", { name: "Character (required)", exact: true });
  const choose = page.getByRole("button", { name: "Choose File", exact: true });
  const fieldBox = await character.boundingBox();
  const fileBox = await choose.boundingBox();
  assert.ok(fieldBox.y + fieldBox.height < 650, "The first input is promptly reachable at 375px");
  assert.ok(fileBox.y + fileBox.height < 812, "The file action fits in the initial mobile viewport");
  assert.ok(fieldBox.height >= 44 && fileBox.height >= 44);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(out, "375-upload-first-visit.png"), fullPage: true });
  observations.push({ check: "nonblocking first visit and mobile upload position", fieldBox, fileBox });

  const watch = page.getByRole("button", { name: "Watch guild intro", exact: true });
  await watch.click();
  await modal.waitFor({ state: "visible" });
  assert.equal(await modal.evaluate(element => element.matches(":modal")), true);
  assert.equal(await modal.locator("video").count(), 0, "Reduced motion starts with a still preview");
  const brandBox = await modal.locator(".frozen-intro-brand").boundingBox();
  assert.ok(brandBox && brandBox.x >= 0 && brandBox.x + brandBox.width <= 375, "The still preview brand stays centered within the viewport");
  assert.equal(await page.getByRole("button", { name: "Close intro", exact: true }).evaluate(element => element === document.activeElement), true);
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]"))), true, "Tab stays inside the native modal");
  }
  await page.screenshot({ path: path.join(out, "375-intro-reduced-motion.png") });
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  assert.equal(await watch.evaluate(element => element === document.activeElement), true, "Escape restores focus to Watch guild intro");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  await watch.click();
  await page.getByRole("button", { name: "Close intro", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(await watch.evaluate(element => element === document.activeElement), true);
  observations.push({ check: "explicit intro, reduced motion, native focus containment, Escape/close and focus restoration" });

  await character.fill("Synthetic UX");
  assert.equal(await choose.isDisabled(), true, "A character name alone does not accept the upload rules");
  const agreement = page.getByRole("checkbox", { name: /I have permission to share this log/ });
  assert.equal(await agreement.isChecked(), false, "Upload acceptance starts unchecked");
  await agreement.check();
  assert.equal(await choose.isEnabled(), true);
  await agreement.uncheck();
  assert.equal(await choose.isDisabled(), true, "Withdrawing acceptance blocks file selection");
  await agreement.check();
  const source = await fs.readFile(new URL("../parser/tests/fixtures/icc-25n-synthetic/combatlog.txt", import.meta.url), "utf8");
  const suffix = Array.from({ length: 6 }, () => String.fromCharCode(97 + randomInt(26))).join("");
  const hours = String(Math.floor(Math.random() * 24)).padStart(2, "0");
  const minutes = String(Math.floor(Math.random() * 60)).padStart(2, "0");
  const input = Buffer.from(source.replaceAll("1/1 00:00:", `1/2 ${hours}:${minutes}:`).replaceAll('"Phyre"', `"Uxtest${suffix}"`));
  const upload = async () => {
    const picker = page.waitForEvent("filechooser");
    await choose.click();
    await (await picker).setFiles({ name: "synthetic-ux.txt", mimeType: "text/plain", buffer: input });
  };
  await upload();
  await page.getByText("Upload Complete", { exact: true }).waitFor({ timeout: 120_000 });
  const viewReport = page.getByRole("link", { name: "View raid report", exact: false });
  const reportPath = await viewReport.getAttribute("href");
  assert.match(reportPath, /^\/raids\/[^/]+\/sessions\/[^/]+$/);
  assert.equal(await page.evaluate(() => window.uploadNotificationRequests), 0, "Selecting a file and completing upload never prompt for permission");
  assert.equal(await page.evaluate(() => window.uploadNotifications.length), 0);
  await page.screenshot({ path: path.join(out, "375-fresh-upload-report-action.png"), fullPage: true });
  await page.getByRole("button", { name: "Upload Another", exact: true }).click();
  assert.equal(await agreement.isChecked(), false, "Each new upload requires fresh acknowledgement");
  await agreement.check();
  await page.getByText("Upload options and file help", { exact: true }).click();
  await page.getByRole("button", { name: "Notify me when finished", exact: true }).click();
  await page.getByText("Browser notifications are enabled for upload results.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.uploadNotificationRequests), 1);
  await upload();
  await page.getByText("Report Already Exists", { exact: true }).waitFor({ timeout: 120_000 });
  assert.equal(await viewReport.getAttribute("href"), reportPath);
  assert.equal(await page.evaluate(() => window.uploadNotificationRequests), 1, "Duplicate upload does not request permission again");
  assert.deepEqual(await page.evaluate(() => window.uploadNotifications), ["Upload complete"]);
  await viewReport.click();
  await page.waitForURL(new URL(reportPath, base).href);
  await waitForPageContent(page);
  assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
  observations.push({ check: "fresh and duplicate upload links, explicit notification request once, existing grant used, report navigation", reportPath });
  await context.close();

  const failedContext = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "no-preference" });
  await failedContext.route("**/animations/**/*.webm", route => route.abort());
  await failedContext.route("**/animations/**/*.mp4", route => route.abort());
  const failedPage = await failedContext.newPage();
  await failedPage.goto(base.href);
  await waitForPageContent(failedPage);
  await failedPage.getByRole("button", { name: "Watch guild intro", exact: true }).click();
  await failedPage.getByText("The intro could not play. You can close this preview and keep browsing.", { exact: true }).waitFor();
  await failedPage.getByRole("button", { name: "Close intro", exact: true }).click();
  assert.equal(await failedPage.getByRole("dialog").count(), 0);
  await failedContext.close();
  observations.push({ check: "failed media retains a closeable poster fallback" });
  console.log("Upload journey browser checks passed");
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations }, null, 2));
}
