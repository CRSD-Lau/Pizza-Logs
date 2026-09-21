import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const prismaConfigUrl = pathToFileURL(resolve("prisma.config.ts")).href;
const tsxUrl = pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href;

test("Prisma environment loading preserves process, local, and default precedence quietly", () => {
  const directory = mkdtempSync(join(tmpdir(), "pizza-env-test-"));
  const localUrl = "postgresql://fixture:fixture@localhost/local";
  const defaultUrl = "postgresql://fixture:fixture@localhost/default";
  const processUrl = "postgresql://fixture:fixture@localhost/process";
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.DOTENV_CONFIG_QUIET;
  delete env.DOTENV_CONFIG_DEBUG;
  delete env.DOTENV_CONFIG_OVERRIDE;

  function load(databaseUrl?: string) {
    const result = spawnSync(process.execPath, [
      "--import", tsxUrl, "--input-type=module", "--eval",
      `import config from ${JSON.stringify(prismaConfigUrl)}; process.stdout.write(JSON.stringify((config.default ?? config).datasource.url));`,
    ], {
      cwd: directory,
      env: databaseUrl ? { ...env, DATABASE_URL: databaseUrl } : env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "", "quiet environment loading must not write diagnostics");
    return JSON.parse(result.stdout);
  }

  try {
    assert.equal(load(), "postgresql://pizzalogs-build-only:invalid@localhost:5432/pizzalogs");
    writeFileSync(join(directory, ".env"), `DATABASE_URL=${defaultUrl}\n`);
    assert.equal(load(), defaultUrl);
    writeFileSync(join(directory, ".env.local"), `DATABASE_URL=${localUrl}\n`);
    assert.equal(load(), localUrl);
    assert.equal(load(processUrl), processUrl);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
});
