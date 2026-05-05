# Pizza Logs

Pizza Logs is a Warmane / WotLK 3.3.5a combat-log parser and leaderboard app for the PizzaWarriors guild. Raiders upload `WoWCombatLog.txt`; the app parses boss encounters with Skada-WoTLK-aligned rules, stores reports in PostgreSQL, and shows raid sessions, DPS/HPS rankings, boss history, player profiles, gear, guild roster data, and admin diagnostics.

Live app: https://pizza-logs-production.up.railway.app

## Current Features

- Streaming combat-log upload with Server-Sent Events progress.
- Python FastAPI parser service for WotLK combat logs.
- Skada-WoTLK-aligned damage/healing event handling.
- Boss encounter, raid session, player, weekly, and leaderboard pages.
- File-level and encounter-level deduplication.
- Milestones for all-time DPS/HPS records.
- Admin-only diagnostics, upload history, cleanup controls, and import helpers.
- Header player search across combat-log players and PizzaWarriors/Lordaeron roster-only members.
- Browser-assisted Warmane guild roster, gear, and portrait import flows.
- Gear display backed by cached Warmane equipment plus local AzerothCore item metadata.
- Railway production deployment with separate web and parser services.

## Supported Assumptions

- Primary target: Warmane WotLK 3.3.5a logs for PizzaWarriors on Lordaeron.
- Other WotLK-style logs may work, but Warmane edge cases drive the parser rules.
- Logs do not need reliable `ENCOUNTER_START` / `ENCOUNTER_END`; the parser has a heuristic path.
- If encounter markers exist, the parser can use them, then still applies Warmane-specific heroic correction.
- Skada-WoTLK is the source of truth, not uwu-logs.
- Absorbs are not implemented as healing; Skada tracks absorbs separately.

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL, Prisma 5 |
| Parser | Python 3.12, FastAPI |
| Charts | Recharts |
| Hosting | Railway |

Railway has two app services:

- `Web Service`: Next.js standalone app.
- `parser-py`: FastAPI parser service.

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

1. Browser posts a multipart file to `POST /api/upload` and reads an SSE stream.
2. Next.js forwards the body to `PARSER_SERVICE_URL/parse-stream`.
3. The parser writes the upload to temp disk, counts lines, parses encounters, and streams progress.
4. Next.js validates the final parser payload with Zod.
5. The app upserts realm/guild/player rows, creates encounters and participants, marks the upload `DONE`, then computes milestones.
6. The browser receives a completion event and links to the stored raid session.

Duplicate handling:

| Level | Method |
|---|---|
| File | SHA-256 of full file content via `Upload.fileHash` |
| Encounter | SHA-256 fingerprint from boss, difficulty, time block, and sorted participant names |

Known upload limitation: the client advertises a 1 GB limit, but `/api/upload` does not currently enforce a hard server-side byte limit.

## Parser Behavior

The formal parser contract is in `docs/parser-contract.md`.

Key rules:

- Damage events match Skada `Damage.lua`: `SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, and `SPELL_BUILDING_DAMAGE`.
- Healing events match Skada `Healing.lua`: `SPELL_HEAL` and `SPELL_PERIODIC_HEAL`.
- Effective healing is `max(0, gross - overheal)`.
- `SPELL_HEAL_ABSORBED` is not healing done in Skada.
- `SWING_DAMAGE` uses shifted indexes because it has no spell fields.
- KILL duration uses boss death time, not the last post-kill event.
- Gunship kill detection has a Warmane crew-death override.
- Heroic detection uses marker spells and session normalization where the log evidence supports it. Some encounters remain impossible to classify perfectly from Warmane logs alone.

## Player, Gear, And Roster Data

Player profiles merge:

- combat-log `players` data when the character has uploaded raid participation;
- PizzaWarriors/Lordaeron `guild_roster_members` data for roster-only characters;
- cached Warmane gear snapshots from `armory_gear_cache`;
- local item metadata from `wow_items`.

Warmane live server fetches are best-effort and may fail from Railway or local scripts because of Cloudflare/403 behavior. The supported operational path is browser-assisted import from `/admin`:

- Warmane Gear Sync userscript for character equipment and icon backfill.
- Warmane Guild Roster userscript for roster rank, class, race, professions, and member rows.
- Warmane Portrait userscript for best-effort cached character portraits.

Item names, item levels, stats, slot metadata, and GearScoreLite inputs come from the local AzerothCore `item_template` import:

```bash
npm run db:import-items
```

No runtime Wowhead API dependency is used. Icons are loaded from static `wow.zamimg.com` URLs when an icon slug is available.

## Local Development

Prerequisites:

- Node.js 22+
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

On Neil's Windows desktop, these helpers manage the long-running local test stack on `127.0.0.1:3001` and parser on `127.0.0.1:8000`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-test-server.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-local-test-server.ps1
```

## Testing And Validation

Common checks:

```bash
npm run lint
npm run type-check
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

Focused TypeScript tests use `ts-node --project tsconfig.seed.json tests/<file>.test.ts` unless the test needs JSX-aware options.

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
parser/              FastAPI parser service and pytest suite
parser/tests/fixtures/
                     Combat-log fixture inputs and expected outputs
prisma/              Schema, migrations, and seed script
scripts/             Item import and local Windows test-server helpers
docs/                Repo-level workflow, parser, and review docs
Pizza Logs HQ/       Committed Obsidian project vault
```

## Contribution Workflow

See `CONTRIBUTING.md`, `AGENTS.md`, `docs/git-workflow.md`, and `.github/pull_request_template.md`.

Short version: keep parser correctness first, avoid direct `main` pushes, keep secrets out of Git, update docs with behavior changes, and use `codex-dev -> PR -> main`.

## Known Limitations

- Absorbs are not implemented as a separate metric yet.
- Role detection is a rough upload-time heuristic.
- Warmane server-side roster/gear fetches are unreliable; browser-assisted imports are the supported path.
- Some heroic/Gunship difficulty details cannot be proven from Warmane logs without supporting session evidence.
- Upload rate limiting and hard server-side size enforcement are still open security work.
