import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";
import { localTestBase } from "./e2e-upload.mjs";
import { BUG_REPORT_URL, SECURITY_REPORT_URL, UPLOAD_POLICY_HEADER, UPLOAD_POLICY_VERSION } from "../lib/upload-policy.ts";

const base = localTestBase(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
const out = path.resolve(".test-artifacts/upload-security");
await fs.mkdir(out, { recursive: true });
const observations = [];
const query = new URLSearchParams({ filename: "security-test.txt", fileSize: "1", uploaderName: "Audit" });
const post = headers => fetch(new URL(`/api/upload?${query}`, base), {
  method: "POST", body: "x", redirect: "error", signal: AbortSignal.timeout(10_000),
  headers: { "content-type": "application/octet-stream", "x-upload-id": randomUUID(), ...headers },
});
for (const [headers, status] of [
  [{}, 428],
  [{ [UPLOAD_POLICY_HEADER]: "obsolete" }, 428],
  [{ [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION, origin: "https://attacker.example" }, 403],
  [{ [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION, "sec-fetch-site": "cross-site" }, 403],
  [{ [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION, "content-encoding": "gzip" }, 400],
]) {
  const response = await post(headers);
  assert.equal(response.status, status);
  assert.doesNotMatch(await response.text(), /Traceback|postgresql:|node_modules|\.railway\.internal/);
}
observations.push("real server rejects missing/stale policy, hostile origins and encoded bodies with safe responses");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(base.href, { waitUntil: "networkidle" });
  await waitForPageContent(page);
  const choose = page.getByRole("button", { name: "Choose File", exact: true });
  const agreement = page.getByRole("checkbox", { name: /I have permission to share this log/ });
  await page.getByRole("textbox", { name: "Character (required)", exact: true }).fill("Audit");
  assert.equal(await agreement.isChecked(), false);
  assert.equal(await choose.isDisabled(), true);
  await agreement.check();
  await agreement.uncheck();
  assert.equal(await choose.isDisabled(), true);
  assert.equal(await page.getByRole("link", { name: "Report a bug", exact: true }).getAttribute("href"), BUG_REPORT_URL);
  assert.equal(await page.getByRole("link", { name: "Report security concerns privately", exact: true }).getAttribute("href"), SECURITY_REPORT_URL);
  const chooseBox = await choose.boundingBox();
  assert.ok(chooseBox && chooseBox.y + chooseBox.height < 812 && chooseBox.height >= 44);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(out, "375-agreement.png"), fullPage: true });

  // Test browser recovery without persisting more reports or consuming parser slots.
  let responseMode = "stale";
  await page.route("**/api/upload?**", async route => {
    assert.equal(route.request().headers()[UPLOAD_POLICY_HEADER], UPLOAD_POLICY_VERSION);
    await route.fulfill({ status: responseMode === "stale" ? 428 : 200,
      contentType: "text/event-stream", body: responseMode === "stale" ? "" : 'data: {"type":"progress","pct":20,"msg":"Receiving"}\n\n' });
  });
  const selectFile = async () => {
    await agreement.check();
    const chooser = page.waitForEvent("filechooser");
    await choose.click();
    await (await chooser).setFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic browser-only response test") });
  };
  await selectFile();
  await page.getByRole("alert").filter({ hasText: "The upload rules have changed" }).waitFor();
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  assert.equal(await agreement.isChecked(), false);
  responseMode = "truncated";
  await selectFile();
  await page.getByRole("alert").filter({ hasText: "The connection ended before upload completion" }).waitFor();
  observations.push("unchecked/revoked/reset agreement, current request header, stale-policy and truncated-stream recovery, bug links and 375px layout");
  await page.goto(new URL("/upload-policy", base).href, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("heading", { level: 1, name: "Upload rules and reporting" }).count(), 1);
  assert.match(await page.locator("main").innerText(), /not an antivirus scan/);
  await page.screenshot({ path: path.join(out, "375-policy.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base.href, { waitUntil: "networkidle" });
  await waitForPageContent(page);
  await page.screenshot({ path: path.join(out, "1440-agreement.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  observations.push("policy content and 1440px upload layout");
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "browser-report.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations }, null, 2));
}
console.log("Upload security browser checks passed");
