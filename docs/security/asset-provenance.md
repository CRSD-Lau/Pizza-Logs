# Asset provenance and rights evidence

Author: Neil Mitchell

Last modified by: Neil Mitchell

Observed: 2026-09-04

Status: **A16 remains open.** This register identifies the assets and missing
permissions; it does not certify ownership, commercial use, transferability or
redistribution rights. Neil Mitchell owns the evidence collection and acquisition
closeout. The relevant creator, service operator or underlying rights holder must
supply any grant that is not established by existing terms.

## Scope and evidence method

The inventory covers all 16 files in `public/`, the application icon route,
the source intro video, inline navigation artwork, bundled fonts, and the remote
icon/model paths used by current components. The [web Dockerfile](../../Dockerfile)
copies all `public/` files into the release image. The source video is tracked in
the repository and enters the build context; the runtime Dockerfile does not
explicitly copy its source directory. Historical Git blobs are outside this
current-file inventory and remain an acquisition diligence item.

Evidence consists of checked-in consumer references, render scripts, per-file
Git history, SHA-256, FFprobe stream/container metadata, and visual inspection of
the current social preview and desktop poster. Commit authorship records who
introduced or changed a file; it does not independently prove creative authorship,
assignment, or permission. No asset was changed or deleted for this register.

## Local asset groups

| ID | Asset / consumer | Established provenance | Classification and missing evidence |
|---|---|---|---|
| M01 | `animations/source/Veo.mp4` | Introduced in `47f4f68` (2026-05-06), commit author Neil Mitchell. H.264 1280x720 with AAC audio; container encoder is `Google`. [Pipeline documentation](../intro-animation.md) identifies it as the current source. | Source is consistent with a Google-encoded export; filename and encoder do not prove the generating service, account, model, applicable terms, input rights, voice/music source, or ownership. Neil must supply the original generation/export record and terms that applied when created. |
| M02 | Twelve `public/animations/` video variants and two posters; [FrozenLogbookIntro](../../components/intro/FrozenLogbookIntro.tsx) | [PowerShell renderer](../../scripts/render-intro-videos.ps1) and [Bash renderer](../../scripts/render-intro-videos.sh) derive these from M01. Posters last changed in `47f4f68`; videos in `d7e7727` (2026-05-06), which restored audio. All twelve videos contain audio: AAC in MP4, Opus in WebM. | Derivatives of M01, including its visual and audio rights questions. The documented recipe crops the source watermark from the frame; capture the actual service terms and permitted transformations instead of inferring authorization from the exported file. No independent permission was found in the repository. |
| M03 | `public/social-preview.jpg`; [page metadata](../../lib/page-metadata.ts), [layout](../../app/layout.tsx) | Current 1280x640 image contains Pizza Logs branding, a geometric gold emblem and WOTLK wording. Added in `0045566` (2026-08-15). No embedded creator/copyright tag was found. | Project-branded artwork with undocumented creation source. It is not automatically classified as wholly original or assigned to Neil merely because it carries the project name. Obtain the source design or generation record, source elements, creator assignment/license and any font/mark conditions. |
| M04 | `app/icon.svg`, `public/favicon.ico`, and inline `PizzaIcon` in [Nav](../../components/layout/Nav.tsx); [manifest](../../app/manifest.ts) and layout | SVG and inline mark are geometric polygons/circle/lines implemented in project source, with no linked image. Icon/favicon introduced in `527c883` (2026-05-03), author Neil Mitchell. ICO includes 16/32/48px PNG images. Repository code carries [MIT terms](../../LICENSE). | Project-maintained mark source is identified. Independent originality, trademark availability, and contributor/creator assignments have not been established. The ICO has no embedded attribution; record its export relationship to the source mark. Do not classify it as Blizzard artwork based solely on the game's context. |
| M05 | Cinzel and Rajdhani font packages imported by the app | Package license files and copyright notices are recorded in [LICENSE.LIST](../../LICENSE.LIST) and [third-party notices](../../THIRD_PARTY_NOTICES.md). | Known third-party font software with OFL-1.1 notices. Preserve the packaged licenses and confirm notices in each intended browser/container/archive distribution. This evidence does not cover M01-M04. |

The inspected image/video containers have no creator/author/copyright fields that
establish a license. The source's `Google` encoder and generated variants'
`Lavf62.12.101` encoder are processing metadata, not grants. The existing media
metadata was preserved; this new document's author and modifier are Neil Mitchell.

## Exact current-file inventory

The following hashes identify this review's bytes. A changed asset needs a refreshed
entry and provenance review. Dimensions identify the encoded asset, not an assertion
of native source resolution or creative ownership.

| Path | Group | Dimensions | Bytes | SHA-256 |
|---|---|---|---:|---|
| `animations/source/Veo.mp4` | M01 | 1280x720 | 6,023,459 | `08dc25057a0cd1bc458704beaa87c7cee54fd692d3c8cc411988999a77cac503` |
| `app/icon.svg` | M04 | 40x40 (SVG viewBox) | 886 | `89600537af58c3667895b4c04b0646e55dcb1780e5f9e9842e11723865194ff7` |
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
| `public/favicon.ico` | M04 | 16x16 / 32x32 / 48x48 | 6,395 | `4656657cfa5932eb99fafe0c881b88e04b91b8bc9bbdd0d2a50d61df37e0aabf` |
| `public/social-preview.jpg` | M03 | 1280x640 | 80,002 | `a79ddd79c8fd3535a6e703e99a245b706e768638042f25757b06200819a91f25` |

M04's inline SVG is source code within `components/layout/Nav.tsx`; its file also
contains unrelated navigation logic, so it is identified by component and revision
rather than treated as a separately shipped image file.

## Remote media and runtime code

| ID | Origin / current code reference | What is actually loaded | Evidence gap and owner |
|---|---|---|---|
| R01 | `https://cdn.warmane.com/wotlk/icons/large/{slug}.jpg`; [class-icons](../../lib/class-icons.ts), [warmane-armory](../../lib/warmane-armory.ts), [PlayerAvatar](../../components/players/PlayerAvatar.tsx) | Class icons and item icons obtained from the Armory/CDN; class fallback recognizes the ten WotLK classes. | Third-party hosted game imagery. Neil must establish the terms for service access/hotlinking and the underlying image rights for the intended deployment or acquisition. No asset grant is checked into this repository. |
| R02 | `https://wow.zamimg.com/images/wow/icons/large/{iconName}.jpg`; [item-template](../../lib/item-template.ts), [warmane-armory](../../lib/warmane-armory.ts) | Item-icon fallback URLs constructed from item metadata. Actual item set varies with reports and the cache. | Third-party hosted imagery. Record the applicable Wowhead/ZAM operator terms and underlying image grant; public URL availability is not permission evidence. Exact historical cache contents were not inventoried here. |
| R03 | `https://cdn.warmane.com/wmmv/wmmv.js?v=1736749263` and `https://cdn.warmane.com/wmmv/`; [WarmaneCharacterModel](../../components/players/WarmaneCharacterModel.tsx) | Remote viewer code and its character/item model, texture and dependent resources inside a sandboxed iframe. The query string is a requested URL version, not a verified source revision or content digest. | Viewer implementation licensing and underlying model/texture rights are separate questions. Neil must obtain the relevant source/license notices or permission from the operator and applicable rights holder. No claim of a bundled, licensed model pack is made. |
| R04 | `https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js`; the same viewer component | A remote runtime JavaScript dependency required by the viewer. It is outside the npm direct-dependency inventory. | Record the exact delivered script digest and its upstream license/notice when packaging or redistributing it. This register does not infer a license for R03 from jQuery's licensing. |
| R05 | [next.config.ts](../../next.config.ts) and the iframe CSP | Permit Warmane styles/fonts/images/connect resources and Zamimg images. CSP permission is a technical load policy, not a license. | Audit a representative model's actual resource list for any additional fonts or files during a distribution review. No exhaustive remote resource fetch was performed for this register. |

The current avatar uses a class icon or initials, with live gear/model details on
hover. Legacy userscript URL strings elsewhere in `lib/` are not evidence that the
current UI loads those viewer sites. This inventory follows actual component paths;
it does not re-enable legacy integrations or claim that every allowed CDN URL is used.

## Policy observations and limits

The [Warmane terms](https://www.warmane.com/policies/terms), retrieved on 2026-09-04,
restrict commercial exploitation of the site/services without express permission.
That is a concrete term to resolve for the intended acquisition/use; this review
does not decide how it applies to every current asset or operation.

Blizzard's official [video policy](https://www.blizzard.com/en-gb/legal/2068564f-f427-4c1c-8664-c107c90b34d5/blizzard-video-policy)
and [trademark guidelines](https://www.blizzard.com/en-us/legal/38fd0408-8431-469a-99bc-2cd9eb9462c8/blizzard-entertainment-trademark-usage-guidelines)
were identified through current primary-source search results, but direct retrieval
returned HTTP 403. A complete applicable policy record and any permission/exception
remain required. No conclusion that these policies authorize Pizza Logs or transfer
with an acquisition is made. Wowhead/ZAM media terms were not established by an
authoritative document during this review.

## Owner actions and measurable A16 closure

Neil Mitchell coordinates this register; creators/service operators/underlying rights
holders provide grants where needed. Keep contracts, account details, generation
receipts and personal contact information in controlled records, not public GitHub.
The public issue can record document identifiers and conclusions without those details.

1. For M01-M03, link every listed hash to its source project or generation receipt,
   creation date, actual tool/service terms, input assets, creator, and separate
   audio/voice/music permission where present. For M04, record source authorship,
   the favicon export relationship, and assignments or contributor grants needed
   for the proposed transaction. Obtain qualified review of unresolved marks.
2. For R01-R05, record exact service/operator terms and required underlying asset
   permissions for current hosting, caching, redistribution, modification and
   transfer to an acquirer. Record required notices, limits and expiry. Distinguish
   permission to call a service from permission to redistribute its files.
3. For every group, enter one signed-off disposition: covered by identified terms
   for the stated use; expressly licensed with recorded scope; or replaced/removed
   through a separately reviewed change. Unknown provenance does not count as closed.
4. After a disposition requires changes, verify the approved notices/assets in the
   built container and browser routes, repeat the asset/path inventory, and confirm
   replacement retains the intended UI. Test that no removed source is still loaded.
5. A16 closes only when M01-M05 and R01-R05 each have an evidence identifier, responsible
   owner, dated review, permitted use/transfer scope and no unresolved required grant.
   The acquisition record must address historical media retained in Git separately;
   this task did not rewrite history or delete assets.
