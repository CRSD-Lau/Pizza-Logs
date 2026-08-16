param(
  [string]$Source = "animations/source/Veo.mp4"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$SourcePath = Join-Path $Root $Source
$Ffmpeg = $env:FFMPEG
$Ffprobe = $env:FFPROBE

if (-not $Ffmpeg) {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { $Ffmpeg = $cmd.Source }
}

if (-not $Ffprobe) {
  $cmd = Get-Command ffprobe -ErrorAction SilentlyContinue
  if ($cmd) { $Ffprobe = $cmd.Source }
}

$BundledBin = Join-Path $Root "tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin"
if (-not $Ffmpeg -and (Test-Path (Join-Path $BundledBin "ffmpeg.exe"))) {
  $Ffmpeg = Join-Path $BundledBin "ffmpeg.exe"
}
if (-not $Ffprobe -and (Test-Path (Join-Path $BundledBin "ffprobe.exe"))) {
  $Ffprobe = Join-Path $BundledBin "ffprobe.exe"
}

if (-not $Ffmpeg) { throw "ffmpeg was not found. Install FFmpeg or set FFMPEG to the executable path." }
if (-not $Ffprobe) { throw "ffprobe was not found. Install FFmpeg or set FFPROBE to the executable path." }
if (-not (Test-Path $SourcePath)) { throw "Intro source video was not found at $SourcePath" }

$OutputDirs = @(
  "public/animations/desktop",
  "public/animations/mobile",
  "public/animations/posters"
)

foreach ($dir in $OutputDirs) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $dir) | Out-Null
}

$GeneratedFiles = @(
  "public/animations/desktop/intro-1080p.webm",
  "public/animations/desktop/intro-1440p.webm",
  "public/animations/desktop/intro-4k.webm",
  "public/animations/desktop/intro-1080p.mp4",
  "public/animations/desktop/intro-1440p.mp4",
  "public/animations/desktop/intro-4k.mp4",
  "public/animations/mobile/intro-mobile-720x1280.webm",
  "public/animations/mobile/intro-mobile-1080x1920.webm",
  "public/animations/mobile/intro-mobile-1440x2560.webm",
  "public/animations/mobile/intro-mobile-720x1280.mp4",
  "public/animations/mobile/intro-mobile-1080x1920.mp4",
  "public/animations/mobile/intro-mobile-1440x2560.mp4",
  "public/animations/posters/desktop-poster.jpg",
  "public/animations/posters/mobile-poster.jpg"
)

foreach ($file in $GeneratedFiles) {
  $path = Join-Path $Root $file
  if (Test-Path $path) { Remove-Item -LiteralPath $path -Force }
}

function Invoke-FFmpeg {
  param([string[]]$Arguments)

  & $Ffmpeg @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed with exit code $LASTEXITCODE"
  }
}

function Render-WebM {
  param(
    [string]$Filter,
    [string]$Output,
    [int]$Crf
  )

  Invoke-FFmpeg -Arguments @(
    "-y", "-i", $SourcePath,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", $Filter,
    "-r", "24",
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuv420p",
    "-b:v", "0",
    "-crf", "$Crf",
    "-deadline", "good",
    "-cpu-used", "3",
    "-row-mt", "1",
    "-g", "48",
    "-tile-columns", "2",
    "-c:a", "libopus",
    "-b:a", "96k",
    "-ac", "2",
    "-shortest",
    (Join-Path $Root $Output)
  )
}

function Render-Mp4 {
  param(
    [string]$Filter,
    [string]$Output,
    [int]$Crf
  )

  Invoke-FFmpeg -Arguments @(
    "-y", "-i", $SourcePath,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", $Filter,
    "-r", "24",
    "-c:v", "libx264",
    "-preset", "slow",
    "-profile:v", "high",
    "-level:v", "5.2",
    "-pix_fmt", "yuv420p",
    "-crf", "$Crf",
    "-g", "48",
    "-keyint_min", "48",
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-shortest",
    "-movflags", "+faststart",
    (Join-Path $Root $Output)
  )
}

$DesktopCrop = "crop=1200:675:0:0"
$MobileCrop = "crop=405:720:(iw-405)/2:0"

$Desktop = @(
  @{ Name = "intro-1080p"; Size = "1920:1080"; WebmCrf = 31; Mp4Crf = 22 },
  @{ Name = "intro-1440p"; Size = "2560:1440"; WebmCrf = 33; Mp4Crf = 23 },
  @{ Name = "intro-4k"; Size = "3840:2160"; WebmCrf = 36; Mp4Crf = 24 }
)

$Mobile = @(
  @{ Name = "intro-mobile-720x1280"; Size = "720:1280"; WebmCrf = 32; Mp4Crf = 23 },
  @{ Name = "intro-mobile-1080x1920"; Size = "1080:1920"; WebmCrf = 34; Mp4Crf = 24 },
  @{ Name = "intro-mobile-1440x2560"; Size = "1440:2560"; WebmCrf = 36; Mp4Crf = 25 }
)

foreach ($variant in $Desktop) {
  $filter = "$DesktopCrop,scale=$($variant.Size):flags=lanczos"
  Render-WebM -Filter $filter -Output "public/animations/desktop/$($variant.Name).webm" -Crf $variant.WebmCrf
  Render-Mp4 -Filter $filter -Output "public/animations/desktop/$($variant.Name).mp4" -Crf $variant.Mp4Crf
}

foreach ($variant in $Mobile) {
  $filter = "$MobileCrop,scale=$($variant.Size):flags=lanczos"
  Render-WebM -Filter $filter -Output "public/animations/mobile/$($variant.Name).webm" -Crf $variant.WebmCrf
  Render-Mp4 -Filter $filter -Output "public/animations/mobile/$($variant.Name).mp4" -Crf $variant.Mp4Crf
}

Invoke-FFmpeg -Arguments @(
  "-y", "-ss", "4", "-i", $SourcePath,
  "-vf", "$DesktopCrop,scale=1920:1080:flags=lanczos",
  "-frames:v", "1",
  "-q:v", "3",
  (Join-Path $Root "public/animations/posters/desktop-poster.jpg")
)

Invoke-FFmpeg -Arguments @(
  "-y", "-ss", "4", "-i", $SourcePath,
  "-vf", "$MobileCrop,scale=720:1280:flags=lanczos",
  "-frames:v", "1",
  "-q:v", "3",
  (Join-Path $Root "public/animations/posters/mobile-poster.jpg")
)

& $Ffprobe -v error -show_entries format=duration,size -of compact=p=0:nk=1 (Join-Path $Root "public/animations/desktop/intro-1080p.webm")
Write-Host "Rendered intro videos into public/animations/."
