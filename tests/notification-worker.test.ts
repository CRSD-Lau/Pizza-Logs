import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRailwayCostSnapshot,
  fetchRailwayTrafficSnapshot,
  loadWorkerConfig,
  previousUtcDay,
  renderDigestEmail,
  renderUploadEmail,
  sendResendEmail,
} from "../scripts/notification-worker.mjs";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test?schema=notification_test",
  RESEND_API_KEY: "re_test",
  REPORT_EMAIL_FROM: "Pizza Logs <notifications@example.test>",
  REPORT_EMAIL_TO: "owner@example.test",
  SITE_URL: "https://logs.example.test",
  RAILWAY_API_TOKEN: "railway-test-token",
  RAILWAY_PROJECT_ID: "project-test",
  RAILWAY_WORKSPACE_ID: "workspace-test",
  RAILWAY_ENVIRONMENT_ID: "environment-test",
  RAILWAY_WEB_SERVICE_ID: "web-test",
};

test("notification worker validates configuration and UTC digest boundaries", () => {
  const config = loadWorkerConfig(env);
  assert.equal(config.schema, "notification_test");
  assert.deepEqual(config.emailTo, ["owner@example.test"]);
  assert.deepEqual(previousUtcDay(new Date("2026-09-08T12:00:00Z")), {
    date: "2026-09-07",
    start: new Date("2026-09-07T00:00:00Z"),
    end: new Date("2026-09-08T00:00:00Z"),
  });
  assert.throws(() => loadWorkerConfig({ ...env, SITE_URL: "http://public.example.test" }), /HTTPS/);
  assert.throws(() => loadWorkerConfig({ ...env, REPORT_EMAIL_TO: "owner@example.test\r\nBcc: attacker@example.test" }), /line breaks/);
});

test("Railway cost snapshot keeps project breakdown distinct from workspace bill context", async () => {
  const config = loadWorkerConfig(env);
  const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer railway-test-token");
    const request = JSON.parse(String(init?.body));
    assert.deepEqual(request.variables.measurements, [
      "CPU_USAGE", "MEMORY_USAGE_GB", "NETWORK_TX_GB", "DISK_USAGE_GB", "EPHEMERAL_DISK_USAGE_GB", "BACKUP_USAGE_GB",
    ]);
    return Response.json({ data: {
      project: [
        { measurement: "CPU_USAGE", estimatedValue: 0.25 },
        { measurement: "MEMORY_USAGE_GB", estimatedValue: 3.5 },
      ],
      workspace: [
        { measurement: "CPU_USAGE", estimatedValue: 0.5 },
        { measurement: "MEMORY_USAGE_GB", estimatedValue: 6.5 },
        { measurement: "MEMORY_USAGE_GB", estimatedValue: 1 },
      ],
    } });
  };
  const snapshot = await fetchRailwayCostSnapshot(config, fetchMock as typeof fetch);
  assert.equal(snapshot.available, true);
  if (!snapshot.available) return;
  assert.equal(snapshot.projectTotalUsd, 3.75);
  assert.equal(snapshot.workspaceTotalUsd, 8);
  assert.equal(snapshot.estimatedWorkspaceBillUsd, 8);
});

test("Railway authorization failures become an explicit unavailable estimate", async () => {
  const config = loadWorkerConfig(env);
  const snapshot = await fetchRailwayCostSnapshot(config, async () => Response.json({
    errors: [{ message: "Not Authorized" }],
  }) as never);
  assert.deepEqual({ available: snapshot.available, code: snapshot.code }, { available: false, code: "RAILWAY_NOT_AUTHORIZED" });
});

test("malformed Railway usage cannot become a fabricated cost", async () => {
  const config = loadWorkerConfig(env);
  const snapshot = await fetchRailwayCostSnapshot(config, async () => Response.json({ data: {
    project: [{ measurement: "CPU_USAGE", estimatedValue: "not-a-number" }],
    workspace: [],
  } }) as never);
  assert.deepEqual({ available: snapshot.available, code: snapshot.code }, { available: false, code: "RAILWAY_INVALID_USAGE" });
});

test("daily traffic totals exact status families and uses the full-day percentile sample", async () => {
  const config = loadWorkerConfig(env);
  const window = previousUtcDay(new Date("2026-09-08T12:00:00Z"));
  const snapshot = await fetchRailwayTrafficSnapshot(config, window, async () => Response.json({ data: {
    requests: { samples: [{ ts: 1788739200, value: 100 }] },
    durations: { samples: [{ ts: 1788739200, p50: 5, p90: 20, p95: 50, p99: 200 }] },
    statuses: [
      { statusCode: 200, samples: [{ ts: 1788739200, value: 80 }] },
      { statusCode: 307, samples: [{ ts: 1788739200, value: 5 }] },
      { statusCode: 404, samples: [{ ts: 1788739200, value: 10 }] },
      { statusCode: 499, samples: [{ ts: 1788739200, value: 3 }] },
      { statusCode: 503, samples: [{ ts: 1788739200, value: 2 }] },
    ],
  } }) as never);
  assert.equal(snapshot.available, true);
  if (!snapshot.available) return;
  assert.equal(snapshot.requests, 100);
  assert.deepEqual(snapshot.statusFamilies, { success: 80, redirect: 5, clientError: 13, serverError: 2, other: 0 });
  assert.equal(snapshot.latency?.p95, 50);
});

test("malformed Railway traffic cannot become a misleading digest", async () => {
  const config = loadWorkerConfig(env);
  const window = previousUtcDay(new Date("2026-09-08T12:00:00Z"));
  const snapshot = await fetchRailwayTrafficSnapshot(config, window, async () => Response.json({ data: {
    requests: { samples: [{ ts: 1788739200, value: "bad" }] },
    durations: { samples: [] },
    statuses: [],
  } }) as never);
  assert.deepEqual(snapshot, { available: false, code: "RAILWAY_INVALID_METRICS" });
});

test("email rendering escapes untrusted upload labels and labels traffic and costs honestly", () => {
  const config = loadWorkerConfig(env);
  const unavailable = { available: false as const, capturedAt: "2026-09-08T12:00:00.000Z", code: "RAILWAY_NOT_AUTHORIZED" };
  const upload = renderUploadEmail({
    completedAt: "2026-09-08T11:00:00.000Z", uploaderName: "<script>alert(1)</script>", guildName: "Guild & Co\r\nBcc: nope",
    realmName: "Lordaeron", filename: "raid.zip", fileSize: 1024, sessionCount: 1, encountersInserted: 3,
    encountersFound: 3, warningCount: 0, publicReportSlug: "guild-123", firstSessionSlug: "2026-09-08",
  }, unavailable, config);
  assert.match(upload.text, /live usage estimate: unavailable/);
  assert.doesNotMatch(upload.html, /<script>/);
  assert.match(upload.html, /&lt;script&gt;/);
  assert.equal(upload.subject, "Pizza Logs upload: Guild & Co Bcc: nope");

  const digest = renderDigestEmail({ date: "2026-09-07" }, { available: false, code: "RAILWAY_UNAVAILABLE" }, {
    uploads: 2, encounters: 12, terminalNotificationFailures: 0,
  }, unavailable, config);
  assert.match(digest.text, /not a unique-visitor count/);
  assert.match(digest.text, /No request IP addresses or user agents are stored/);
});

test("Resend receives a stable provider idempotency key", async () => {
  const config = loadWorkerConfig(env);
  let observedKey = "";
  const id = await sendResendEmail(config, { id: "job-123" }, {
    from: config.emailFrom, to: config.emailTo, subject: "Test", text: "Test", html: "<p>Test</p>",
  }, (async (_url: string | URL | Request, init?: RequestInit) => {
    observedKey = new Headers(init?.headers).get("Idempotency-Key") ?? "";
    return Response.json({ id: "email-123" });
  }) as typeof fetch);
  assert.equal(id, "email-123");
  assert.equal(observedKey, "pizzalogs/job-123");
});
