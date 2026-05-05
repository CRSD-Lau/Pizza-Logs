param(
  [int]$WebPort = 3001,
  [int]$ParserPort = 8000
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$NodePath = $env:PIZZA_LOGS_NODE
$PythonPath = $env:PIZZA_LOGS_PYTHON

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$timestamp] $Message" | Add-Content -LiteralPath (Join-Path $RepoRoot ".next-local-test-server.log")
}

function Resolve-Executable {
  param(
    [string]$ExplicitPath,
    [string[]]$Candidates,
    [string]$CommandName,
    [string]$Label
  )

  if ($ExplicitPath -and (Test-Path -LiteralPath $ExplicitPath)) {
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "$Label executable was not found. Set PIZZA_LOGS_$($Label.ToUpper()) or install $CommandName on PATH."
}

function Test-LocalPort {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
      $_.LocalPort -eq $Port -and ($_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::")
    })
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

Set-Location -LiteralPath $RepoRoot

$NodePath = Resolve-Executable `
  -ExplicitPath $NodePath `
  -Candidates @("$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe") `
  -CommandName "node.exe" `
  -Label "NODE"

$PythonPath = Resolve-Executable `
  -ExplicitPath $PythonPath `
  -Candidates @(
    (Join-Path $RepoRoot "parser\.venv\Scripts\python.exe"),
    "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
  ) `
  -CommandName "python.exe" `
  -Label "PYTHON"

Write-Log "Launcher starting. Repo=$RepoRoot WebPort=$WebPort ParserPort=$ParserPort"

$postgres = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($postgres) {
  if ($postgres.Status -ne "Running") {
    try {
      Start-Service -Name $postgres.Name
      Write-Log "Started PostgreSQL service $($postgres.Name)."
    } catch {
      Write-Log "Could not start PostgreSQL service $($postgres.Name): $($_.Exception.Message)"
    }
  } else {
    Write-Log "PostgreSQL service $($postgres.Name) is already running."
  }
} else {
  Write-Log "No PostgreSQL service named postgresql* was found."
}

if (-not (Test-LocalPort -Port $ParserPort)) {
  $parserOut = Join-Path $RepoRoot ".next-parser-test-server.out.log"
  $parserErr = Join-Path $RepoRoot ".next-parser-test-server.err.log"
  Start-Process `
    -FilePath $PythonPath `
    -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$ParserPort") `
    -WorkingDirectory (Join-Path $RepoRoot "parser") `
    -RedirectStandardOutput $parserOut `
    -RedirectStandardError $parserErr `
    -WindowStyle Hidden
  Write-Log "Started parser service on 127.0.0.1:$ParserPort."
} else {
  Write-Log "Parser service already listening on port $ParserPort."
}

if (-not (Test-LocalPort -Port $WebPort)) {
  $webOut = Join-Path $RepoRoot ".next-test-server-$WebPort.out.log"
  $webErr = Join-Path $RepoRoot ".next-test-server-$WebPort.err.log"
  Start-Process `
    -FilePath $NodePath `
    -ArgumentList @("node_modules\next\dist\bin\next", "dev", "-H", "127.0.0.1", "-p", "$WebPort") `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $webOut `
    -RedirectStandardError $webErr `
    -WindowStyle Hidden
  Write-Log "Started Next.js dev server on 127.0.0.1:$WebPort."
} else {
  Write-Log "Next.js dev server already listening on port $WebPort."
}

$parserOk = Wait-HttpOk -Url "http://127.0.0.1:$ParserPort/health" -TimeoutSeconds 60
$webOk = Wait-HttpOk -Url "http://127.0.0.1:$WebPort/" -TimeoutSeconds 120

Write-Log "Health results: parser=$parserOk web=$webOk"

if (-not $parserOk -or -not $webOk) {
  exit 1
}

exit 0
