# Pizza Logs

> WotLK combat log analytics for **PizzaWarriors**.  
> Upload a log, see DPS/HPS breakdowns, boss kill history, all-time records, and milestones.

**Live:** https://pizza-logs-production.up.railway.app

---

## Codex-First Maintenance

Pizza Logs uses Codex as the canonical agent workflow. `AGENTS.md` is the source of truth for repo-specific agent rules: read the vault startup files first, protect parser correctness, update the vault after changes, and run deployment gates before pushing `main`.

For significant changes, request review with `@codex review` on GitHub if configured. See `docs/code-review.md` for the parser, upload, admin, Railway, secret, stale-code, and dependency review checklist.

Codex branch workflow is documented in `docs/git-workflow.md` and `docs/pr-readiness.md`. The short version: Codex works on `codex-dev`, opens PRs into `main`, and never pushes or merges directly to `main`.

---

## Gear Display

Player gear is displayed on profile pages using data from two sources:

| Source | What it provides |
|--------|-----------------|
| Warmane Armory (Tampermonkey userscript) | Equipped item IDs, icon slugs, enchants, gems |
| AzerothCore `item_template` (local DB) | Item name, ilvl, quality, slot type, stats, armor |

**No runtime external API calls.** Wowhead is not used. Icon images are served from the static `wow.zamimg.com` CDN.

### Importing item metadata

Run once after deploying (or to refresh):

```bash
npm run db:import-items
```

This downloads and imports AzerothCore's WotLK `item_template.sql` (~80k items) into the `wow_items` table. Safe to re-run — existing rows are updated, `iconName` (from Warmane) is never overwritten.

---

## Player Search

The global header search calls `GET /api/players/search?q=<query>`. Results are built from the `players` table for combat-log characters and the PizzaWarriors/Lordaeron `guild_roster_members` rows for roster-only characters. The endpoint returns a small capped JSON payload with profile paths and display metadata; it does not scan uploads or combat-log records.

---

## Stack

| Layer      | Tech                             |
|------------|----------------------------------|
| Frontend   | Next.js 15, React 19, TypeScript |
| Styling    | Tailwind CSS 3.4                 |
| Database   | PostgreSQL 16 + Prisma 5         |
| Validation | Zod                              |
| Parser     | Python 3.12 + FastAPI            |
| Charts     | Recharts                         |
| Hosting    | Railway (two services)           |

---

## Pages

| Route | Description |
|---|---|
| `/` | Upload zone + recent milestones |
| `/raids` | Raid history browser |
| `/uploads/[id]` | Full upload breakdown by session |
| `/uploads/[id]/sessions/[idx]` | Session detail — damage/heal meters |
| `/uploads/[id]/sessions/[idx]/players/[name]` | Per-player session stats |
| `/bosses` | All-boss rankings |
| `/bosses/[slug]` | Per-boss leaderboard + kill history |
| `/leaderboards` | Global leaderboards |
| `/players` | Player roster |
| `/players/[name]` | All-time player profile |
| `/api/players/search?q=<query>` | Header autocomplete source for combat-log and roster players |
| `/weekly` | This week's DPS/HPS/kill summary |
| `/admin` | Service health + DB diagnostics |

---

## Architecture

```
Browser
  │
  │  POST /api/upload (multipart, SSE progress stream)
  ▼
Next.js App (Railway Web Service)
  │
  │  HTTP → parser service
  ▼
Python FastAPI Parser (Railway parser-py service)
  - Streams .txt log line-by-line
  - Heuristic boss detection (Warmane has no ENCOUNTER_START/END)
  - Replicates Skada-WoTLK damage/healing logic exactly
  - Returns structured JSON
  │
  ▼
PostgreSQL (Railway Postgres)
  - guilds, realms, bosses
  - uploads, encounters, participants
  - milestones
```

### Parser: Skada-WoTLK as Source of Truth

The parser replicates [Skada-WoTLK](https://github.com/bkader/Skada-WoTLK) exactly — the same addon the raid uses in-game.

- **DMG_EVENTS** — matches `Damage.lua` `RegisterForCL` exactly (including `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `SPELL_BUILDING_DAMAGE`)
- **Heal formula** — `effective = max(0, gross - overheal)` per `Healing.lua`
- **No spell exclusions** — `Tables.lua` has no `ignored_spells.heal`; all `SPELL_HEAL` / `SPELL_PERIODIC_HEAL` events count
- **Absorbs** — tracked separately in `Absorbs.lua` (Power Word: Shield); not yet implemented

---

## Parser Validation

The parser is validated against a fixture system of synthetic and real combat logs.

**Running parser tests:**
```bash
cd parser
pytest tests/ -v
```

**Web validation:**
```bash
npm run type-check
npm run lint
npm run build
```

**Adding a new fixture:**
See `parser/tests/fixtures/README.md` for the full process. Short version: add
`combatlog.txt` + `expected.json` to a new subdirectory under `parser/tests/fixtures/`,
then run `pytest tests/test_fixtures.py -v`.

**Known deviations from uwu-logs:**
- Encounter boundaries differ (30s heuristic vs uwu-logs window algorithm)
- We subtract overkill from damage totals (Skada does; uwu-logs may not)
- We remap pet damage to owner (uwu-logs may not)

See `docs/parser-contract.md` for the full specification.

**Debug mode (admin only):**
POST to `/parse-debug` on the parser service to get per-encounter debug metadata
(difficulty evidence, heroic markers, outcome reasoning). See `docs/parser-contract.md § Debug Mode`.

---

## Local Development

### Prerequisites
- Node 22+
- Python 3.12+
- PostgreSQL 16 (or Docker for local DB)

### 1. Clone & install

```bash
git clone https://github.com/CRSD-Lau/pizza-logs
cd pizza-logs
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Set DATABASE_URL and PARSER_SERVICE_URL
# Set ADMIN_SECRET for admin routes; production requires it
```

### 3. Database

```bash
# Start Postgres (skip if using Railway DB locally)
docker run -d --name pg \
  -e POSTGRES_USER=pizzalogs -e POSTGRES_PASSWORD=pizzalogs \
  -e POSTGRES_DB=pizzalogs -p 5432:5432 postgres:16-alpine

node ./node_modules/prisma/build/index.js db push
node ./node_modules/prisma/build/index.js db seed
```

### 4. Python parser

```bash
cd parser
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py                 # runs on :8000
```

### 5. Next.js dev server

```bash
npm run dev                    # runs on :3000
```

### Windows persistent local test server

Neil's desktop checkout uses `.env.local` with the web app on `http://127.0.0.1:3001`, the parser on `http://127.0.0.1:8000`, and local PostgreSQL on `localhost:5432`.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-test-server.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-local-test-server.ps1
```

The startup script is idempotent: it starts missing services and leaves already-running listeners alone. On Neil's machine, Windows Task Scheduler task `PizzaLogsLocalTestServer` runs it at logon and every 5 minutes as a watchdog.

---

## Supported Content

### WotLK Raids
- Naxxramas (15 bosses)
- Eye of Eternity, Obsidian Sanctum, Vault of Archavon
- Ulduar (15 bosses including Algalon)
- Trial of the Crusader
- **Icecrown Citadel** (12 bosses, The Lich King supported)
- Ruby Sanctum

### Log Compatibility
- Warmane (Lordaeron, Icecrown) — primary target
- Kronos, Blizzard WotLK
- Files up to 1 GB, parsed in streaming mode
- No `ENCOUNTER_START/END` required — heuristic boss detection

---

## Deduplication

| Level     | Method |
|-----------|--------|
| File      | SHA-256 of full file content |
| Encounter | SHA-256 of `bossName + difficulty + weekBlock + sorted(top25 players)` |

Re-uploading the same file is a no-op. Uploading a different log file that shares encounters with a previous upload stores only the new encounters.

---

## Milestones

Rank thresholds tracked per boss per difficulty per metric (DPS/HPS):  
`#1 · #3 · #5 · #10 · #25 · #50 · #100`

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── bosses/            boss list
│   │   ├── encounters/        encounter detail + list
│   │   ├── leaderboard/       ranking queries
│   │   ├── players/[name]/    player stats
│   │   ├── upload/            multipart upload + SSE stream
│   │   ├── uploads/           upload history
│   │   └── weekly/            weekly summary data
│   ├── admin/                 admin dashboard + login (secret-protected)
│   ├── bosses/[bossSlug]/     per-boss leaderboard + kill history
│   ├── encounters/[id]/       full encounter breakdown
│   ├── leaderboards/          global rankings
│   ├── players/[playerName]/  all-time player profile
│   ├── raids/                 raid history browser
│   ├── uploads/[id]/
│   │   └── sessions/[idx]/
│   │       └── players/[name]/  per-player session stats
│   ├── weekly/                weekly summary
│   └── layout.tsx             root layout + nav + footer
├── components/
│   ├── charts/
│   │   ├── LeaderboardBar.tsx
│   │   └── SessionLineChart.tsx
│   ├── layout/
│   │   └── Nav.tsx
│   ├── meter/
│   │   ├── DamageMeter.tsx      expandable damage/heal meter
│   │   └── MobBreakdown.tsx
│   ├── ui/
│   │   ├── AccordionSection.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx
│   │   ├── StatCard.tsx
│   │   └── index.ts
│   └── upload/
│       ├── UploadZone.tsx           drag-and-drop, SSE progress
│       └── UploadZoneWithRefresh.tsx
├── lib/
│   ├── actions/milestones.ts    milestone rank computation
│   ├── constants/
│   │   ├── bosses.ts
│   │   └── classes.ts
│   ├── db.ts                    Prisma client singleton
│   ├── schema.ts                Zod schemas
│   └── utils.ts                 formatters, week bounds
├── parser/                      Python FastAPI service
│   ├── main.py                  FastAPI routes + SSE upload endpoint
│   ├── parser_core.py           combat log parser (Skada-WoTLK aligned)
│   ├── bosses.py                WotLK boss definitions
│   ├── diagnose.py              diagnostic utilities
│   ├── Dockerfile
│   └── tests/
│       └── test_parser_core.py  71 pytest tests
├── prisma/
│   ├── schema.prisma            full data model
│   └── seed.ts                  boss + realm seeding
├── middleware.ts                admin auth cookie check
├── start.sh                     Railway startup (prisma migrate deploy + node server.js)
├── docker-compose.yml
├── SECURITY.md
├── AGENTS.md                    Codex workflow and parser safety rules
├── docs/code-review.md          Codex review checklist
└── Pizza Logs HQ/               Obsidian project vault (docs, decisions, handoffs)
```
