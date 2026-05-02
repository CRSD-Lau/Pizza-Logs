import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), ".sync-agent-logs");
const LOG_FILE = join(LOG_DIR, "sync.log");

if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, ...args: unknown[]): void {
  const parts = args.map((a) =>
    typeof a === "string" ? a : JSON.stringify(a)
  );
  const line = `[${timestamp()}] [${level}] ${parts.join(" ")}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

export const log = {
  info: (...args: unknown[]) => write("INFO", ...args),
  warn: (...args: unknown[]) => write("WARN", ...args),
  error: (...args: unknown[]) => write("ERROR", ...args),
};
