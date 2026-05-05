param(
  [int[]]$Ports = @(3001, 8000)
)

$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
  $_.LocalPort -in $Ports
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  $isPizzaLogsServer = $process.CommandLine -match "PizzaLogs" -or
    $process.CommandLine -match "node_modules\\next\\dist" -or
    $process.CommandLine -match "uvicorn"

  if ($isPizzaLogsServer) {
    Stop-Process -Id $processId -Force
    Write-Output "Stopped $($process.Name) pid=$processId"
  } else {
    Write-Output "Skipped pid=$processId because it does not look like a Pizza Logs server"
  }
}
