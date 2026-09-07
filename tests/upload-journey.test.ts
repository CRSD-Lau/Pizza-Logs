import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadResult, UploadZone } from "../components/upload/UploadZone";
import { FrozenLogbookIntro } from "../components/intro/FrozenLogbookIntro";
import { requestUploadNotifications, sendUploadNotification } from "../components/upload/notifications";
import type { UploadResponse } from "../lib/schema";

const baseResult: UploadResponse & { filename: string } = {
  uploadId: "synthetic-upload", publicReportSlug: "synthetic-raid", firstSessionSlug: "icecrown-citadel-25n",
  filename: "synthetic.txt", status: "DONE", encountersFound: 1, encountersInserted: 1, encountersDuplicate: 0,
};

async function main() {
  for (const status of ["DONE", "DUPLICATE", "PARTIAL"] as const) {
    const html = renderToStaticMarkup(React.createElement(UploadResult, {
      result: { ...baseResult, status }, onReset: () => {},
    }));
    assert.ok(html.includes('href="/raids/synthetic-raid/sessions/icecrown-citadel-25n"'), `${status}: the saved report is directly reachable`);
    assert.ok(html.includes("View raid report"));
    assert.ok(html.includes("Upload Another"));
    assert.ok(!html.includes("/uploads/synthetic-upload"), "The primary destination is the public canonical report");
  }
  const noSession = renderToStaticMarkup(React.createElement(UploadResult, {
    result: { ...baseResult, firstSessionSlug: undefined }, onReset: () => {},
  }));
  assert.ok(!noSession.includes("View raid report"), "A missing session must not invent a broken report URL");
  const achieved = renderToStaticMarkup(React.createElement(UploadResult, {
    result: { ...baseResult, milestones: [{ playerName: "Synthetic", bossName: "Marrowgar", difficulty: "25N", metric: "DPS", value: 100, rank: 1, type: "ALL_TIME_RANK" }] },
    onReset: () => {},
  }));
  assert.ok(achieved.includes("when achieved"), "An award does not promise a permanent current rank");

  const intro = renderToStaticMarkup(React.createElement(FrozenLogbookIntro));
  assert.ok(intro.includes("Watch guild intro"));
  assert.ok(!intro.includes("<video") && !intro.includes("<source") && !intro.includes("background-image"), "An unopened intro must not request media or cover the page");
  assert.ok(!intro.includes('open=""'), "The modal starts closed even on a first visit");

  const originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  const originalSetTimeout = globalThis.setTimeout;
  let permissionRequests = 0;
  const shown: Array<{ title: string; body?: string }> = [];
  const timers: Array<() => void> = [];
  let closed = 0;
  class FakeNotification {
    static permission: NotificationPermission = "default";
    static async requestPermission(): Promise<NotificationPermission> {
      permissionRequests += 1;
      this.permission = "granted";
      return this.permission;
    }
    constructor(title: string, options?: NotificationOptions) { shown.push({ title, body: options?.body }); }
    close() { closed += 1; }
  }
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: FakeNotification });
  globalThis.setTimeout = ((callback: () => void) => {
    timers.push(callback);
    return 0;
  }) as unknown as typeof setTimeout;
  try {
    const uploadForm = renderToStaticMarkup(React.createElement(UploadZone));
    assert.match(uploadForm, /type="checkbox"/);
    assert.match(uploadForm, /I have permission to share this log/);
    assert.match(uploadForm, /href="\/upload-policy"/);
    assert.doesNotMatch(uploadForm, /checked=""/, "Agreement must never be pre-accepted");
    sendUploadNotification("Upload complete", "One encounter saved");
    assert.equal(permissionRequests, 0, "Rendering and completion must never request notification permission");
    assert.equal(shown.length, 0);
    assert.equal(await requestUploadNotifications(), "granted", "The explicit opt-in requests permission");
    assert.equal(permissionRequests, 1);
    sendUploadNotification("Upload complete", "One encounter saved");
    assert.deepEqual(shown, [{ title: "Upload complete", body: "One encounter saved" }]);
    timers.splice(0).forEach(callback => callback());
    assert.equal(closed, 1);
    assert.equal(await requestUploadNotifications(), "granted");
    assert.equal(permissionRequests, 1, "Existing granted permission is preserved without another prompt");
    FakeNotification.permission = "denied";
    assert.equal(await requestUploadNotifications(), "denied");
    sendUploadNotification("Upload failed", "Synthetic error");
    assert.equal(permissionRequests, 1);
    assert.equal(shown.length, 1, "Denied permission never changes the upload's own status UI");
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: undefined });
    assert.equal(await requestUploadNotifications(), null);
    assert.doesNotThrow(() => sendUploadNotification("Upload complete", "Saved"));
    class UnsupportedNotification extends FakeNotification {
      static permission: NotificationPermission = "granted";
      constructor() { super("unused"); throw new Error("Window notifications unsupported"); }
    }
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: UnsupportedNotification });
    assert.doesNotThrow(() => sendUploadNotification("Upload complete", "Saved"), "A browser notification failure cannot turn a saved upload into an error");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    if (originalNotification) Object.defineProperty(globalThis, "Notification", originalNotification);
    else Reflect.deleteProperty(globalThis, "Notification");
  }
  console.log("upload journey tests passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
