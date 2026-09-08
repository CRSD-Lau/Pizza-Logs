import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const RAILWAY_GRAPHQL_URL = "https://backboard.railway.com/graphql/v2";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const MAX_JOBS_PER_RUN = 20;
const MAX_RUNTIME_MS = 240_000;
const MINUTES_IN_BILLING_MONTH = 43_200;
const BILLABLE_MEASUREMENTS = [
  "CPU_USAGE", "MEMORY_USAGE_GB", "NETWORK_TX_GB", "DISK_USAGE_GB",
  "BACKUP_USAGE_GB",
];
const MEASUREMENT_LABELS = {
  CPU_USAGE: "CPU",
  MEMORY_USAGE_GB: "Memory",
  NETWORK_TX_GB: "Network egress",
  DISK_USAGE_GB: "Volume storage",
  BACKUP_USAGE_GB: "Backups",
};
const MEASUREMENT_PRICES_USD = {
  CPU_USAGE: 20 / MINUTES_IN_BILLING_MONTH,
  MEMORY_USAGE_GB: 10 / MINUTES_IN_BILLING_MONTH,
  NETWORK_TX_GB: 0.05,
  DISK_USAGE_GB: 0.15 / MINUTES_IN_BILLING_MONTH,
  BACKUP_USAGE_GB: 0.15 / MINUTES_IN_BILLING_MONTH,
};

export function quoteIdentifier(value) {
  if (!value || /[\0"]/.test(value) || Buffer.byteLength(value) > 63) {
    throw new Error("Database schema must be at most 63 bytes and contain no null or double-quote characters");
  }
  return `"${value.replaceAll('"', '""')}"`;
}

export function databaseSchema(connectionString) {
  return new URL(connectionString).searchParams.get("schema") ?? "public";
}

function required(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required for the notification worker`);
  return value.trim();
}

function validateEmailAddress(name, value, allowDisplayName = false) {
  if (/[\r\n]/.test(value)) throw new Error(`${name} must not contain line breaks`);
  const candidate = allowDisplayName && value.includes("<")
    ? value.match(/<([^<>]+)>$/)?.[1]
    : value;
  if (!candidate || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(candidate)) {
    throw new Error(`${name} must contain a valid email address`);
  }
  return value;
}

export function loadWorkerConfig(env = process.env) {
  const siteUrl = new URL(required("SITE_URL", env.SITE_URL));
  if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost" && siteUrl.hostname !== "127.0.0.1") {
    throw new Error("SITE_URL must use HTTPS outside localhost");
  }
  const digestHour = Number(env.DIGEST_SEND_HOUR_UTC ?? "12");
  if (!Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) {
    throw new Error("DIGEST_SEND_HOUR_UTC must be an integer from 0 through 23");
  }
  const planIncludedUsd = Number(env.RAILWAY_PLAN_INCLUDED_USD ?? "5");
  if (!Number.isFinite(planIncludedUsd) || planIncludedUsd < 0) {
    throw new Error("RAILWAY_PLAN_INCLUDED_USD must be a non-negative number");
  }
  const emailFrom = validateEmailAddress("REPORT_EMAIL_FROM", required("REPORT_EMAIL_FROM", env.REPORT_EMAIL_FROM), true);
  const emailTo = required("REPORT_EMAIL_TO", env.REPORT_EMAIL_TO)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => validateEmailAddress("REPORT_EMAIL_TO", value));
  if (emailTo.length === 0) throw new Error("REPORT_EMAIL_TO must contain at least one email address");
  return {
    databaseUrl: required("DATABASE_URL", env.DATABASE_URL),
    schema: databaseSchema(env.DATABASE_URL),
    resendApiKey: required("RESEND_API_KEY", env.RESEND_API_KEY),
    emailFrom,
    emailTo,
    siteUrl: siteUrl.toString().replace(/\/$/, ""),
    railwayApiToken: env.RAILWAY_API_TOKEN?.trim() || null,
    railwayProjectId: env.RAILWAY_PROJECT_ID?.trim() || null,
    railwayWorkspaceId: env.RAILWAY_WORKSPACE_ID?.trim() || null,
    railwayEnvironmentId: env.RAILWAY_ENVIRONMENT_ID?.trim() || null,
    railwayWebServiceId: env.RAILWAY_WEB_SERVICE_ID?.trim() || null,
    planName: env.RAILWAY_PLAN_NAME?.trim() || "Hobby",
    planIncludedUsd,
    digestHour,
    maxAttempts: 8,
    leaseMinutes: 5,
  };
}

function tableName(config) {
  return `${quoteIdentifier(config.schema)}."notification_jobs"`;
}

function notificationStateType(config) {
  return `${quoteIdentifier(config.schema)}."NotificationState"`;
}

function uploadTable(config) {
  return `${quoteIdentifier(config.schema)}."uploads"`;
}

function encounterTable(config) {
  return `${quoteIdentifier(config.schema)}."encounters"`;
}

export function previousUtcDay(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 86_400_000);
  return { date: start.toISOString().slice(0, 10), start, end };
}

async function railwayGraphql(config, query, variables, fetchImpl = fetch) {
  if (!config.railwayApiToken) throw Object.assign(new Error("Railway billing token is not configured"), { code: "RAILWAY_TOKEN_MISSING" });
  const response = await fetchImpl(RAILWAY_GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.railwayApiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error("Railway API request failed"), { code: `RAILWAY_HTTP_${response.status}` });
  const body = await response.json();
  if (body.errors?.length) {
    const unauthorized = body.errors.some(error => /not authorized/i.test(error.message ?? ""));
    throw Object.assign(new Error("Railway API returned an error"), { code: unauthorized ? "RAILWAY_NOT_AUTHORIZED" : "RAILWAY_GRAPHQL_ERROR" });
  }
  return body.data;
}

function usageLines(rows = []) {
  const byMeasurement = new Map();
  for (const row of rows) {
    const value = Number(row?.estimatedValue);
    if (!BILLABLE_MEASUREMENTS.includes(row?.measurement) || !Number.isFinite(value) || value < 0) {
      throw Object.assign(new Error("Railway returned invalid usage data"), { code: "RAILWAY_INVALID_USAGE" });
    }
    byMeasurement.set(row.measurement, (byMeasurement.get(row.measurement) ?? 0) + value);
  }
  return BILLABLE_MEASUREMENTS.map(measurement => ({
    measurement,
    label: MEASUREMENT_LABELS[measurement],
    usd: (byMeasurement.get(measurement) ?? 0) * MEASUREMENT_PRICES_USD[measurement],
  }));
}

export async function fetchRailwayCostSnapshot(config, fetchImpl = fetch) {
  const capturedAt = new Date().toISOString();
  if (!config.railwayProjectId || !config.railwayWorkspaceId) {
    return { available: false, capturedAt, code: "RAILWAY_BILLING_IDS_MISSING" };
  }
  const query = `
    query Cost($projectId: String!, $workspaceId: String, $measurements: [MetricMeasurement!]!) {
      project: estimatedUsage(projectId: $projectId, measurements: $measurements) {
        measurement estimatedValue
      }
      workspace: estimatedUsage(workspaceId: $workspaceId, measurements: $measurements) {
        measurement estimatedValue
      }
    }`;
  try {
    const data = await railwayGraphql(config, query, {
      projectId: config.railwayProjectId,
      workspaceId: config.railwayWorkspaceId,
      measurements: BILLABLE_MEASUREMENTS,
    }, fetchImpl);
    const project = usageLines(data.project);
    const workspace = usageLines(data.workspace);
    const projectTotalUsd = project.reduce((sum, row) => sum + row.usd, 0);
    const workspaceTotalUsd = workspace.reduce((sum, row) => sum + row.usd, 0);
    return {
      available: true, capturedAt, project, projectTotalUsd, workspaceTotalUsd,
      planName: config.planName, planIncludedUsd: config.planIncludedUsd,
      estimatedWorkspaceBillUsd: Math.max(config.planIncludedUsd, workspaceTotalUsd),
    };
  } catch (error) {
    return { available: false, capturedAt, code: error?.code ?? "RAILWAY_UNAVAILABLE" };
  }
}

function sumSamples(samples = []) {
  return Math.round(samples.reduce((sum, sample) => {
    const value = Number(sample?.value);
    if (!Number.isFinite(value) || value < 0) {
      throw Object.assign(new Error("Railway returned invalid metric data"), { code: "RAILWAY_INVALID_METRICS" });
    }
    return sum + value;
  }, 0));
}

export async function fetchRailwayTrafficSnapshot(config, window, fetchImpl = fetch) {
  if (!config.railwayEnvironmentId || !config.railwayWebServiceId) {
    return { available: false, code: "RAILWAY_TRAFFIC_IDS_MISSING" };
  }
  const query = `
    query Traffic($environmentId: String!, $serviceId: String!, $startDate: DateTime!, $endDate: DateTime!, $stepSeconds: Int) {
      requests: httpMetrics(environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, endDate: $endDate, stepSeconds: $stepSeconds) { samples { ts value } }
      durations: httpDurationMetrics(environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, endDate: $endDate, stepSeconds: $stepSeconds) { samples { ts p50 p90 p95 p99 } }
      statuses: httpMetricsGroupedByStatus(environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, endDate: $endDate, stepSeconds: $stepSeconds) { statusCode samples { ts value } }
    }`;
  try {
    const data = await railwayGraphql(config, query, {
      environmentId: config.railwayEnvironmentId,
      serviceId: config.railwayWebServiceId,
      startDate: window.start.toISOString(),
      endDate: window.end.toISOString(),
      stepSeconds: 86_400,
    }, fetchImpl);
    const statusCounts = {};
    for (const row of data.statuses) {
      const statusCode = Number(row?.statusCode);
      if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
        throw Object.assign(new Error("Railway returned an invalid HTTP status"), { code: "RAILWAY_INVALID_METRICS" });
      }
      const key = String(statusCode);
      statusCounts[key] = (statusCounts[key] ?? 0) + sumSamples(row.samples);
    }
    const statusFamilies = { success: 0, redirect: 0, clientError: 0, serverError: 0, other: 0 };
    for (const [status, count] of Object.entries(statusCounts)) {
      const code = Number(status);
      if (code >= 200 && code < 300) statusFamilies.success += count;
      else if (code >= 300 && code < 400) statusFamilies.redirect += count;
      else if (code >= 400 && code < 500) statusFamilies.clientError += count;
      else if (code >= 500 && code < 600) statusFamilies.serverError += count;
      else statusFamilies.other += count;
    }
    const expectedTimestamp = Math.floor(window.start.getTime() / 1000);
    const latency = data.durations.samples.find(sample => Number(sample.ts) === expectedTimestamp) ?? null;
    if (latency && [latency.p50, latency.p95, latency.p99].some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      throw Object.assign(new Error("Railway returned invalid latency data"), { code: "RAILWAY_INVALID_METRICS" });
    }
    return { available: true, requests: sumSamples(data.requests.samples), statusCounts, statusFamilies, latency };
  } catch (error) {
    return { available: false, code: error?.code ?? "RAILWAY_TRAFFIC_UNAVAILABLE" };
  }
}

export async function enqueueDailyDigest(pool, config, now = new Date()) {
  if (now.getUTCHours() < config.digestHour) return false;
  const window = previousUtcDay(now);
  const table = tableName(config);
  const result = await pool.query(
    `INSERT INTO ${table} ("id", "kind", "dedupeKey", "payload", "payloadVersion", "state", "availableAt", "createdAt", "updatedAt")
     VALUES ($1, 'DAILY_DIGEST', $2, $3::jsonb, 1, 'PENDING', NOW(), NOW(), NOW())
     ON CONFLICT ("dedupeKey") DO NOTHING`,
    [randomUUID(), `digest:${window.date}`, JSON.stringify({ date: window.date, start: window.start.toISOString(), end: window.end.toISOString() })],
  );
  return result.rowCount === 1;
}

export async function claimNextJob(pool, config) {
  const table = tableName(config);
  const leaseToken = randomUUID();
  const result = await pool.query(
    `WITH expired_final AS (
       UPDATE ${table}
       SET "state" = 'FAILED', "leaseExpiresAt" = NULL, "leaseToken" = NULL,
           "lastErrorCode" = 'LEASE_EXPIRED_FINAL_ATTEMPT', "updatedAt" = NOW()
       WHERE "state" = 'PROCESSING' AND "leaseExpiresAt" <= NOW() AND "attempts" >= $1
     ), candidate AS (
       SELECT "id" FROM ${table}
       WHERE "attempts" < $1 AND (
          ("state" = 'PENDING' AND "availableAt" <= NOW())
          OR ("state" = 'PROCESSING' AND "leaseExpiresAt" <= NOW())
       )
       ORDER BY "createdAt", "id"
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE ${table} AS job
     SET "state" = 'PROCESSING',
         "attempts" = job."attempts" + 1,
         "leaseExpiresAt" = NOW() + ($2 * INTERVAL '1 minute'), "leaseToken" = $3, "updatedAt" = NOW()
     FROM candidate
     WHERE job."id" = candidate."id"
     RETURNING job.*`,
    [config.maxAttempts, config.leaseMinutes, leaseToken],
  );
  return result.rows[0] ?? null;
}

export async function getDailyDatabaseCounts(pool, config, window) {
  const [uploads, encounters, failed] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM ${uploadTable(config)} WHERE "createdAt" >= $1 AND "createdAt" < $2 AND "status" = 'DONE'`, [window.start, window.end]),
    pool.query(`SELECT COUNT(*)::int AS count FROM ${encounterTable(config)} WHERE "createdAt" >= $1 AND "createdAt" < $2`, [window.start, window.end]),
    pool.query(`SELECT COUNT(*)::int AS count FROM ${tableName(config)} WHERE "updatedAt" >= $1 AND "updatedAt" < $2 AND "state" = 'FAILED'`, [window.start, window.end]),
  ]);
  return { uploads: uploads.rows[0].count, encounters: encounters.rows[0].count, terminalNotificationFailures: failed.rows[0].count };
}

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatCost(cost) {
  if (!cost.available) {
    return [
      "Railway live usage estimate: unavailable",
      `Checked: ${cost.capturedAt}`,
      `Reason code: ${cost.code}`,
      "The Railway dashboard and final invoice remain authoritative.",
    ].join("\n");
  }
  const lines = cost.project.map(row => `  ${row.label}: ${money(row.usd)}`);
  return [
    "Railway projected resource cost for this billing period",
    `Captured: ${cost.capturedAt}`,
    ...lines,
    `  Pizza Logs projected resources: ${money(cost.projectTotalUsd)}`,
    `  Workspace projected resources: ${money(cost.workspaceTotalUsd)}`,
    `  Expected workspace charge: ${money(cost.estimatedWorkspaceBillUsd)}`,
    `${cost.planName} includes the first ${money(cost.planIncludedUsd)} of resource usage.`,
    "Resource projection only; the final invoice may include credits, taxes, adjustments, or other workspace activity.",
  ].join("\n");
}

function htmlEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function statCell(label, value) {
  return `<td class="stat-cell" style="font-family:Arial,sans-serif;width:33.33%;padding:8px;vertical-align:top"><div style="background:#242426;border:1px solid #363638;border-radius:10px;padding:14px"><div style="color:#a8a8ad;font:12px/1.3 Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em">${htmlEscape(label)}</div><div style="color:#fff;font:700 22px/1.3 Arial,sans-serif;margin-top:5px">${htmlEscape(value)}</div></div></td>`;
}

function detailRows(rows) {
  return rows.map(([label, value]) => `<tr><td style="padding:8px 0;color:#aaaab0;font:14px/1.4 Arial,sans-serif;vertical-align:top">${htmlEscape(label)}</td><td style="padding:8px 0 8px 16px;color:#f4f4f5;font:600 14px/1.4 Arial,sans-serif;text-align:right;vertical-align:top">${htmlEscape(value)}</td></tr>`).join("");
}

function costHtml(cost) {
  if (!cost.available) {
    return `<div style="background:#242426;border:1px solid #3a3a3d;border-radius:12px;padding:16px"><div style="color:#fff;font-weight:700">Railway cost unavailable</div><div style="color:#b8b8bd;font-size:13px;line-height:1.5;margin-top:6px">Reason: ${htmlEscape(cost.code)}. Check the Railway dashboard for authoritative billing information.</div></div>`;
  }
  const rows = cost.project.map(row => [row.label, money(row.usd)]);
  return `<div style="background:#242426;border:1px solid #3a3a3d;border-radius:12px;padding:16px"><table role="presentation" style="font-family:Arial,sans-serif;width:100%;border-collapse:collapse"><tr><td style="color:#fff;font:700 17px/1.4 Arial,sans-serif;padding-bottom:8px">Railway cost projection</td><td style="color:#8f8f95;font:12px/1.4 Arial,sans-serif;text-align:right;padding-bottom:8px">Current billing period</td></tr>${detailRows(rows)}<tr><td colspan="2" style="border-top:1px solid #3a3a3d;padding-top:12px"></td></tr>${detailRows([
    ["Pizza Logs resources", money(cost.projectTotalUsd)],
    ["All workspace resources", money(cost.workspaceTotalUsd)],
    ["Expected workspace charge", money(cost.estimatedWorkspaceBillUsd)],
  ])}</table><div style="background:#18251d;border:1px solid #2d5137;border-radius:9px;color:#cce8d3;font-size:13px;line-height:1.5;margin-top:10px;padding:11px 12px">${htmlEscape(cost.planName)} includes the first ${htmlEscape(money(cost.planIncludedUsd))} of resource usage.</div><div style="color:#8f8f95;font-size:11px;line-height:1.5;margin-top:10px">Projected resource cost, captured ${htmlEscape(cost.capturedAt)}. Final invoices may include credits, taxes, adjustments, agent usage, or other workspace activity.</div></div>`;
}

function emailHtml({ eyebrow, title, intro, stats = [], details = [], cost, action = null, note = null }) {
  const statRows = [];
  for (let index = 0; index < stats.length; index += 3) {
    const cells = stats.slice(index, index + 3).map(([label, value]) => statCell(label, value));
    while (cells.length < 3) cells.push('<td style="width:33.33%;padding:8px"></td>');
    statRows.push(`<tr>${cells.join("")}</tr>`);
  }
  const actionHtml = action ? `<div style="margin:22px 0 4px"><a href="${htmlEscape(action.href)}" style="background:#ef4444;border-radius:9px;color:#fff;display:inline-block;font-size:14px;font-weight:700;padding:11px 17px;text-decoration:none">${htmlEscape(action.label)}</a></div>` : "";
  const detailsHtml = details.length ? `<div style="background:#1e1e20;border:1px solid #333336;border-radius:12px;margin-top:20px;padding:12px 16px"><table role="presentation" style="width:100%;border-collapse:collapse">${detailRows(details)}</table></div>` : "";
  const noteHtml = note ? `<div style="color:#a8a8ad;font-size:12px;line-height:1.55;margin-top:18px">${htmlEscape(note)}</div>` : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:600px){.email-pad{padding:20px!important}.stat-cell{display:block!important;width:auto!important}}</style></head><body style="background:#0e0e0f;font-family:Arial,sans-serif;margin:0;padding:0"><div style="background:#0e0e0f;padding:28px 12px"><table role="presentation" align="center" style="background:#171719;border:1px solid #303033;border-collapse:separate;border-radius:16px;font-family:Arial,sans-serif;max-width:680px;overflow:hidden;width:100%"><tr><td class="email-pad" style="border-top:4px solid #ef4444;font-family:Arial,sans-serif;padding:28px"><div style="color:#ef4444;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase">${htmlEscape(eyebrow)}</div><h1 style="color:#fff;font:700 26px/1.25 Arial,sans-serif;margin:8px 0 8px">${htmlEscape(title)}</h1><p style="color:#b8b8bd;font:14px/1.55 Arial,sans-serif;margin:0">${htmlEscape(intro)}</p>${statRows.length ? `<table role="presentation" style="border-collapse:collapse;font-family:Arial,sans-serif;margin:18px -8px 0;width:calc(100% + 16px)">${statRows.join("")}</table>` : ""}${detailsHtml}${actionHtml}${noteHtml}<div style="margin-top:22px">${costHtml(cost)}</div><div style="border-top:1px solid #303033;color:#77777d;font:11px/1.5 Arial,sans-serif;margin-top:24px;padding-top:16px">Pizza Logs operational notification</div></td></tr></table></div></body></html>`;
}

function headerText(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export function renderUploadEmail(payload, cost, config) {
  const reportPath = payload.firstSessionSlug
    ? `/raids/${encodeURIComponent(payload.publicReportSlug)}/sessions/${encodeURIComponent(payload.firstSessionSlug)}`
    : "/raids";
  const reportUrl = `${config.siteUrl}${reportPath}`;
  const text = [
    "New Pizza Logs upload",
    "",
    `Completed: ${payload.completedAt}`,
    `Uploader label: ${payload.uploaderName || "Not provided"}`,
    `Guild: ${payload.guildName || "Not provided"}`,
    `Realm: ${payload.realmName}`,
    `File: ${payload.filename} (${(Number(payload.fileSize) / 1_048_576).toFixed(1)} MiB)`,
    `Sessions: ${payload.sessionCount}`,
    `Encounters: ${payload.encountersInserted} new / ${payload.encountersFound} found`,
    `Warnings: ${payload.warningCount}`,
    `Report: ${reportUrl}`,
    "",
    formatCost(cost),
  ].join("\n");
  const title = payload.guildName || payload.realmName;
  const html = emailHtml({
    eyebrow: "New upload",
    title,
    intro: "A combat log finished processing and is ready to review.",
    stats: [
      ["Sessions", String(payload.sessionCount)],
      ["New encounters", String(payload.encountersInserted)],
      ["Warnings", String(payload.warningCount)],
    ],
    details: [
      ["Uploader", payload.uploaderName || "Not provided"],
      ["Realm", payload.realmName],
      ["File", `${payload.filename} (${(Number(payload.fileSize) / 1_048_576).toFixed(1)} MiB)`],
      ["Completed", payload.completedAt],
    ],
    action: { href: reportUrl, label: "Open raid report" },
    cost,
  });
  return { from: config.emailFrom, to: config.emailTo, subject: `Pizza Logs upload: ${headerText(title)}`, text, html };
}

export function renderDigestEmail(payload, traffic, counts, cost, config) {
  const trafficLines = traffic.available ? [
    `Web requests: ${traffic.requests.toLocaleString("en-US")}`,
    `2xx: ${traffic.statusFamilies.success.toLocaleString("en-US")}`,
    `3xx: ${traffic.statusFamilies.redirect.toLocaleString("en-US")}`,
    `4xx: ${traffic.statusFamilies.clientError.toLocaleString("en-US")}`,
    `5xx: ${traffic.statusFamilies.serverError.toLocaleString("en-US")}`,
    traffic.latency ? `Latency: p50 ${traffic.latency.p50} ms / p95 ${traffic.latency.p95} ms / p99 ${traffic.latency.p99} ms` : "Latency: unavailable",
  ] : [`Railway traffic metrics: unavailable (${traffic.code})`];
  const text = [
    `Pizza Logs daily digest — ${payload.date} UTC`,
    "",
    ...trafficLines,
    `New stored logs: ${counts.uploads.toLocaleString("en-US")}`,
    `New encounters: ${counts.encounters.toLocaleString("en-US")}`,
    `Terminal notification failures: ${counts.terminalNotificationFailures.toLocaleString("en-US")}`,
    "",
    "Traffic is all Railway edge requests to the Web service, including bots, assets, and health checks; it is not a unique-visitor count.",
    "No request IP addresses or user agents are stored by this digest.",
    "",
    formatCost(cost),
  ].join("\n");
  const html = emailHtml({
    eyebrow: "Daily digest",
    title: payload.date,
    intro: "Traffic and upload activity for the previous UTC day.",
    stats: traffic.available ? [
      ["Web requests", traffic.requests.toLocaleString("en-US")],
      ["Successful", traffic.statusFamilies.success.toLocaleString("en-US")],
      ["Server errors", traffic.statusFamilies.serverError.toLocaleString("en-US")],
      ["New logs", counts.uploads.toLocaleString("en-US")],
      ["Encounters", counts.encounters.toLocaleString("en-US")],
      ["Notification failures", counts.terminalNotificationFailures.toLocaleString("en-US")],
    ] : [
      ["Traffic", "Unavailable"],
      ["New logs", counts.uploads.toLocaleString("en-US")],
      ["Encounters", counts.encounters.toLocaleString("en-US")],
    ],
    details: traffic.available ? [
      ["Redirects (3xx)", traffic.statusFamilies.redirect.toLocaleString("en-US")],
      ["Client errors (4xx)", traffic.statusFamilies.clientError.toLocaleString("en-US")],
      ["Latency", traffic.latency ? `p50 ${traffic.latency.p50} ms · p95 ${traffic.latency.p95} ms · p99 ${traffic.latency.p99} ms` : "Unavailable"],
    ] : [["Traffic status", traffic.code]],
    note: "Traffic counts all Railway edge requests, including bots, assets, and health checks. It is not a unique-visitor count. No request IP addresses or user agents are stored.",
    cost,
  });
  return { from: config.emailFrom, to: config.emailTo, subject: `Pizza Logs daily digest — ${payload.date}`, text, html };
}

async function freezeRenderedEmail(pool, config, job, renderedEmail) {
  const table = tableName(config);
  const result = await pool.query(
    `UPDATE ${table} SET "renderedEmail" = COALESCE("renderedEmail", $2::jsonb), "updatedAt" = NOW()
     WHERE "id" = $1 AND "state" = 'PROCESSING' AND "leaseToken" = $3 RETURNING "renderedEmail"`,
    [job.id, JSON.stringify(renderedEmail), job.leaseToken],
  );
  if (!result.rows[0]) throw Object.assign(new Error("Notification lease was lost"), { code: "LEASE_LOST" });
  return result.rows[0].renderedEmail;
}

export async function sendResendEmail(config, job, email, fetchImpl = fetch) {
  const response = await fetchImpl(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `pizzalogs/${job.id}`,
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error("Email provider rejected the notification"), { code: `RESEND_HTTP_${response.status}` });
  const body = await response.json();
  if (!body.id) throw Object.assign(new Error("Email provider response had no message id"), { code: "RESEND_INVALID_RESPONSE" });
  return body.id;
}

async function markSent(pool, config, job, providerMessageId) {
  const result = await pool.query(
    `UPDATE ${tableName(config)} SET "state" = 'SENT', "providerMessageId" = $2, "sentAt" = NOW(),
       "leaseExpiresAt" = NULL, "leaseToken" = NULL, "lastErrorCode" = NULL, "updatedAt" = NOW()
     WHERE "id" = $1 AND "state" = 'PROCESSING' AND "leaseToken" = $3`,
    [job.id, providerMessageId, job.leaseToken],
  );
  if (result.rowCount !== 1) throw Object.assign(new Error("Notification lease was lost after delivery"), { code: "LEASE_LOST_AFTER_SEND" });
}

function safeErrorCode(error) {
  const candidate = typeof error?.code === "string" ? error.code : error?.name;
  return /^[A-Z0-9_]{1,80}$/.test(candidate ?? "") ? candidate : "NOTIFICATION_ERROR";
}

export async function releaseFailedJob(pool, config, job, error) {
  const terminal = job.attempts >= config.maxAttempts;
  const delayMinutes = Math.min(360, 2 ** Math.min(job.attempts, 8));
  const result = await pool.query(
    `UPDATE ${tableName(config)} SET "state" = $2::${notificationStateType(config)}, "availableAt" = NOW() + ($3 * INTERVAL '1 minute'),
       "leaseExpiresAt" = NULL, "leaseToken" = NULL, "lastErrorCode" = $4, "updatedAt" = NOW()
     WHERE "id" = $1 AND "state" = 'PROCESSING' AND "leaseToken" = $5`,
    [job.id, terminal ? "FAILED" : "PENDING", delayMinutes, safeErrorCode(error), job.leaseToken],
  );
  if (result.rowCount !== 1 && safeErrorCode(error) !== "LEASE_LOST_AFTER_SEND") {
    console.warn("[notifications] lease already transferred", { jobId: job.id, kind: job.kind });
  }
}

async function prepareEmail(pool, config, job, cost, fetchImpl) {
  if (job.renderedEmail) return job.renderedEmail;
  if (job.kind === "UPLOAD_COMPLETED") return freezeRenderedEmail(pool, config, job, renderUploadEmail(job.payload, cost, config));
  if (job.kind === "DAILY_DIGEST") {
    const window = { start: new Date(job.payload.start), end: new Date(job.payload.end) };
    const [traffic, counts] = await Promise.all([
      fetchRailwayTrafficSnapshot(config, window, fetchImpl),
      getDailyDatabaseCounts(pool, config, window),
    ]);
    return freezeRenderedEmail(pool, config, job, renderDigestEmail(job.payload, traffic, counts, cost, config));
  }
  throw Object.assign(new Error("Unknown notification kind"), { code: "UNKNOWN_NOTIFICATION_KIND" });
}

export async function runNotificationWorker({ env = process.env, now = new Date(), fetchImpl = fetch } = {}) {
  const startedAt = Date.now();
  const config = loadWorkerConfig(env);
  const connectionUrl = new URL(config.databaseUrl);
  connectionUrl.searchParams.delete("schema");
  const pool = new Pool({ connectionString: connectionUrl.toString(), max: 2, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 });
  let sent = 0;
  let failed = 0;
  try {
    await enqueueDailyDigest(pool, config, now);
    let cost;
    for (let index = 0; index < MAX_JOBS_PER_RUN && Date.now() - startedAt < MAX_RUNTIME_MS; index += 1) {
      const job = await claimNextJob(pool, config);
      if (!job) break;
      try {
        cost ??= await fetchRailwayCostSnapshot(config, fetchImpl);
        const email = await prepareEmail(pool, config, job, cost, fetchImpl);
        const providerMessageId = await sendResendEmail(config, job, email, fetchImpl);
        await markSent(pool, config, job, providerMessageId);
        sent += 1;
      } catch (error) {
        await releaseFailedJob(pool, config, job, error);
        console.error("[notifications] delivery failed", { jobId: job.id, kind: job.kind, code: safeErrorCode(error), attempt: job.attempts });
        failed += 1;
      }
    }
    console.log("[notifications] run complete", { sent, failed, railwayUsageAvailable: cost?.available ?? null });
    return { sent, failed, railwayUsageAvailable: cost?.available ?? null };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNotificationWorker().catch(error => {
    console.error("[notifications] worker failed", { code: safeErrorCode(error) });
    process.exitCode = 1;
  });
}
