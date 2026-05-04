# HD Cinematic Intro Asset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a review-only high-definition cinematic intro asset package for Pizza Logs without integrating it into the website.

**Current note:** This plan is historical. The live intro is now integrated and the retained local render workspace is `animations/hd_cinematic_intro/`, with the current crisp renderer at `animations/hd_cinematic_intro/render_web_cinematic_crisp.py`. The older `render_hd_cinematic.py`, `rendered/`, frame dumps, and site-integration screenshot folders were cleaned up after the later responsive/crisp render passes.

**Architecture:** Generate new HD cinematic key art from the approved storyboard direction, then assemble it into a short review animation package isolated under `animations/hd_cinematic_intro/`. The repo app code remains untouched; the output is a visual approval artifact only.

**Tech Stack:** Image generation for HD key shots, Python/Pillow/numpy/imageio-ffmpeg for compositing and video output, local files under `animations/`.

---

### Task 1: Generate HD Key Shot Set

**Files:**
- Create: `animations/hd_cinematic_intro/key_shots/shot_01_snowfield.png`
- Create: `animations/hd_cinematic_intro/key_shots/shot_02_approach_back.png`
- Create: `animations/hd_cinematic_intro/key_shots/shot_03_shoulder_turn.png`
- Create: `animations/hd_cinematic_intro/key_shots/shot_04_eye_ignite.png`
- Create: `animations/hd_cinematic_intro/key_shots/shot_05_closeup_hold.png`
- Create: `animations/hd_cinematic_intro/key_shots/shot_06_fade_plate.png`

- [ ] **Step 1: Generate six original cinematic key shots**

Use image generation with this art direction for each shot:

```text
Create an original high-definition cinematic 16:9 frame for a dark fantasy raid analytics website intro. Style: modern premium cinematic, Warcraft/WotLK Icecrown Citadel inspired but not copied, no logos, no text, no UI. Subject: original frost-armored undead king-like raid boss in heavy blackened steel plate armor, spiked crown helmet, ragged fur cloak, glowing icy blue eyes only in later shots. Environment: brutal arctic snowfield, blizzard, blue-gray moonlit atmosphere, volumetric fog, sharp realistic lighting, high-detail armor, cinematic motion-picture composition, no cartoon style, no old game graphics, no low-res look.
```

Shot-specific additions:

```text
shot_01_snowfield: distant small silhouette walking through a wide frozen wasteland, heavy snow, huge negative space, no visible face.
shot_02_approach_back: rear three-quarter view, cloak and armor clearer, camera closer behind the figure.
shot_03_shoulder_turn: close shoulder/back composition, helmet begins turning toward camera, one faint blue eye glow starts.
shot_04_eye_ignite: front three-quarter medium close-up, both blue eyes ignite, snow streaks across lens.
shot_05_closeup_hold: intense helmet close-up, glowing blue eyes, intricate frost armor, premium cinematic lighting.
shot_06_fade_plate: dark frost/fog transitional plate with faint silhouette and blue glow, suitable for fading into a website.
```

- [ ] **Step 2: Save generated shots**

Save each accepted image exactly at the file paths listed above. If generation returns a non-16:9 image, crop or pad it to 16:9 without distorting the subject.

- [ ] **Step 3: Review key shots**

Open the six saved images and reject any shot that has visible text, UI, logos, cartoon styling, obvious low-resolution artifacts, or a copied game/model look.

### Task 2: Create Compositor Script

**Files:**
- Create: `animations/hd_cinematic_intro/render_hd_cinematic.py`

- [ ] **Step 1: Write compositor script**

Create a Python script with these responsibilities:

```python
from __future__ import annotations

from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import imageio.v2 as imageio

ROOT = Path(__file__).resolve().parent
KEY_DIR = ROOT / "key_shots"
OUT_DIR = ROOT / "rendered"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WIDTH = 1920
HEIGHT = 1080
FPS = 60
DURATION_SECONDS = 5
FRAME_COUNT = FPS * DURATION_SECONDS

SHOTS = [
    KEY_DIR / "shot_01_snowfield.png",
    KEY_DIR / "shot_02_approach_back.png",
    KEY_DIR / "shot_03_shoulder_turn.png",
    KEY_DIR / "shot_04_eye_ignite.png",
    KEY_DIR / "shot_05_closeup_hold.png",
    KEY_DIR / "shot_06_fade_plate.png",
]

def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)

def cover(image: Image.Image, scale: float, dx: float, dy: float) -> Image.Image:
    image = image.convert("RGB")
    base = max(WIDTH / image.width, HEIGHT / image.height) * scale
    resized = image.resize((round(image.width * base), round(image.height * base)), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - WIDTH)
    max_y = max(0, resized.height - HEIGHT)
    x = round(max(0, min(max_x, max_x / 2 + dx * max_x / 2)))
    y = round(max(0, min(max_y, max_y / 2 + dy * max_y / 2)))
    return resized.crop((x, y, x + WIDTH, y + HEIGHT))

def load_shots() -> list[Image.Image]:
    missing = [str(path) for path in SHOTS if not path.exists()]
    if missing:
        raise FileNotFoundError("\\n".join(missing))
    return [Image.open(path).convert("RGB") for path in SHOTS]

def shot_pair(t: float, shots: list[Image.Image]) -> tuple[Image.Image, Image.Image, float, int]:
    stops = [0.00, 0.18, 0.36, 0.55, 0.75, 0.92, 1.00]
    for index in range(len(stops) - 1):
        if stops[index] <= t <= stops[index + 1]:
            local = (t - stops[index]) / (stops[index + 1] - stops[index])
            return shots[index], shots[min(index + 1, len(shots) - 1)], ease(local), index
    return shots[-1], shots[-1], 1.0, len(shots) - 1

def camera(index: int, local: float) -> tuple[float, float, float]:
    if index == 0:
        return 1.00 + 0.10 * local, 0.00, -0.03
    if index == 1:
        return 1.05 + 0.09 * local, 0.02, -0.02
    if index == 2:
        return 1.08 + 0.08 * local, -0.03, -0.02
    if index == 3:
        return 1.10 + 0.06 * local, 0.00, -0.01
    if index == 4:
        return 1.04 + 0.03 * local, 0.00, 0.00
    return 1.00, 0.00, 0.00

def storm_overlay(frame: Image.Image, t: float, rng: np.random.Generator) -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    intensity = 0.55 + 0.45 * math.sin(min(1.0, t * 1.3) * math.pi)
    for _ in range(180):
        x = int(rng.uniform(-WIDTH * 0.1, WIDTH * 1.1))
        y = int(rng.uniform(0, HEIGHT))
        length = int(rng.uniform(12, 62) * intensity)
        alpha = int(rng.uniform(28, 115) * intensity)
        draw.line((x, y, x + length, y - length * 0.35), fill=(220, 244, 255, alpha), width=1)
    return Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

def grade(frame: Image.Image, t: float) -> Image.Image:
    frame = ImageEnhance.Contrast(frame).enhance(1.06)
    frame = ImageEnhance.Color(frame).enhance(1.03)
    if t > 0.90:
        fade = ease((t - 0.90) / 0.10)
        black = Image.new("RGB", frame.size, (2, 6, 12))
        frame = Image.blend(frame, black, fade * 0.78)
    return frame

def render() -> None:
    shots = load_shots()
    rng = np.random.default_rng(20260504)
    mp4 = OUT_DIR / "intro_hd_cinematic_review.mp4"
    webm = OUT_DIR / "intro_hd_cinematic_review.webm"
    frames = []
    for number in range(FRAME_COUNT):
        t = number / (FRAME_COUNT - 1)
        a, b, blend, index = shot_pair(t, shots)
        scale, dx, dy = camera(index, blend)
        frame_a = cover(a, scale, dx, dy)
        frame_b = cover(b, scale, dx, dy)
        frame = Image.blend(frame_a, frame_b, blend)
        frame = storm_overlay(frame, t, rng)
        frame = grade(frame, t)
        frames.append(frame)
        frame.save(OUT_DIR / f"frame_{number + 1:04d}.jpg", quality=92)

    writer = imageio.get_writer(mp4, fps=FPS, codec="libx264", macro_block_size=1, ffmpeg_params=["-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-movflags", "+faststart"])
    for frame in frames:
        writer.append_data(np.asarray(frame, dtype=np.uint8))
    writer.close()

    writer = imageio.get_writer(webm, fps=FPS, codec="libvpx-vp9", macro_block_size=1, ffmpeg_params=["-b:v", "0", "-crf", "26", "-deadline", "good", "-cpu-used", "2"])
    for frame in frames:
        writer.append_data(np.asarray(frame, dtype=np.uint8))
    writer.close()

    frames[FRAME_COUNT // 2].save(OUT_DIR / "poster.jpg", quality=94)

if __name__ == "__main__":
    render()
```

### Task 3: Render Review Animation

**Files:**
- Create: `animations/hd_cinematic_intro/rendered/intro_hd_cinematic_review.mp4`
- Create: `animations/hd_cinematic_intro/rendered/intro_hd_cinematic_review.webm`
- Create: `animations/hd_cinematic_intro/rendered/poster.jpg`
- Create: `animations/hd_cinematic_intro/rendered/frame_0001.jpg` through `frame_0300.jpg`

- [ ] **Step 1: Run the compositor**

Run:

```powershell
& 'C:\Users\neil_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\neil_\OneDrive\Desktop\PizzaLogs\animations\hd_cinematic_intro\render_hd_cinematic.py'
```

Expected:

```text
No Python traceback.
Rendered folder contains intro_hd_cinematic_review.mp4 and intro_hd_cinematic_review.webm.
```

- [ ] **Step 2: Verify video metadata**

Run:

```powershell
@'
from pathlib import Path
import imageio.v2 as imageio
base = Path(r"C:\Users\neil_\OneDrive\Desktop\PizzaLogs\animations\hd_cinematic_intro\rendered")
for name in ["intro_hd_cinematic_review.mp4", "intro_hd_cinematic_review.webm"]:
    reader = imageio.get_reader(base / name)
    print(name, reader.get_meta_data())
    reader.close()
print("frames", len(list(base.glob("frame_*.jpg"))))
'@ | & 'C:\Users\neil_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -
```

Expected:

```text
fps is 60.0
size is 1920x1080
duration is 5.0 seconds
frames 300
```

### Task 4: Review Package

**Files:**
- Create: `animations/hd_cinematic_intro/rendered/review_contact_sheet.jpg`

- [ ] **Step 1: Create a contact sheet**

Run:

```powershell
@'
from pathlib import Path
from PIL import Image
base = Path(r"C:\Users\neil_\OneDrive\Desktop\PizzaLogs\animations\hd_cinematic_intro\rendered")
indices = [1, 30, 60, 90, 120, 150, 180, 210, 240, 270, 285, 300]
sheet = Image.new("RGB", (480 * 4, 270 * 3), (0, 0, 0))
for slot, index in enumerate(indices):
    frame = Image.open(base / f"frame_{index:04d}.jpg").resize((480, 270), Image.Resampling.LANCZOS)
    sheet.paste(frame, ((slot % 4) * 480, (slot // 4) * 270))
sheet.save(base / "review_contact_sheet.jpg", quality=92)
'@ | & 'C:\Users\neil_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -
```

Expected:

```text
review_contact_sheet.jpg exists and shows the full cinematic progression.
```

- [ ] **Step 2: Confirm isolation**

Run:

```powershell
git status --short --branch
```

Expected:

```text
Only pre-existing tracked changes outside animations appear.
All new cinematic asset files are under animations/hd_cinematic_intro/.
```
