[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TaskName = "PizzaLogsGuildRosterSync",
  [string]$TargetUrl = "https://armory.warmane.com/guild/Pizza+Warriors/Lordaeron/summary",
  [string]$BrowserPath = "",
  [switch]$UseDefaultBrowser,
  [switch]$CreateStartupLauncher,
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$launcherPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "open-warmane-guild-roster-sync.ps1")).Path
$startupFolder = [Environment]::GetFolderPath("Startup")
$startupScriptPath = Join-Path $startupFolder "PizzaLogsGuildRosterSyncAtLogon.vbs"
$legacyStartupCommandPath = Join-Path $startupFolder "PizzaLogsGuildRosterSyncAtLogon.cmd"

$taskArguments = @(
  "-NoProfile",
  "-WindowStyle",
  "Hidden",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$launcherPath`"",
  "-TargetUrl",
  "`"$TargetUrl`""
)

if (-not [string]::IsNullOrWhiteSpace($BrowserPath)) {
  $taskArguments += @("-BrowserPath", "`"$BrowserPath`"")
}

if ($UseDefaultBrowser) {
  $taskArguments += "-UseDefaultBrowser"
}

$taskCommand = "powershell.exe $($taskArguments -join ' ')"
$schtasks = "schtasks.exe"

function Test-ExistingTask {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $schtasks /Query /TN $TaskName > $null 2>&1
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Invoke-Schtasks {
  param([string[]]$Arguments)

  & $schtasks @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "schtasks.exe failed with exit code $LASTEXITCODE."
  }
}

function Remove-ExistingTask {
  if (Test-ExistingTask) {
    if ($PSCmdlet.ShouldProcess($TaskName, "Delete old hourly Pizza Logs Guild Roster Sync scheduled task")) {
      Invoke-Schtasks @("/Delete", "/TN", $TaskName, "/F")
      Write-Host "Removed old scheduled task '$TaskName'."
    }
  }
}

function ConvertTo-VbsStringLiteral {
  param([string]$Value)
  $escaped = $Value.Replace('"', '""')
  return "`"$escaped`""
}

if ($PSCmdlet.ShouldProcess($TaskName, "Remove old Pizza Logs Guild Roster Sync scheduled task and startup launchers")) {
  Remove-ExistingTask

  if (Test-Path -LiteralPath $legacyStartupCommandPath) {
    Remove-Item -LiteralPath $legacyStartupCommandPath -Force
    Write-Host "Removed legacy startup launcher '$legacyStartupCommandPath'."
  }

  if (Test-Path -LiteralPath $startupScriptPath) {
    Remove-Item -LiteralPath $startupScriptPath -Force
    Write-Host "Removed startup launcher '$startupScriptPath'."
  }
}

if ($CreateStartupLauncher) {
  $vbsCommand = ConvertTo-VbsStringLiteral $taskCommand
  if ($PSCmdlet.ShouldProcess($startupScriptPath, "Create optional quiet Pizza Logs Guild Roster Sync startup launcher")) {
    Set-Content -LiteralPath $startupScriptPath -Value @(
      'Set shell = CreateObject("WScript.Shell")',
      "shell.Run $vbsCommand, 0, False"
    ) -Encoding ascii
    Write-Host "Created quiet startup launcher '$startupScriptPath'."
  }
}

if ($RunNow) {
  Start-Process -FilePath "powershell.exe" -ArgumentList $taskArguments -WindowStyle Hidden
}

if (-not $CreateStartupLauncher) {
  Write-Host "No Windows auto-open launcher was created. Keep an existing Warmane tab open for hourly sync."
}

if ($RunNow -or $CreateStartupLauncher) {
  Write-Host "Target URL: $TargetUrl"
}

Write-Host "The browser userscript owns the hourly refresh inside the existing Warmane tab."
