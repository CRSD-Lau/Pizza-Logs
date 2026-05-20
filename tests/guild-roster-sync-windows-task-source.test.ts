import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import pkg from "../package.json";

const root = process.cwd();
const packageScripts = pkg.scripts as Record<string, string>;
const launcher = readFileSync(path.join(root, "scripts", "guild-roster-sync", "open-warmane-guild-roster-sync.ps1"), "utf8");
const installer = readFileSync(path.join(root, "scripts", "guild-roster-sync", "install-windows-task.ps1"), "utf8");
const uninstaller = readFileSync(path.join(root, "scripts", "guild-roster-sync", "uninstall-windows-task.ps1"), "utf8");
const docs = readFileSync(path.join(root, "docs", "guild-roster-sync-windows-task.md"), "utf8");

assert.match(launcher, /https:\/\/armory\.warmane\.com\/guild\/Pizza\+Warriors\/Lordaeron\/summary/);
assert.match(launcher, /guild-roster-sync-launcher\.log/);
assert.match(launcher, /chrome\.exe/i);
assert.match(launcher, /msedge\.exe/i);
assert.match(launcher, /Warmane Guild Roster Sync userscript/i);
assert.match(launcher, /\/guild\/\[\^\/\]\+\/\[\^\/\]\+\/summary/);

assert.match(installer, /PizzaLogsGuildRosterSync/);
assert.match(installer, /schtasks\.exe/i);
assert.match(installer, /GetFolderPath\("Startup"\)/);
assert.match(installer, /PizzaLogsGuildRosterSyncAtLogon\.vbs/);
assert.match(installer, /PizzaLogsGuildRosterSyncAtLogon\.cmd/);
assert.match(installer, /open-warmane-guild-roster-sync\.ps1/);
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
assert.match(uninstaller, /PizzaLogsGuildRosterSync/);
assert.match(uninstaller, /PizzaLogsGuildRosterSyncAtLogon\.cmd/);
assert.match(uninstaller, /PizzaLogsGuildRosterSyncAtLogon\.vbs/);
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
assert.match(docs, /guild-roster-sync-launcher\.log/);

assert.equal(
  packageScripts["guild-roster-sync:install-task"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/guild-roster-sync/install-windows-task.ps1",
);
assert.equal(
  packageScripts["guild-roster-sync:uninstall-task"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/guild-roster-sync/uninstall-windows-task.ps1",
);

console.log("guild-roster-sync-windows-task-source tests passed");
