import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "--test", "tests/*.test.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL
        ?? "postgresql://test:test@127.0.0.1:1/pizza_logs_test?connect_timeout=1",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
