import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

const envFile = join(process.cwd(), ".env.sync-agent");
if (existsSync(envFile)) {
  loadEnv({ path: envFile });
}

export type SyncConfig = {
  origin: string;
  adminSecret: string;
  agentId: string;
  pollIntervalMs: number;
  rosterIntervalMs: number;
  gearIntervalMs: number;
  requestDelayMs: number;
  dryRun: boolean;
};

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optionalNumber(name: string, defaultVal: number): number {
  const val = process.env[name];
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

export function loadConfig(): SyncConfig {
  return {
    origin:
      process.env.PIZZA_LOGS_ORIGIN ??
      "https://pizza-logs-production.up.railway.app",
    adminSecret: requireEnv("PIZZA_ADMIN_SECRET"),
    agentId:
      process.env.SYNC_AGENT_ID ??
      `agent-${process.platform}-${process.pid}`,
    pollIntervalMs: optionalNumber("POLL_INTERVAL_MS", 5_000),
    rosterIntervalMs:
      optionalNumber("ROSTER_INTERVAL_HOURS", 6) * 60 * 60 * 1000,
    gearIntervalMs:
      optionalNumber("GEAR_INTERVAL_HOURS", 12) * 60 * 60 * 1000,
    requestDelayMs: optionalNumber("REQUEST_DELAY_MS", 2_500),
    dryRun: process.env.DRY_RUN === "true",
  };
}
