# Pizza Logs

Pizza Logs is a Warmane / WotLK 3.3.5a combat-log parser and leaderboard app for the PizzaWarriors guild. Raiders upload `WoWCombatLog.txt`; the app parses boss encounters with Skada-WoTLK-aligned rules, stores reports in PostgreSQL, and shows raid sessions, DPS/HPS rankings, boss history, player profiles, gear, guild roster data, and admin diagnostics.

Live app: https://pizza-logs-production.up.railway.app

Wiki: https://github.com/CRSD-Lau/Pizza-Logs/wiki

## App Preview

![Pizza Logs upload dashboard screenshot](docs/assets/readme-screenshot.png)

## Current Features

- Single-request streamed text/ZIP upload with Server-Sent Events progress and early difficulty results.
- Python FastAPI parser service for WotLK combat logs.
- Skada-WoTLK-aligned damage/healing event handling.
- Separate absorb/APS plus an explicitly labeled UwU-compatible healing + absorbs view.
- Spec/role, aura uptime, consumable, power-gain, target-damage, and death-timeline analytics.
- Boss encounter, raid session, player, weekly, and leaderboard pages.
- File-level and encounter-level deduplication.
- Milestones for all-time DPS/HPS records.
- Admin-only diagnostics, upload history, cleanup controls, and first-party roster refresh.
- Header player search across combat-log players and PizzaWarriors/Lordaeron roster-only members.
- First-party Warmane guild roster refresh and on-demand player gear quick looks.
- Gear display backed by cached Warmane equipment plus local AzerothCore item metadata.
- Player avatars use WoW class icons, falling back to initials when class data or icon loading is unavailable.
- Railway production deployment with separate web and parser services.

## Supported Assumptions

- Primary target: Warmane WotLK 3.3.5a logs for PizzaWarriors on Lordaeron.
- Other WotLK-style logs may work, but Warmane edge cases drive the parser rules.
- Logs do not need reliable `ENCOUNTER_START` / `ENCOUNTER_END`; the parser has a heuristic path.
- If encounter markers exist, the parser can use them, then still applies Warmane-specific heroic correction.
- Skada-WoTLK remains the source of truth for outgoing damage and effective-healing primitives. Adopted public report definitions are aligned with UwU where users compare the two products.
- Effective healing and absorbs remain separate stored metrics; reports also expose the explicit combined healing + absorbs value used for UwU comparisons.

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 16.3, React 19.2, Node.js 24 |
| TypeScript | TypeScript 7 native CLI, TypeScript 6 ecosystem API |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL, Prisma 7 with PostgreSQL driver adapter |
| Parser | Python 3.12, FastAPI 0.141 |
| Charts | Recharts 3 |
| Hosting | Railway |

Railway has two app services:

- `Web Service`: Next.js standalone app.
- `parser-py`: FastAPI parser service.

## Cinematic Intro Assets

The site intro is rendered from `animations/source/Veo.mp4` with FFmpeg. The canonical generated assets live in `animations/desktop`, `animations/mobile`, and `animations/posters`; matching web-served copies are mirrored to `public/animations`.

Render all responsive variants after replacing the source video:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render-intro-videos.ps1
```

On macOS/Linux:

```bash
bash scripts/render-intro-videos.sh
```

The scripts crop the bottom-right Veo watermark out of the frame, preserve 16:9 desktop and 9:16 mobile aspect ratios, retain source audio as WebM/Opus and MP4/AAC, encode WebM/VP9 primary assets plus H.264 MP4 fallbacks, and regenerate posters. The intro starts muted for autoplay compatibility, exposes a sound toggle, plays on full page load or refresh, then stays dismissed during normal in-app link navigation.

## Main Routes

| Route | Purpose |
|---|---|
| `/` | Upload form and recent records |
| `/raids` | Raid history grouped by upload/session |
| `/raids/[id]/sessions/[idx]` | Public raid-session detail |
| `/raids/[id]/sessions/[idx]/players/[name]` | Session-scoped player detail |
| `/encounters/[id]` | Single boss pull breakdown |
| `/bosses` and `/bosses/[slug]` | Boss ranking pages |
| `/leaderboards` | Aggregate DPS/HPS leaderboards |
| `/players` and `/players/[name]` | Player roster and all-time profiles |
| `/guild-roster` | Cached PizzaWarriors roster |
| `/weekly` | Weekly DPS/HPS and boss-kill summary |
| `/admin` | Protected diagnostics and import tools |
| `/admin/uploads` | Protected upload history |

`/uploads` and `/uploads/[id]` redirect to the admin upload history. Public session URLs use `/raids/...`.

## Upload And Parsing Flow

1. Browser creates a random upload UUID and posts raw `.txt`, `.log`, or `.zip` bytes to `POST /api/upload` while reading SSE progress.
2. Next.js forwards the request body directly to the parser's UUID upload endpoint.
3. The parser streams to a unique `.part` file, hashes incrementally, atomically finalizes it, validates limits and archive safety, then emits a quick per-attempt difficulty result.
4. A bounded background worker performs full DPS/HPS parsing while the same SSE request stays open.
5. Next.js validates the final parser payload with Zod and uses the existing realm/guild/player/encounter persistence path.
6. The upload is marked `DONE`, milestones are computed, and the browser links to the stored raid session.

Duplicate handling:

| Level | Method |
|---|---|
| File | SHA-256 of full file content via `Upload.fileHash` |
| Encounter | SHA-256 fingerprint from boss, difficulty, time block, and sorted participant names |

The upload protocol, security limits, states, compatibility endpoint, and benchmark are documented in `docs/archive-upload-protocol.md`.

## Parser Behavior

The formal parser contract is in `docs/parser-contract.md`; detector evidence and Ulduar rules are in `docs/difficulty-detector.md`.

Key rules:

- Damage events match Skada `Damage.lua`: `SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, and `SPELL_BUILDING_DAMAGE`.
- Healing events match Skada `Healing.lua`: `SPELL_HEAL` and `SPELL_PERIODIC_HEAL`.
- Headline encounter and full-session Total Damage use the raw damage-event `amount`, matching UwU's Total Damage column. Overkill and absorbed metadata remain available for separate useful/effective analysis.
- Encounter damage includes all matched pull targets, including Lady Deathwhisper adds and Blood Prince Council mechanics; boss-only damage remains a separate analytical breakdown.
- Damage taken uses the raw incoming amount reported by the combat log, matching UwU's headline taken value.
- Effective healing is `max(0, gross - overheal)`.
- `SPELL_HEAL_ABSORBED` is not healing done in Skada.
- `SWING_DAMAGE` uses shifted indexes because it has no spell fields.
- Encounter windows end at the last boss-destination event; KILL duration uses boss death time and boss outgoing attacks, stale wipe markers, or post-fight trash cannot extend the pull.
- Session reports persist one UwU-style Custom Slice from the first to last log event, including wipes, trash, and downtime, with Total Damage, effective healing plus attributed absorbs, Damage Taken, and per-player rates sharing the same duration.
- Gunship kill detection has a Warmane crew-death override.
- Difficulty is classified per attempt from boss-specific spell ranks and explicit Ulduar rules; conflicts, missing evidence, and unsupported cases return `UNKNOWN` instead of defaulting to Normal.
- Malformed combat-log lines are counted and returned as parser warnings instead of crashing uploads.
- Absorb amounts are taken from damage events and attributed to the newest active supported shield aura; recently removed shields remain eligible for 0.5 seconds, Discipline critical-heal evidence can identify Divine Aegis, ambiguous multi-shield hits are labeled, and missing evidence remains unattributed.
- Permanent pet ownership propagates across repeated Warmane GUID instances only after summon or owner-exclusive spell evidence establishes the owner.
- Player spec/role uses observed WotLK spell signatures plus healing and damage-taken evidence; uncertain cases remain `UNKNOWN` or fall back to output role.
- Aura uptime, consumables, power gains, and a death timeline with the preceding 15 seconds of incoming damage are stored per participant.

The feature-by-feature comparison against the inspected UwU revision is in [`docs/uwu-analytics-parity.md`](docs/uwu-analytics-parity.md).

## Player, Gear, And Roster Data

Player profiles merge:

- combat-log `players` data when the character has uploaded raid participation;
- PizzaWarriors/Lordaeron `guild_roster_members` data for roster-only characters;
- cached Warmane gear snapshots from `armory_gear_cache`;
- local item metadata from `wow_items`.

[Class avatars are first-party gear quick-look controls](docs/player-gear-quick-look.md). Hover, focus, or tap one to lazily request the known character through Pizza Logs, refresh the Warmane equipment snapshot on a five-minute window, and show class, gear icons, GearScoreLite, average item level, and freshness in a compact tooltip. Normal viewing does not require Tampermonkey, a bookmarklet, an admin secret, or an open Warmane tab. The last healthy database snapshot is used if a live Armory request fails.

Warmane live server fetches remain best-effort because Cloudflare behavior can change. Gear quick looks fall back to the last healthy snapshot, while an authenticated **Refresh from Warmane** control on `/admin` updates the durable guild-roster snapshot. There is no active Tampermonkey, bookmarklet, open-tab, or browser-stored-secret dependency. Existing installations can be removed using the [browser sync retirement guide](docs/userscript-retirement.md).

Player avatars intentionally use class icons instead of Warmane-rendered character portraits. The small shield badge identifies the live gear quick look. The old portrait userscript URL remains only as a no-op compatibility update for existing installs.

Item names, item levels, stats, slot metadata, and GearScoreLite inputs come from the local AzerothCore `item_template` import:

```bash
npm run db:import-items
```

No runtime Wowhead API dependency is used. Live equipment and class icons use Warmane's static CDN; local item-template icon slugs can fall back to static `wow.zamimg.com` image URLs.

## Local Development

For Windows CLI prerequisites, PATH repair, and repeatable local tooling checks, see [`docs/dev/TOOLING.md`](docs/dev/TOOLING.md).

Prerequisites:

- Node.js 24.x (the `.nvmrc`, package engine, CI, Docker, and Railway image all agree)
- Python 3.12+
- PostgreSQL 16, or Docker for the local database

Install web dependencies:

```bash
npm ci --legacy-peer-deps
```

Copy the local environment template:

```bash
cp .env.example .env.local
```

Required app variables:

| Variable | Local example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://pizzalogs:pizzalogs@localhost:5432/pizzalogs?schema=public` | Prisma/Postgres connection |
| `PARSER_SERVICE_URL` | `http://localhost:8000` | FastAPI parser service |
| `ADMIN_SECRET` | local placeholder | Required in production |
| `ADMIN_COOKIE_SECURE` | unset | Set `false` only for local HTTP production-mode compose |

Database setup:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:import-items
```

Parser setup:

```bash
cd parser
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Start the web app:

```bash
npm run dev
```

Docker compose is available for a local production-style stack:

```bash
docker compose up --build
```

On Neil's Windows desktop, the preferred local workflow is the two launchers in the repo root:

```powershell
C:\Projects\PizzaLogs\Start Pizza Logs Local.cmd
C:\Projects\PizzaLogs\Stop Pizza Logs Local.cmd
```

The launchers call repo scripts that manage the local web app on `127.0.0.1:3001`, the parser on `127.0.0.1:8000`, and the local PostgreSQL service. They also keep the old repeating `PizzaLogsLocalTestServer` scheduled task disabled so PowerShell does not pop up every few minutes.

If Windows blocks stopping PostgreSQL, right-click `Stop Pizza Logs Local.cmd` and choose **Run as administrator**. The web and parser processes stop without elevation.

The underlying scripts can be run directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-test-server.ps1 -DisableScheduledTask
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-local-test-server.ps1 -DisableScheduledTask -StopPostgres
```

## Testing And Validation

Common checks:

```bash
npm run lint
npm run type-check
npm run type-check:ecosystem
npm test
npm run build
```

Full PR gate:

```bash
npm run check:pr
```

Parser suite:

```bash
cd parser
pytest tests/ -v
```

Focused TypeScript tests use `npx tsx tests/<file>.test.ts`. `npm test` runs every `tests/*.test.ts` file through the Node test runner.

Parser changes must include fixture or focused pytest validation. See `parser/tests/fixtures/README.md`.

## Deployment

Production deploys from `origin/main` on Railway. Codex does not push or merge `main` directly.

Workflow:

1. Work on `codex-dev`.
2. Merge latest `origin/main` into `codex-dev`.
3. Run validation.
4. Commit and push `origin/codex-dev`.
5. Open a PR from `codex-dev` to `main`.
6. Neil merges the PR when ready; Railway deploys `main`.

Railway startup for the web service runs `start.sh`, which resolves the Prisma CLI entry point, marks historical migrations as applied when needed, runs `prisma migrate deploy`, then starts `node server.js`.

Successful production deployment events and a weekly schedule run `npm run smoke:production`. Admin diagnostics show the Railway commit, branch, deployment ID, environment, service, and app version so the deployed build is identifiable without shell access.

Production requirements:

- `DATABASE_URL` configured by Railway/Postgres.
- `PARSER_SERVICE_URL` points to the internal `parser-py` service.
- `ADMIN_SECRET` is set.
- `ADMIN_COOKIE_SECURE=false` is not set in Railway.

## Repository Map

```text
app/                 Next.js pages and API routes
components/          UI, upload, meters, player gear, roster widgets
lib/                 Prisma client, schemas, parser contracts, Warmane/item helpers
parser/              FastAPI parser service, parser modules, and pytest suite
parser/tests/fixtures/
                     Combat-log fixture inputs and expected outputs
prisma/              Schema, migrations, and seed script
scripts/             Item import and local Windows test-server helpers
docs/                Repo-level workflow, parser, and review docs
DESIGN.md            Frontend hierarchy, spacing, surface, and accessibility contract
Pizza Logs HQ/       Committed project knowledge base
```

## Contribution Workflow

See `CONTRIBUTING.md`, `AGENTS.md`, `DESIGN.md`, `docs/git-workflow.md`, and `.github/pull_request_template.md`.

Short version: keep parser correctness first, avoid direct `main` pushes, keep secrets out of Git, update docs with behavior changes, and use `codex-dev -> PR -> main`.

## Known Limitations

- Fully absorbed missed events without a numeric absorbed amount cannot be measured; multi-shield damage is conservatively attributed to the newest active supported shield and marked ambiguous.
- Boss-specific UwU "useful damage" formulas and global spell-search pages are not copied; generic boss/target damage remains available and the parity boundary is documented.
- Warmane server-side roster/gear fetches can be temporarily unavailable; first-party requests use durable cached snapshots as fallback.
- Hodir Hard Mode and Sartharion drake modes remain unsupported and return `UNKNOWN`.
- Upload concurrency is bounded in-process; distributed rate limiting across multiple Railway replicas is not implemented.
