# Feature Status

This file is the single source for shipped features, active backlog, and technical debt. Keep roadmap items clearly separate from current functionality.

## Shipped

| Feature | Current state |
|---|---|
| Upload pipeline | Drag/drop `.txt`/`.log` upload, SSE progress, parser service, DB writes |
| Parser | Skada-WoTLK-aligned damage/healing event handling with heuristic Warmane segmentation |
| Raid sessions | Uploads split into sessions after long gaps; public session detail pages live under `/raids/...` |
| Encounter pages | Boss pull meters, spell breakdowns, target breakdowns, roster data |
| Leaderboards | Boss, global, weekly, and player profile summaries |
| Milestones | Current all-time DPS/HPS ranks per boss/difficulty |
| Admin auth | `/admin` and admin APIs require `ADMIN_SECRET`; production fails closed if missing |
| Admin diagnostics | Service health, DB counts, upload timings, upload history, cleanup controls |
| Public upload telemetry removal | Upload history/detail moved behind admin; `/uploads` redirects to admin |
| Guild roster | Cached PizzaWarriors/Lordaeron roster rows with rank/profession parsing |
| Roster-only profiles | `/players/<name>` resolves roster members without combat-log rows |
| Header search | Searches combat-log players plus roster-only members through `/api/players/search` |
| Gear cache | Warmane snapshots cached in `armory_gear_cache`, with GearScoreLite display |
| Item metadata | AzerothCore `item_template` import populates `wow_items`; no runtime Wowhead API dependency |
| Gear/userscript import | Browser-assisted Warmane Gear Sync fills gear snapshots and icon gaps |
| Portrait userscript | Best-effort Warmane/Wowhead/Zamimg portrait capture with class-icon/initial fallback |
| ICC ordering | Shared helpers keep ICC boss displays in progression order where appropriate |
| Local test server helpers | Windows scripts start/stop web and parser test servers |
| Favicon/app icon | `public/favicon.ico` and `app/icon.svg` are present |
| Documentation baseline | README, workflow docs, vault notes, and GitHub-facing docs refreshed around current code |

## Active Work

| Item | Status |
|---|---|
| Warmane production data freshness | Manual/browser-assisted until local automated sync agent exists |
| Absorbs | Future parser work; not currently implemented |

## Backlog

| Priority | Item | Notes |
|---|---|---|
| High | Absorbs tracking | Implement Skada `Absorbs.lua` style separate absorb metric, not healing |
| High | Server-side upload size enforcement | Enforce a hard byte limit while streaming to parser |
| Medium | Upload rate limiting | Prefer Railway-level controls first, app-level only if needed |
| Medium | Local automated Warmane sync agent | Replace manual roster/gear userscript runs with low-risk local automation |
| Medium | Damage mitigation stats | Track `SPELL_MISSED` subtypes such as ABSORB, BLOCK, PARRY, DODGE |
| Medium | Consumable tracking | Known buff applications |
| Low | Fastest kill records | Per boss/difficulty shortest duration kills |
| Low | Attendance tracking | Per-player raid attendance |
| Low | CSV export | Download encounter/player data |
| Low | Branded 404 | Replace default Next.js 404 |

## Technical Debt

| Debt | Impact | Fix |
|---|---|---|
| Manual Warmane sync | Gear/roster can go stale | Local automated sync agent with snapshot validation |
| Upload lacks hard size cap | Large uploads can waste resources | Enforce size during upload/forwarding |
| Role inference is rough | Hybrids and tanks can be mislabeled | Use better class/spec/combat evidence |
| Encounter detail links to global player profile | Different navigation from session pages | Pass upload/session context where needed |

## Won't Do / Not Current

| Item | Reason |
|---|---|
| Direct Codex pushes to `main` | Production deploys only after Neil merges a PR |
| Railway Warmane proxy / Cloudflare bypass | Production should serve cached snapshots and receive browser/local imports |
| Runtime Wowhead API enrichment | Replaced by local AzerothCore item metadata |
| Perfect heroic detection from logs alone | Some Warmane encounters lack reliable evidence; use marker/session evidence only where supported |
