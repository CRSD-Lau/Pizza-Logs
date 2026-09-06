# Pizza Warriors branding

Author: Neil Mitchell

Last modified by: Neil Mitchell

The Pizza Logs identity uses the existing Pizza Warriors crest, approved for this
site on 2026-09-06. The header uses a 44px crest alongside the existing Pizza Logs
wordmark and gold/navy palette. Keep the crest's colors, proportions and detail;
do not redraw it, recolor it or replace it with newly generated artwork.

## Source and rendering

The original artwork is [pizza-warriors-source.png](../assets/brand/pizza-warriors-source.png),
a 1024x1024 PNG preserved byte for byte. Its SHA-256 is
`1fea4b90c299620227bfec21a73b6a41b807da39e7059fe49a1d6a3cc152a70b`.
The [brand manifest](../assets/brand/manifest.json) records the source digest and
each exported asset's dimensions, byte size and SHA-256. The
[asset register](security/asset-provenance.md) records provenance and usage limits.

The shared [GuildCrest](../components/brand/GuildCrest.tsx) normally displays the
exported 512px crest with CSS `mix-blend-mode: lighten`, allowing its black surround
to blend into the dark page behind it. The intro uses the component's solid variant:
the precomposed 512px icon is clipped to a circle on a matching navy backing, so
the animated overlay does not depend on backdrop blending. Static install icons,
favicon and social card use the same browser blend against `#0a0c10`; their backgrounds are already
composited because external consumers cannot use the site's CSS. The SVG icon
embeds a raster export of the exact artwork; it is not a traced replacement.

Regenerate from the repository root after installing the development dependencies:

```bash
npm ci --legacy-peer-deps
npx playwright install chromium
node scripts/render-brand-assets.mjs
```

The [renderer](../scripts/render-brand-assets.mjs) uses the project's development
Playwright installation and its Chromium browser, Sharp available through the
installed Next.js dependency tree, and the local Cinzel/Rajdhani font packages.
It does not invoke an image-generation service. It updates only the named brand
exports and manifest; preserve the original source. New image export metadata,
SVG metadata and the manifest identify Neil Mitchell as creator/author and modifier.

Review the rendered images, inspect the output hashes and metadata, and refresh the
exact-file rows in the asset register before committing regenerated files. Browser,
font or encoder updates can change exported bytes even when the source is unchanged.

## Consumer checklist

| Surface | Authoritative consumer | Asset or behavior |
|---|---|---|
| Desktop and mobile header | [Nav](../components/layout/Nav.tsx) through `GuildCrest` | 44px crest; preserve the wordmark and responsive navigation space. |
| Guild roster loading state | [Existing roster loading UI](../app/guild-roster/loading.tsx) through `GuildCrest` | Crest and accessible loading status alongside the existing roster skeleton. |
| Optional guild intro | [FrozenLogbookIntro](../components/intro/FrozenLogbookIntro.tsx) through `GuildCrest` | Responsive solid crest on a circular navy backing and wordmark overlay; inspect normal playback, reduced motion and failed-video fallback. |
| Installed-app icon and supported mobile startup screen | [Manifest](../app/manifest.ts) | 192/512px PNG icons, a separate 512px maskable icon with inset artwork, and `#0a0c10` background/theme. The operating system controls startup presentation. |
| Apple home-screen icon | [Root metadata](../app/layout.tsx) | 180px `public/brand/apple-touch-icon.png`. |
| Browser tabs and bookmarks | Root metadata, [SVG route](../app/icon.svg), [favicon](../public/favicon.ico) | SVG plus ICO containing 16/32/48px artwork. |
| Upload notifications | [Notification helper](../components/upload/notifications.ts) | 192px PNG icon; retain the existing explicit notification opt-in. |
| Shared site/page URLs | `SOCIAL_IMAGE` in [page metadata](../lib/page-metadata.ts), reused by root metadata | 1280x640 JPEG, matching Open Graph/Twitter URLs, dimensions and descriptive alt text. |
| Repository README | [README](../README.md) | The same `public/social-preview.jpg` card. |
| Shared repository URLs | GitHub repository **Settings → Social preview** | Upload the same card separately, then verify the public repository's Open Graph image. A committed README image does not update this setting. |

The intro video and posters have no Pizza Logs emblem embedded in the reviewed
frames. The brand is supplied by the UI overlay, so this refresh preserves the
existing media and source. See the [intro pipeline](intro-animation.md) for its
separate maintenance process. The optional intro, page loading UI and mobile
operating-system startup screen are separate consumers and should each be checked.

## GitHub social preview

After deploying and verifying the card, open the repository's **Settings**, find
**Social preview**, choose **Edit → Upload an image**, and select the generated
`public/social-preview.jpg`. GitHub recommends 1280x640 pixels and accepts PNG,
JPG or GIF under 1MB. Follow [GitHub's current instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)
if the controls change.

Verify the saved preview in Settings, then read the public repository page's
`og:image` and inspect the image it serves. Record that readback with release
validation; this procedure itself does not establish that a repository upload has
occurred. Repository settings are not synchronized by the application deployment.

## Cache and release validation

Current metadata references use `?v=guild-1` on the brand image URLs. The shared
crest component uses the versioned filename `/brand/guild-crest-v1.png`, which
works with the image optimizer's default local-image policy.
When changing the approved artwork later, update the version consistently across
the crest filename, manifest, notification helper and root/page metadata.
Preserve the unversioned favicon, SVG and social-card paths for existing consumers.

External sharing services may cache a preview for an already shared page even after
the origin metadata changes. Installed phone apps can also retain an older icon
until their installation metadata refreshes or the app is removed and added again.
A successful deployment cannot force either cache to update immediately. Confirm
fresh origin metadata and image bytes before attributing an old preview to a cache.

Run `npm run check:pr` and the required hosted checks. Verify desktop and mobile
header geometry, loading presentation, intro/fallback controls, reduced motion,
icon framing and maskable safe area. Read the production manifest and crawler-visible
Open Graph/Twitter metadata for the homepage and a representative report; confirm
each referenced asset serves the expected content type and new bytes. Production
smoke, deployment revision checks and the separate GitHub social-preview readback
complete the release evidence. Manifest and image inspection alone does not prove
a particular phone's installed-app startup presentation.
