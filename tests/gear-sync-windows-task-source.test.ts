import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import pkg from "../package.json";

const root = process.cwd();
const packageScripts = pkg.scripts as Record<string, string>;
const launcher = readFileSync(path.join(root, "scripts", "gear-sync", "open-warmane-gear-sync.ps1"), "utf8");
const installer = readFileSync(path.join(root, "scripts", "gear-sync", "install-windows-task.ps1"), "utf8");
const uninstaller = readFileSync(path.join(root, "scripts", "gear-sync", "uninstall-windows-task.ps1"), "utf8");
const docs = readFileSync(path.join(root, "docs", "gear-sync-windows-task.md"), "utf8");

assert.match(launcher, /https:\/\/armory\.warmane\.com\/character\/Lausudo\/Lordaeron\/summary/);
assert.match(launcher, /\.sync-agent-logs/);
assert.match(launcher, /chrome\.exe/i);
assert.match(launcher, /msedge\.exe/i);
assert.match(launcher, /Warmane Gear Sync userscript/i);

assert.match(installer, /PizzaLogsGearSync/);
assert.match(installer, /schtasks\.exe/i);
assert.match(installer, /GetFolderPath\("Startup"\)/);
assert.match(installer, /PizzaLogsGearSyncAtLogon\.vbs/);
assert.match(installer, /PizzaLogsGearSyncAtLogon\.cmd/);
assert.match(installer, /open-warmane-gear-sync\.ps1/);
assert.match(installer, /WindowStyle Hidden/);
assert.match(installer, /CreateStartupLauncher/);
assert.match(installer, /No Windows auto-open launcher was created/);
assert.match(installer, /WScript\.Shell/);
assert.match(installer, /Remove-ExistingTask/);
assert.match(installer, /\$escaped = \$Value\.Replace/);
assert.doesNotMatch(installer, /\/SC"\s*,\s*"MINUTE"/);
assert.doesNotMatch(installer, /ADMIN_SECRET|DATABASE_URL|RAILWAY_TOKEN/);

assert.match(uninstaller, /schtasks\.exe/i);
assert.match(uninstaller, /\/Delete/);
assert.match(uninstaller, /PizzaLogsGearSync/);
assert.match(uninstaller, /PizzaLogsGearSyncAtLogon\.cmd/);
assert.match(uninstaller, /PizzaLogsGearSyncAtLogon\.vbs/);
assert.match(uninstaller, /queryExitCode/);
assert.doesNotMatch(uninstaller, /\*>\s*\$null/);
assert.doesNotMatch(uninstaller, /ADMIN_SECRET|DATABASE_URL|RAILWAY_TOKEN/);

assert.match(docs, /does not store the Pizza Logs admin secret/i);
assert.match(docs, /Tampermonkey/i);
assert.match(docs, /Remove Windows Auto-Open Launchers/i);
assert.match(docs, /does not create a Startup launcher/i);
assert.match(docs, /Optional Logon Launcher/i);
assert.match(docs, /existing Warmane tab/i);
assert.match(docs, /does not create a new browser tab every hour/i);
assert.match(docs, /\.sync-agent-logs/);

assert.equal(
  packageScripts["gear-sync:install-task"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gear-sync/install-windows-task.ps1",
);
assert.equal(
  packageScripts["gear-sync:uninstall-task"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gear-sync/uninstall-windows-task.ps1",
);

console.log("gear-sync-windows-task-source tests passed");
