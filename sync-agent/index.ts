import { loadConfig } from "./config";
import { log } from "./logger";
import { runRosterJob } from "./jobs/roster";
import { runGearJob } from "./jobs/gear";

type ClaimedJob = { id: string; type: "ROSTER" | "GEAR" };

const config = loadConfig();

log.info(`Bridge starting — agent: ${config.agentId}`);
log.info(`Origin: ${config.origin}`);
if (config.dryRun) log.warn("DRY_RUN mode enabled — no data will be imported");

async function claimPendingJob(): Promise<ClaimedJob | null> {
  try {
    const res = await fetch(`${config.origin}/api/admin/sync/pending`, {
      headers: {
        "x-admin-secret": config.adminSecret,
        "x-agent-id": config.agentId,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; job: ClaimedJob | null };
    return data.ok ? data.job : null;
  } catch {
    return null;
  }
}

async function completeJob(
  jobId: string,
  success: boolean,
  result: unknown,
  error?: string
): Promise<void> {
  try {
    await fetch(`${config.origin}/api/admin/sync/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": config.adminSecret,
      },
      body: JSON.stringify({ jobId, success, result, error }),
    });
  } catch {}
}

async function triggerJob(type: "ROSTER" | "GEAR"): Promise<ClaimedJob | null> {
  try {
    const res = await fetch(`${config.origin}/api/admin/sync/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = (await res.json()) as { ok: boolean; jobId?: string };
    if (!data.ok || !data.jobId) return null;
    // Immediately claim the job we just created
    return await claimPendingJob();
  } catch {
    return null;
  }
}

async function runJob(job: ClaimedJob): Promise<void> {
  log.info(`Running job: ${job.type} (${job.id})`);
  try {
    const result =
      job.type === "ROSTER"
        ? await runRosterJob(config)
        : await runGearJob(config);

    const success = !result.error;
    await completeJob(job.id, success, result, result.error);
    log.info(`Job ${job.id} ${success ? "completed" : "failed"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Job ${job.id} threw:`, message);
    await completeJob(job.id, false, null, message);
  }
}

// Poll for manual trigger jobs
async function pollLoop(): Promise<void> {
  try {
    const job = await claimPendingJob();
    if (job) await runJob(job);
  } catch (err) {
    log.error("Poll loop error:", err);
  }
}

// Self-scheduler: create + run scheduled jobs
let lastRosterRun = 0;
let lastGearRun = 0;

async function schedulerTick(): Promise<void> {
  const now = Date.now();

  if (now - lastRosterRun >= config.rosterIntervalMs) {
    lastRosterRun = now;
    log.info("Scheduled ROSTER sync starting…");
    const job = await triggerJob("ROSTER");
    if (job) await runJob(job);
  }

  if (now - lastGearRun >= config.gearIntervalMs) {
    lastGearRun = now;
    log.info("Scheduled GEAR sync starting…");
    const job = await triggerJob("GEAR");
    if (job) await runJob(job);
  }
}

// Startup: run initial syncs after a short delay
setTimeout(async () => {
  log.info("Running startup sync…");
  lastRosterRun = Date.now();
  lastGearRun = Date.now();
  const rosterJob = await triggerJob("ROSTER");
  if (rosterJob) await runJob(rosterJob);
}, 15_000);

// Poll for manual trigger jobs every pollIntervalMs
setInterval(pollLoop, config.pollIntervalMs);

// Check scheduler every minute
setInterval(schedulerTick, 60_000);

log.info(
  `Bridge running — poll: ${config.pollIntervalMs / 1000}s, ` +
  `roster: ${config.rosterIntervalMs / 3_600_000}h, ` +
  `gear: ${config.gearIntervalMs / 3_600_000}h`
);
