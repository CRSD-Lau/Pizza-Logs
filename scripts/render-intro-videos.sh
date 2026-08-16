#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-animations/source/Veo.mp4}"
SOURCE_PATH="$ROOT/$SOURCE"

FFMPEG_BIN="${FFMPEG:-$(command -v ffmpeg || true)}"
FFPROBE_BIN="${FFPROBE:-$(command -v ffprobe || true)}"

if [[ -z "$FFMPEG_BIN" && -x "$ROOT/tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe" ]]; then
  FFMPEG_BIN="$ROOT/tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe"
fi

if [[ -z "$FFPROBE_BIN" && -x "$ROOT/tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffprobe.exe" ]]; then
  FFPROBE_BIN="$ROOT/tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffprobe.exe"
fi

if [[ -z "$FFMPEG_BIN" ]]; then
  echo "ffmpeg was not found. Install FFmpeg or set FFMPEG to the executable path." >&2
  exit 1
fi

if [[ -z "$FFPROBE_BIN" ]]; then
  echo "ffprobe was not found. Install FFmpeg or set FFPROBE to the executable path." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_PATH" ]]; then
  echo "Intro source video was not found at $SOURCE_PATH" >&2
  exit 1
fi

mkdir -p \
  "$ROOT/public/animations/desktop" \
  "$ROOT/public/animations/mobile" \
  "$ROOT/public/animations/posters"

generated_files=(
  public/animations/desktop/intro-1080p.webm
  public/animations/desktop/intro-1440p.webm
  public/animations/desktop/intro-4k.webm
  public/animations/desktop/intro-1080p.mp4
  public/animations/desktop/intro-1440p.mp4
  public/animations/desktop/intro-4k.mp4
  public/animations/mobile/intro-mobile-720x1280.webm
  public/animations/mobile/intro-mobile-1080x1920.webm
  public/animations/mobile/intro-mobile-1440x2560.webm
  public/animations/mobile/intro-mobile-720x1280.mp4
  public/animations/mobile/intro-mobile-1080x1920.mp4
  public/animations/mobile/intro-mobile-1440x2560.mp4
  public/animations/posters/desktop-poster.jpg
  public/animations/posters/mobile-poster.jpg
)

for file in "${generated_files[@]}"; do
  rm -f "$ROOT/$file"
done

render_webm() {
  local filter="$1"
  local output="$2"
  local crf="$3"

  "$FFMPEG_BIN" -y -i "$SOURCE_PATH" \
    -map 0:v:0 \
    -map '0:a:0?' \
    -vf "$filter" \
    -r 24 \
    -c:v libvpx-vp9 \
    -pix_fmt yuv420p \
    -b:v 0 \
    -crf "$crf" \
    -deadline good \
    -cpu-used 3 \
    -row-mt 1 \
    -g 48 \
    -tile-columns 2 \
    -c:a libopus \
    -b:a 96k \
    -ac 2 \
    -shortest \
    "$ROOT/$output"
}

render_mp4() {
  local filter="$1"
  local output="$2"
  local crf="$3"

  "$FFMPEG_BIN" -y -i "$SOURCE_PATH" \
    -map 0:v:0 \
    -map '0:a:0?' \
    -vf "$filter" \
    -r 24 \
    -c:v libx264 \
    -preset slow \
    -profile:v high \
    -level:v 5.2 \
    -pix_fmt yuv420p \
    -crf "$crf" \
    -g 48 \
    -keyint_min 48 \
    -sc_threshold 0 \
    -c:a aac \
    -b:a 128k \
    -ac 2 \
    -shortest \
    -movflags +faststart \
    "$ROOT/$output"
}

desktop_crop="crop=1200:675:0:0"
mobile_crop="crop=405:720:(iw-405)/2:0"

render_webm "$desktop_crop,scale=1920:1080:flags=lanczos" "public/animations/desktop/intro-1080p.webm" 31
render_mp4 "$desktop_crop,scale=1920:1080:flags=lanczos" "public/animations/desktop/intro-1080p.mp4" 22
render_webm "$desktop_crop,scale=2560:1440:flags=lanczos" "public/animations/desktop/intro-1440p.webm" 33
render_mp4 "$desktop_crop,scale=2560:1440:flags=lanczos" "public/animations/desktop/intro-1440p.mp4" 23
render_webm "$desktop_crop,scale=3840:2160:flags=lanczos" "public/animations/desktop/intro-4k.webm" 36
render_mp4 "$desktop_crop,scale=3840:2160:flags=lanczos" "public/animations/desktop/intro-4k.mp4" 24

render_webm "$mobile_crop,scale=720:1280:flags=lanczos" "public/animations/mobile/intro-mobile-720x1280.webm" 32
render_mp4 "$mobile_crop,scale=720:1280:flags=lanczos" "public/animations/mobile/intro-mobile-720x1280.mp4" 23
render_webm "$mobile_crop,scale=1080:1920:flags=lanczos" "public/animations/mobile/intro-mobile-1080x1920.webm" 34
render_mp4 "$mobile_crop,scale=1080:1920:flags=lanczos" "public/animations/mobile/intro-mobile-1080x1920.mp4" 24
render_webm "$mobile_crop,scale=1440:2560:flags=lanczos" "public/animations/mobile/intro-mobile-1440x2560.webm" 36
render_mp4 "$mobile_crop,scale=1440:2560:flags=lanczos" "public/animations/mobile/intro-mobile-1440x2560.mp4" 25

"$FFMPEG_BIN" -y -ss 4 -i "$SOURCE_PATH" \
  -vf "$desktop_crop,scale=1920:1080:flags=lanczos" \
  -frames:v 1 \
  -q:v 3 \
  "$ROOT/public/animations/posters/desktop-poster.jpg"

"$FFMPEG_BIN" -y -ss 4 -i "$SOURCE_PATH" \
  -vf "$mobile_crop,scale=720:1280:flags=lanczos" \
  -frames:v 1 \
  -q:v 3 \
  "$ROOT/public/animations/posters/mobile-poster.jpg"

"$FFPROBE_BIN" -v error -show_entries format=duration,size -of compact=p=0:nk=1 "$ROOT/public/animations/desktop/intro-1080p.webm"
echo "Rendered intro videos into public/animations/."
