# Asset provenance and rights evidence

Author: Neil Mitchell

Last modified by: Neil Mitchell

Initial media inventory: 2026-09-04

Scope and provenance reviewed: 2026-09-06

Status: **A16's acquisition/transfer condition is out of scope.** Neil Mitchell
confirmed that Pizza Logs is his own site and is not being sold or transferred;
the earlier acquisition framing was a quality benchmark. Buyer-facing ownership
and transfer clearance is therefore not a current release condition. This resolves
that scope error in [issue 76](https://github.com/CRSD-Lau/Pizza-Logs/issues/76),
without certifying all third-party media rights or waiving ordinary usage terms.

Neil confirmed that the intro was generated with Google Veo and the previous social
preview with ChatGPT image generation. On 2026-09-06 he approved using his existing
Pizza Warriors crest across the site, installed-app icons and social previews. The
current brand exports are browser-rendered derivatives of that exact approved PNG;
the Molten Charcoal palette refresh changes the surrounding surfaces and typography
colors while preserving the source artwork. This update did not generate replacement artwork. Owner statements establish the
recorded creation sources; no account screenshots or private generation receipts
are required to repeat them here. Exact original generation dates, inputs and any
separate audio sources were not independently inspected. Historical dates below
are Git introduction dates.

## Scope and evidence method

The media inventory covers current media files in `public/`, the application icon route,
the source intro video and guild crest, the shared crest component, bundled fonts, and the remote
icon/model paths used by current components. The [web Dockerfile](../../Dockerfile)
copies all `public/` files into the release image. The source video is tracked in
the repository and enters the build context; the runtime Dockerfile does not
explicitly copy its source directory. The public
[third-party notices](../../public/third-party-notices.txt) accompany the web assets.
Historical Git media is outside this current-file inventory and remains unchanged;
no buyer diligence or history rewrite is required for the stated project scope.

Evidence consists of checked-in consumer references, render scripts, per-file
Git history, SHA-256, FFprobe stream/container metadata, and visual inspection of
the current social preview and desktop poster. Commit authorship records who
introduced or changed a file; it does not independently prove creative authorship,
assignment, or permission. Owner-attested origins are distinguished from these
technical observations. The Molten Charcoal refresh updates the site icon, social
card and install-icon exports on the approved warm charcoal backing. The approved source PNG, existing intro video,
posters, audio and Git history are preserved.

## Local asset groups

| ID | Asset / consumer | Established provenance | Classification and missing evidence |
|---|---|---|---|
| M01 | `animations/source/Veo.mp4` | Neil identifies this as his Google Veo intro. Introduced in `47f4f68` (2026-05-06), commit author Neil Mitchell. H.264 1280x720 with AAC audio; container encoder is `Google`. [Pipeline documentation](../intro-animation.md) identifies it as the current source. | Owner-attested generated media. The Git date is not an exact generation date. Specific Veo service/account terms, reference inputs and any separate voice/music source were not independently inspected; the encoder is not a rights grant. This is a recorded limit, not an acquisition-document request. |
| M02 | Twelve `public/animations/` video variants and two posters; [FrozenLogbookIntro](../../components/intro/FrozenLogbookIntro.tsx) | [PowerShell renderer](../../scripts/render-intro-videos.ps1) and [Bash renderer](../../scripts/render-intro-videos.sh) derive these from M01. Posters last changed in `47f4f68`; videos in `d7e7727` (2026-05-06), which restored audio. All twelve videos contain audio: AAC in MP4, Opus in WebM. | Derivatives of the identified Veo source. The documented recipe crops the visible source watermark and retains audio. Permission for that transformation has not been independently established. A visible crop does not establish that invisible SynthID was removed. Preserve the original source and applicable service conditions. |
| M03 | `public/social-preview.jpg`; [page metadata](../../lib/page-metadata.ts), [layout](../../app/layout.tsx), README and repository social preview | Current 1280x640 card is rendered by the [brand renderer](../../scripts/render-brand-assets.mjs) from the exact M04 crest, local Cinzel/Rajdhani fonts and project CSS. Approved on 2026-09-06. It replaces the owner-attested ChatGPT card introduced in `0045566` (2026-08-15); no new AI artwork was generated for this refresh. | A reproducible composition of the approved guild artwork and fonts. The source hash establishes which artwork was used, not independent trademark or third-party rights clearance. Repository social preview is a separate GitHub setting; committing this file alone does not change that setting. |
| M04 | `assets/brand/pizza-warriors-source.png`, `public/brand/*.png`, `app/icon.svg`, `public/favicon.ico`; [GuildCrest](../../components/brand/GuildCrest.tsx), [manifest](../../app/manifest.ts) and layout | Neil approved this existing Pizza Warriors crest for the refresh on 2026-09-06. The 1024x1024 source PNG is copied unchanged; its SHA-256 is recorded below and in the [brand manifest](../../assets/brand/manifest.json). The [renderer](../../scripts/render-brand-assets.mjs) sizes the existing artwork and applies the approved CSS `lighten` blend against `#100d0b` for static exports. The Molten Charcoal refresh changes only the surrounding palette and typography colors. The SVG embeds a rendered PNG; ICO contains 16/32/48px PNG images. [Brand maintenance](../branding.md) identifies all consumers. | Owner-supplied, approved artwork with an exact preserved source and reproducible derivatives. Original generation tool/date and third-party inputs were not independently established by this refresh. No recoloring, redrawing or substitute logo is authorized by the rendering recipe. The geometric source mark introduced in `527c883` (2026-05-03) is retired from current consumers; Git history is preserved. Buyer assignment clearance remains out of scope. |
| M05 | Cinzel and Rajdhani font packages imported by the app | Installed package licenses and upstream OFL-1.1 grants were checked. Copyright notices and full license text are retained in [public notices](../../public/third-party-notices.txt), [LICENSE.LIST](../../LICENSE.LIST) and [third-party notices](../../THIRD_PARTY_NOTICES.md). | Known third-party font software with retained notices. The Dockerfile copies `public/` and the production dependency tree. Preserve these notices when packaging web assets; this font grant does not cover M01-M04. |

The source video's `Google` encoder and generated variants' `Lavf62.12.101` encoder
are processing metadata, not grants. Existing source/media metadata is preserved.
New brand PNG/JPEG exports and the ICO's embedded PNG payloads carry Neil Mitchell
as creator and modifier in XMP; the SVG and brand manifest also identify Neil Mitchell. Author metadata records export
attribution and does not establish a license or certify the artwork's original
creation source. This document's author and modifier are Neil Mitchell.

## Exact current-file inventory

The following hashes identify this review's bytes. A changed asset needs a refreshed
entry and provenance review. Dimensions identify the encoded asset, not an assertion
of native source resolution or creative ownership.

| Path | Group | Dimensions | Bytes | SHA-256 |
|---|---|---|---:|---|
| `animations/source/Veo.mp4` | M01 | 1280x720 | 6,023,459 | `08dc25057a0cd1bc458704beaa87c7cee54fd692d3c8cc411988999a77cac503` |
| `assets/brand/pizza-warriors-source.png` | M04 | 1024x1024 | 2,137,406 | `1fea4b90c299620227bfec21a73b6a41b807da39e7059fe49a1d6a3cc152a70b` |
| `app/icon.svg` | M04 | 192x192 (SVG viewBox) | 76,649 | `4ae5ed59ad825813215ec5c993bf1cf446b0a80e05809cef85606cd53f1ed4c8` |
| `public/animations/desktop/intro-1080p.mp4` | M02 | 1920x1080 | 7,814,170 | `59d87ca574a445af3d66c10b26704de927ae6a2c9425d21e124139efb4beb417` |
| `public/animations/desktop/intro-1080p.webm` | M02 | 1920x1080 | 5,980,366 | `f42ddf2973934188d50c45d61284d7ddebb5b8fb93f028d2393c560d6e3af0fb` |
| `public/animations/desktop/intro-1440p.mp4` | M02 | 2560x1440 | 10,593,964 | `af4121873e71cc4859bccbcdef600109fa4420e7202e5496c677716cbf8b6faf` |
| `public/animations/desktop/intro-1440p.webm` | M02 | 2560x1440 | 7,243,101 | `49e16788cc7f34542e9735e3bd8d777b06cd0d4892277dacf6e37156059d80a4` |
| `public/animations/desktop/intro-4k.mp4` | M02 | 3840x2160 | 17,697,832 | `6483cef52e0eb955fb8f7ea43ee13134e2b1ec9c0da4146c99294cabcd9c1daa` |
| `public/animations/desktop/intro-4k.webm` | M02 | 3840x2160 | 9,265,518 | `6758ba0ff332949bd39e202cb557bd6c718d1e17f0923751d07ae67031343b34` |
| `public/animations/mobile/intro-mobile-1080x1920.mp4` | M02 | 1080x1920 | 7,078,382 | `a2449815c01ede88c121477e8e00aa069fd355ac980f93725ea0e4fe00ef260a` |
| `public/animations/mobile/intro-mobile-1080x1920.webm` | M02 | 1080x1920 | 5,254,259 | `d04850cb72ee57290f99d8816daeb5a8ef5f677af5781e59efc1c27d0816da55` |
| `public/animations/mobile/intro-mobile-1440x2560.mp4` | M02 | 1440x2560 | 9,728,412 | `8c5eef66f264644f92cd2aa81be8457da4bf8f265b1bda0a1a135240467a5d7c` |
| `public/animations/mobile/intro-mobile-1440x2560.webm` | M02 | 1440x2560 | 6,256,711 | `9b07e45a9057508e9b02b90f3bf57c55fdbf0d411ed97df452ec98589d18d118` |
| `public/animations/mobile/intro-mobile-720x1280.mp4` | M02 | 720x1280 | 4,381,188 | `fd5ea3a5010e69d1cc94919abd0a4696be5e2d061193a56121792daea848dcba` |
| `public/animations/mobile/intro-mobile-720x1280.webm` | M02 | 720x1280 | 3,846,461 | `102a39d03c8735280e53ded517662bbacf0944db9c39ae0f6ac13a30fdc99a5c` |
| `public/animations/posters/desktop-poster.jpg` | M02 | 1920x1080 | 173,501 | `15436af1a86f17bdbb56a6a6a71fe823ed888f2c1af01cf242ed0c3b80ba6809` |
| `public/animations/posters/mobile-poster.jpg` | M02 | 720x1280 | 114,747 | `47ada1fd33452f5fe09b40eaab3a698dfb473feb78db626322505c0b92345a12` |
| `public/brand/guild-crest-v1.png` | M04 | 512x512 | 460,831 | `08dd89f65b0849892feefe0e269f4bd7000729217860fdc25c5c7328b8a4cb5d` |
| `public/brand/icon-192.png` | M04 | 192x192 | 46,945 | `ceb50e853d7285f9904d205dbaa875db7865711b9f1e77880deb506730dfc019` |
| `public/brand/icon-512.png` | M04 | 512x512 | 301,306 | `f3eae390b8cf10496e40908a413c4aaa401f7c932ff47d836f10d5af78615d23` |
| `public/brand/intro-crest-molten-1.png` | M04 | 512x512 | 301,306 | `f3eae390b8cf10496e40908a413c4aaa401f7c932ff47d836f10d5af78615d23` |
| `public/brand/icon-maskable-512.png` | M04 | 512x512 | 211,406 | `e76d11e4dd9f4ca9d9bbfa25c1c9856188b676e254bc5adb83be3d5d2102c960` |
| `public/brand/apple-touch-icon.png` | M04 | 180x180 | 35,671 | `143dd651c29e25faad1ab9fa7e2ebe7bc75038828c67e0ebc3571d75acb06bdb` |
| `public/favicon.ico` | M04 | 16x16 / 32x32 / 48x48 | 7,835 | `77f29e8c19550bfdc449eac345e95728f5ed03130024c5dcc8acaca0230a4637` |
| `public/social-preview.jpg` | M03 | 1280x640 | 171,481 | `36377e12b3365b31576faad38e71168c01f1da7c79d1928f4ea728b82c529284` |

The [brand manifest](../../assets/brand/manifest.json) records the renderer's source
digest, export dimensions, sizes and hashes. Refresh these rows from that manifest
when regenerating the assets. The versioned intro crest is a byte-identical copy
of the 512px install icon for cache refresh with the default local-image policy.
`GuildCrest` supplies shared presentation behavior;
its component source is not a separately shipped image file.

## Remote media and runtime code

| ID | Origin / current code reference | What is actually loaded | Evidence gap and owner |
|---|---|---|---|
| R01 | `https://cdn.warmane.com/wotlk/icons/large/{slug}.jpg`; [class-icons](../../lib/class-icons.ts), [warmane-armory](../../lib/warmane-armory.ts), [PlayerAvatar](../../components/players/PlayerAvatar.tsx) | Class icons and item icons obtained from the Armory/CDN; class fallback recognizes the ten WotLK classes. | Third-party hosted game imagery. Warmane's current service terms are identified below. Underlying image rights and permission for this specific hotlink/cache use have not been independently established. No sale or transfer is planned. |
| R02 | `https://wow.zamimg.com/images/wow/icons/large/{iconName}.jpg`; [item-template](../../lib/item-template.ts), [warmane-armory](../../lib/warmane-armory.ts) | Item-icon fallback URLs constructed from item metadata. Actual item set varies with reports and the cache. | Third-party hosted imagery. Current Wowhead/Fanbyte terms are identified below; public URLs alone are not a grant. The specific image-use permission and historical cache contents were not independently established. |
| R03 | `https://cdn.warmane.com/wmmv/wmmv.js?v=1736749263` and `https://cdn.warmane.com/wmmv/`; [WarmaneCharacterModel](../../components/players/WarmaneCharacterModel.tsx) | Remote viewer code and its character/item model, texture and dependent resources inside a sandboxed iframe. The query string is a requested URL version, not a verified source revision or content digest. | Viewer-code licensing and underlying model/texture rights remain distinct and were not independently established. No claim of ownership, a bundled licensed model pack or transferable third-party rights is made. |
| R04 | `https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js`; the same viewer component | Remote runtime dependency outside the npm direct-dependency count. Retrieved on 2026-09-05: HTTP 200, 84,320 bytes, SHA-256 `8af93bd675e1cfd9ecc850e862819fdac6e3ad1f5d761f970e409c7d9c63bdc3`. | Exact upstream jQuery 2.1.3 MIT grant confirmed; copyright and full permission notice retained in [public notices](../../public/third-party-notices.txt). This does not license R03. |
| R05 | [next.config.ts](../../next.config.ts) and the iframe CSP | Permit Warmane styles/fonts/images/connect resources and Zamimg images. CSP permission is a technical load policy, not a license. | No exhaustive runtime resource fetch or current built-container notice audit was performed for this register. Preserve notices when integrations change; allowed origins do not establish which resources every character loads. |

The current avatar uses a class icon or initials, with live gear/model details on
hover. Legacy userscript URL strings elsewhere in `lib/` are not evidence that the
current UI loads those viewer sites. This inventory follows actual component paths;
it does not re-enable legacy integrations or claim that every allowed CDN URL is used.

## Policy observations and limits

Google's [consumer terms](https://policies.google.com/terms?hl=en) state that Google
does not claim ownership of original generated content. OpenAI's
[consumer Terms of Use](https://openai.com/policies/row-terms-of-use/), effective
2026-01-01 and checked on 2026-09-05, assign its rights in output to the user to the
extent permitted by law, while leaving the user responsible for inputs and content.
These are current provider terms, not proof of the exact creation date or a grant
covering someone else's inputs, audio or marks. Google's
[Flow guidance](https://support.google.com/flow/answer/16935308?hl=en) says the invisible
SynthID watermark should not be removed;
this review does not infer which Veo interface Neil used or approve watermark edits.

The [Warmane terms](https://www.warmane.com/policies/terms), checked on 2026-09-05,
restrict commercial exploitation of the site/services without express permission.
[Wowhead's terms page](https://www.wowhead.com/termsofservice) links to the
[Fanbyte terms](https://corp.fanbyte.com/legal/terms), also checked on 2026-09-05.
Sections 4 and 8 contain use/display restrictions. Their application to each current
icon or viewer operation has not been independently determined. This register
neither grants broad media permission nor concludes that every existing use is
unlawful. Acquisition and transfer permission are outside the stated site scope.

Blizzard's official [video policy](https://www.blizzard.com/en-gb/legal/2068564f-f427-4c1c-8664-c107c90b34d5/blizzard-video-policy)
and [trademark guidelines](https://www.blizzard.com/en-us/legal/38fd0408-8431-469a-99bc-2cd9eb9462c8/blizzard-entertainment-trademark-usage-guidelines)
were identified through current primary-source search results, but direct retrieval
returned HTTP 403. The full directly retrieved policy scope remains unverified;
no blanket authorization of Pizza Logs is inferred from indexed excerpts.

## Current disposition and maintenance

The original A16 buyer-clearance requirement is retired after the owner's scope
clarification. Veo/ChatGPT provenance is recorded, the existing media inventory is
retained, and ordinary font/jQuery notices accompany the public assets. The
unverified current-use details above remain visible; they are not silently
converted into either certified rights or replacement release blockers.

Maintain this register when media or upstream integrations change, preserve
copyright/license notices, and keep private account/source records outside public
GitHub. Concrete permission concerns or a later change to the site's use should be
reviewed on their own facts. Neither source deletion nor a Git history rewrite is
part of this disposition.
