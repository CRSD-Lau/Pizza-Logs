# Intro Animation Pipeline

Author: Neil Mitchell

Last modified by: Neil Mitchell

The source is `animations/source/Veo.mp4`. Generated web assets have one canonical location: `public/animations/`.

Neil Mitchell identifies the source as his Google Veo-generated intro. It entered
Git in `47f4f68` on 2026-05-06; that is an introduction date, not a verified generation
date. Current provenance and usage limits are recorded in the
[asset register](security/asset-provenance.md).

```text
animations/source/Veo.mp4
public/animations/
  desktop/intro-{1080p,1440p,4k}.{webm,mp4}
  mobile/intro-mobile-{720x1280,1080x1920,1440x2560}.{webm,mp4}
  posters/{desktop,mobile}-poster.jpg
```

Regenerate with FFmpeg:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render-intro-videos.ps1
```

```bash
bash scripts/render-intro-videos.sh
```

The scripts remove only known generated outputs under `public/animations`, preserve the source, crop the source watermark from the frame, generate 16:9 desktop and 9:16 mobile variants, encode VP9/WebM plus H.264/MP4 fallbacks, retain audio, and regenerate posters.

Do not add a second generated mirror under `animations/`; it previously duplicated roughly 91 MiB in Git without providing a runtime consumer.

`components/intro/FrozenLogbookIntro.tsx` is available through **Watch guild intro** on the homepage. Opening it chooses a responsive format and starts muted, with a sound toggle. It does not mount video or request intro media during ordinary page loads. The native modal closes with Escape or its close button and restores focus to its trigger. Reduced-motion users see the poster until they choose **Play video**. Deep links never launch the intro.
