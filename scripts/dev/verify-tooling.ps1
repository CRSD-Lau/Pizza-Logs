param(
  [switch]$Json
)

$ErrorActionPreference = "Continue"
$script:Failures = New-Object System.Collections.Generic.List[string]
$script:Warnings = New-Object System.Collections.Generic.List[string]

function Refresh-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($machine, $user) -join ";"
}

function Add-Failure {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL  $Message" -ForegroundColor Red
}

function Add-Warn {
  param([string]$Message)
  $script:Warnings.Add($Message) | Out-Null
  Write-Host "WARN  $Message" -ForegroundColor Yellow
}

function Add-Ok {
  param([string]$Message)
  Write-Host "OK    $Message" -ForegroundColor Green
}

function Get-Tool {
  param(
    [string]$Name,
    [switch]$Native
  )

  if ($Native) {
    $nativeCommand = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nativeCommand) {
      return $nativeCommand
    }
  }

  Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Get-VersionText {
  param(
    [string]$Command,
    [string[]]$Arguments = @("--version")
  )

  $cmd = Get-Tool $Command
  if (-not $cmd) {
    return $null
  }

  try {
    $output = & $Command @Arguments 2>&1 | Select-Object -First 3
    return (($output | ForEach-Object { $_.ToString() }) -join " | ")
  } catch {
    return "version check failed: $($_.Exception.Message)"
  }
}

function Test-Tool {
  param(
    [string]$Name,
    [string]$CommandName,
    [string[]]$VersionArgs = @("--version"),
    [switch]$Critical,
    [switch]$Native,
    [switch]$PresenceOnly
  )

  if (-not $CommandName) {
    $CommandName = $Name
  }

  $cmd = Get-Tool $CommandName -Native:$Native
  if (-not $cmd) {
    if ($Critical) {
      Add-Failure "$Name is missing from PATH."
    } else {
      Add-Warn "$Name is missing from PATH."
    }
    return [pscustomobject]@{ Name = $Name; Found = $false; Source = $null; Version = $null; Critical = [bool]$Critical }
  }

  $version = if ($PresenceOnly) { "present" } else { Get-VersionText -Command $CommandName -Arguments $VersionArgs }
  Add-Ok "$Name -> $($cmd.Source) :: $version"
  return [pscustomobject]@{ Name = $Name; Found = $true; Source = $cmd.Source; Version = $version; Critical = [bool]$Critical }
}

Refresh-SessionPath

Write-Host "Pizza Logs Windows tooling verification"
Write-Host "Repo: $((Resolve-Path -LiteralPath '.').Path)"
Write-Host ""

$toolResults = @()
$toolResults += Test-Tool -Name "winget" -Critical
$toolResults += Test-Tool -Name "git" -Critical
$toolResults += Test-Tool -Name "gh" -Critical
$toolResults += Test-Tool -Name "node" -Critical
$toolResults += Test-Tool -Name "npm" -Critical
$toolResults += Test-Tool -Name "npx" -Critical
$toolResults += Test-Tool -Name "pnpm" -Critical
$toolResults += Test-Tool -Name "python" -Critical
$toolResults += Test-Tool -Name "pip" -Critical
$toolResults += Test-Tool -Name "rg" -Critical
$toolResults += Test-Tool -Name "fd" -Critical
$toolResults += Test-Tool -Name "jq" -Critical
$toolResults += Test-Tool -Name "curl" -CommandName "curl.exe" -Native -Critical
$toolResults += Test-Tool -Name "tar" -Native -Critical
$toolResults += Test-Tool -Name "ssh" -Native -VersionArgs @("-V") -Critical
$toolResults += Test-Tool -Name "railway" -Critical
$toolResults += Test-Tool -Name "pwsh"
$toolResults += Test-Tool -Name "yarn"
$toolResults += Test-Tool -Name "vercel"
$toolResults += Test-Tool -Name "codex"
$toolResults += Test-Tool -Name "code"
$toolResults += Test-Tool -Name "wt" -PresenceOnly

Write-Host ""
Write-Host "Package managers"
if (Get-Tool "choco") {
  Add-Ok "choco -> $((Get-Tool 'choco').Source) :: $(Get-VersionText -Command 'choco' -Arguments @('--version'))"
} else {
  Add-Ok "choco not installed; not required."
}

if (Get-Tool "scoop") {
  Add-Ok "scoop -> $((Get-Tool 'scoop').Source) :: $(Get-VersionText -Command 'scoop' -Arguments @('--version'))"
} else {
  Add-Ok "scoop not installed; not required."
}

Write-Host ""
Write-Host "GitHub and git"
try {
  $auth = gh auth status 2>&1
  if ($LASTEXITCODE -eq 0) {
    Add-Ok "gh auth status succeeded."
    $auth | ForEach-Object { Write-Host "      $_" }
  } else {
    Add-Failure "gh auth status failed."
    $auth | ForEach-Object { Write-Host "      $_" }
  }
} catch {
  Add-Failure "gh auth status failed: $($_.Exception.Message)"
}

try {
  git remote -v
  git status --short --branch
  $expectedRepoRoot = [IO.Path]::GetFullPath("C:\Projects\PizzaLogs").TrimEnd([char[]]"\/")
  $repoRoot = [IO.Path]::GetFullPath((git rev-parse --show-toplevel)).TrimEnd([char[]]"\/")
  if ($repoRoot -ieq $expectedRepoRoot) {
    Add-Ok "Canonical desktop checkout is '$repoRoot'."
  } else {
    Add-Warn "This checkout is '$repoRoot'; the canonical desktop checkout is '$expectedRepoRoot'."
  }

  $remotes = @(git remote)
  if ($remotes.Count -eq 1 -and $remotes[0] -eq "origin") {
    Add-Ok "Only the canonical 'origin' remote is configured."
  } else {
    Add-Warn "Expected only the 'origin' remote; found: $($remotes -join ', ')."
  }

  $originUrl = git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0 -and $originUrl -eq "https://github.com/CRSD-Lau/Pizza-Logs.git") {
    Add-Ok "origin points to the canonical GitHub repository."
  } else {
    Add-Failure "origin must point to https://github.com/CRSD-Lau/Pizza-Logs.git; found '$originUrl'."
  }

  $branch = git branch --show-current
  if ($branch -eq "codex-dev") {
    Add-Ok "Current branch is the canonical working branch 'codex-dev'."
  } else {
    Add-Warn "Current branch is '$branch'; normal Codex work must use 'codex-dev'."
  }

  $upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
  if ($LASTEXITCODE -eq 0 -and $upstream -eq "origin/codex-dev") {
    Add-Ok "Current branch '$branch' tracks the canonical upstream '$upstream'."
  } elseif ($LASTEXITCODE -eq 0 -and $upstream) {
    Add-Warn "Current branch '$branch' tracks '$upstream'; expected 'origin/codex-dev'."
  } else {
    Add-Warn "Current branch '$branch' does not have an upstream or git could not resolve it."
  }

  git show-ref --verify --quiet refs/heads/main
  $hasLocalMain = $LASTEXITCODE -eq 0
  git show-ref --verify --quiet refs/remotes/origin/main
  $hasOriginMain = $LASTEXITCODE -eq 0
  if ($hasLocalMain -and $hasOriginMain) {
    $mainCounts = @((git rev-list --left-right --count main...origin/main) -split '\s+')
    if ($mainCounts.Count -ge 2 -and $mainCounts[0] -eq "0" -and $mainCounts[1] -eq "0") {
      Add-Ok "Local main matches origin/main and remains a reference-only branch."
    } else {
      Add-Warn "Local main differs from origin/main (local-only=$($mainCounts[0]), remote-only=$($mainCounts[1])). Do not develop on local main."
    }
  } else {
    Add-Warn "Could not compare local main with origin/main."
  }

  git show-ref --verify --quiet refs/heads/codex-dev
  $hasLocalCodex = $LASTEXITCODE -eq 0
  git show-ref --verify --quiet refs/remotes/origin/codex-dev
  $hasOriginCodex = $LASTEXITCODE -eq 0
  if ($hasLocalCodex -and $hasOriginCodex) {
    $codexCounts = @((git rev-list --left-right --count codex-dev...origin/codex-dev) -split '\s+')
    if ($codexCounts.Count -ge 2 -and $codexCounts[0] -eq "0" -and $codexCounts[1] -eq "0") {
      Add-Ok "codex-dev matches origin/codex-dev."
    } else {
      Add-Warn "codex-dev differs from origin/codex-dev (local-only=$($codexCounts[0]), remote-only=$($codexCounts[1]))."
    }
  } else {
    Add-Failure "Could not compare codex-dev with origin/codex-dev."
  }
} catch {
  Add-Failure "git repo checks failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Node project"
if (-not (Test-Path -LiteralPath "package.json")) {
  Add-Failure "package.json is missing."
} else {
  Add-Ok "package.json exists."
  try {
    $pkg = Get-Content -Raw -LiteralPath "package.json" | ConvertFrom-Json
    $scriptNames = @($pkg.scripts.PSObject.Properties.Name)
    Write-Host "      package name: $($pkg.name)"
    Write-Host "      scripts: $($scriptNames -join ', ')"
    foreach ($requiredScript in "dev","build","lint","type-check","db:generate","db:seed","db:import-items") {
      if ($scriptNames -contains $requiredScript) {
        Add-Ok "npm script '$requiredScript' exists."
      } else {
        Add-Warn "npm script '$requiredScript' is missing."
      }
    }
  } catch {
    Add-Failure "Could not parse package.json: $($_.Exception.Message)"
  }
}

$lockfiles = Get-ChildItem -LiteralPath . -File -Force | Where-Object {
  $_.Name -in @("package-lock.json","npm-shrinkwrap.json","pnpm-lock.yaml","yarn.lock")
}
if ($lockfiles.Name -contains "package-lock.json") {
  Add-Ok "npm lockfile detected; use npm ci --legacy-peer-deps for clean installs."
} elseif ($lockfiles.Count -gt 0) {
  Add-Warn "Non-npm lockfile detected: $($lockfiles.Name -join ', ')"
} else {
  Add-Warn "No package lockfile detected."
}

if (Test-Path -LiteralPath "node_modules") {
  Add-Ok "node_modules exists."
} else {
  Add-Warn "node_modules is missing; run npm ci --legacy-peer-deps."
}

Write-Host ""
Write-Host "Railway"
if (Get-Tool "railway") {
  try {
    $status = railway status 2>&1
    if ($LASTEXITCODE -eq 0) {
      Add-Ok "Railway project appears linked."
    } else {
      Add-Warn "Railway CLI is present but this checkout is not linked. No deploy was attempted."
    }
    $status | ForEach-Object { Write-Host "      $_" }
  } catch {
    Add-Warn "Railway status failed without deploying: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Summary"
Write-Host "Warnings: $($script:Warnings.Count)"
Write-Host "Failures: $($script:Failures.Count)"

if ($Json) {
  [pscustomobject]@{
    tools = $toolResults
    warnings = $script:Warnings
    failures = $script:Failures
  } | ConvertTo-Json -Depth 5
}

if ($script:Failures.Count -gt 0) {
  exit 1
}

exit 0
