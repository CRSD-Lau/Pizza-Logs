# Windows Gear Sync Automation

Pizza Logs can run Warmane gear refreshes from Neil's Windows PC without putting
anything on Railway. Warmane blocks plain server-side and CLI requests with 403,
so the safe default is to keep one real Warmane character tab open and let the
Tampermonkey Gear Sync userscript do the refresh from the browser.

The userscript keeps refreshing hourly inside the existing Warmane tab, so
Windows does not create a new browser tab every hour. The scripts in this folder
also remove the old scheduled-task and Startup launchers that opened Chrome.

## What It Does

- Removes old Pizza Logs scheduled tasks and Startup launchers that opened Chrome.
- Reuses the existing Warmane tab by letting the userscript schedule the hourly
  refresh in-page.
- Relies on the installed Pizza Logs Gear Sync userscript to refresh all known
  Pizza Logs characters.
- Writes launcher logs to `.sync-agent-logs/gear-sync-launcher.log`.

The launcher does not store the Pizza Logs admin secret, `DATABASE_URL`, Railway
tokens, or other production secrets. The admin secret remains wherever the
browser userscript stores it for `armory.warmane.com`.

## Prerequisites

1. Install or update the production Gear Sync userscript from `/admin`.
2. Open a Warmane character page.
3. Click `Sync now` once and enter the production admin secret.
4. Confirm Gear Sync shows the production target.

## Remove Windows Auto-Open Launchers

From the repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1
```

Or through npm:

```powershell
npm run gear-sync:install-task
```

By default, this does not create a Startup launcher. It cleans up the old
scheduled task and old `.cmd` / `.vbs` Startup launchers so Chrome stops opening
Warmane tabs automatically.

## Optional One-Time Open

To open the Warmane character page once from the script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -RunNow
```

By default `-RunNow` opens:

```text
https://armory.warmane.com/character/Lausudo/Lordaeron/summary
```

To use a different Warmane character page:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -RunNow -TargetUrl "https://armory.warmane.com/character/CharacterName/Lordaeron/summary"
```

To use the Windows default browser instead of auto-detecting Chrome or Edge:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -RunNow -UseDefaultBrowser
```

## Optional Logon Launcher

If you later decide you want Windows to open one Warmane tab at logon, opt in
explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\install-windows-task.ps1 -CreateStartupLauncher
```

## Run Or Inspect

```powershell
schtasks.exe /Query /TN PizzaLogsGearSync
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" | Where-Object Name -like "PizzaLogsGearSyncAtLogon*"
Get-Content .\.sync-agent-logs\gear-sync-launcher.log -Tail 20
```

## Uninstall

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gear-sync\uninstall-windows-task.ps1
```

Or through npm:

```powershell
npm run gear-sync:uninstall-task
```

## Limits

- This is browser-assisted automation, not a Railway-side worker.
- It cannot run before the Windows user logs in, because the browser and
  Tampermonkey need an interactive user profile.
- If the PC is asleep, offline, or the Warmane tab is closed, sync resumes after
  Neil opens a Warmane character page again.
- Background tab timers are owned by the browser; if Windows or the browser
  suspends the tab, the next sync can be delayed until the tab wakes.
