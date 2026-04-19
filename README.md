# Pizza Logs

> Premium World of Warcraft combat log analytics for **PizzaWarriors**.  
> Track DPS, HPS, all-time records, and milestones across every WotLK raid boss.

---

## Stack

| Layer        | Tech                              |
|-------------|-----------------------------------|
| Frontend     | Next.js 15, React 19, TypeScript  |
| Styling      | Tailwind CSS 3.4                  |
| Database     | PostgreSQL 16 + Prisma 5          |
| Validation   | Zod                               |
| Parser       | Python 3.12 + FastAPI             |
| Charts       | Recharts                          |
| Deployment   | Docker Compose                    |

---

## Pages

| Route                         | Description                        |
|-------------------------------|------------------------------------|
| `/`                           | Upload + recent milestones         |
| `/weekly`                     | This week's DPS/HPS/kill summary   |
| `/bosses`                     | All-boss rankings table            |
| `/bosses/[slug]`              | Per-boss leaderboard + history     |
| `/encounters/[id]`            | Full encounter breakdown           |
| `/players/[name]`             | Player profile + all-time records  |
| `/uploads`                    | Upload history                     |
| `/admin`                      | Service health + DB diagnostics    |

---

## Architecture

```
Browser → Next.js App (port 3000)
                │
                │  POST /api/upload (multipart)
                ▼
        Python Parser (port 8000)
          - Stream-parses .txt log
          - Detects ENCOUNTER_START/END
          - Heuristic boss detection fallback
          - Dedup fingerprint generation
          - Returns structured JSON
                │
                ▼
        PostgreSQL via Prisma
          - guilds, realms, bosses
          - uploads, encounters, participants
          - milestones, weekly_summaries
```

---

## Local Development

### Prerequisites
- Node 22+, npm
- Python 3.12+
- PostgreSQL 16 (or Docker)

### 1. Clone & install

```bash
git clone <repo>
cd pizza-logs
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Edit DATABASE_URL, PARSER_SERVICE_URL as needed
```

### 3. Database

```bash
# Start Postgres (or use existing instance)
docker run -d --name pg -e POSTGRES_USER=pizzalogs -e POSTGRES_PASSWORD=pizzalogs \
  -e POSTGRES_DB=pizzalogs -p 5432:5432 postgres:16-alpine

npm run db:push      # push schema
npm run db:seed      # seed bosses + default realms
```

### 4. Python parser

```bash
cd parser
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py                     # runs on :8000
```

### 5. Next.js dev server

```bash
# in root directory
npm run dev                        # runs on :3000
```

---

## Docker Compose (Production)

```bash
# Build and run all services
docker compose up --build

# Apply schema + seed
docker compose exec web npx prisma db push
docker compose exec web npx ts-node --project tsconfig.seed.json prisma/seed.ts
```

Services:
- **web** → `localhost:3000`
- **parser** → `localhost:8000`
- **postgres** → `localhost:5432`

---

## Supported Content

### WotLK Raids
- Naxxramas (15 bosses)
- Eye of Eternity, Obsidian Sanctum, Vault of Archavon
- Ulduar (15 bosses including Algalon)
- Trial of the Crusader
- **Icecrown Citadel** (12 bosses, The Lich King supported)
- Ruby Sanctum

### Log Format
- Warmane, Kronos, Blizzard WotLK
- Files up to 1 GB parsed in streaming mode
- `ENCOUNTER_START`/`ENCOUNTER_END` detected first; heuristic boss-name detection as fallback
- Safe handling of malformed lines

---

## Deduplication Strategy

| Level              | Method                                      |
|--------------------|---------------------------------------------|
| File               | SHA-256 of entire file content              |
| Encounter          | SHA-256 of `bossName + difficulty + weekBlock + sorted(top25 participants)` |
| Re-upload handling | New encounters in an already-uploaded file are still stored |

---

## Milestone Ranks Tracked
`#1 · #3 · #5 · #10 · #25 · #50 · #100` — all-time per boss per difficulty per metric (DPS/HPS)

---

## Multi-Guild / Multi-Realm

- Select realm (Lordaeron, Icecrown, etc.) and guild name at upload time
- Realm is inferred from selection, not log content (WotLK logs don't include realm)
- Architecture supports full isolation by `realmId` / `guildId` on all queries

---

## Adding New Bosses

Edit `lib/constants/bosses.ts` and `parser/bosses.py` (both must stay in sync), then re-run:

```bash
npm run db:seed
```

---

## Project Structure

```
├── app/                 Next.js App Router pages + API routes
├── components/
│   ├── layout/          Nav
│   ├── ui/              Button, Card, Badge, Skeleton, EmptyState, StatCard
│   ├── upload/          UploadZone (drag-and-drop)
│   ├── meter/           DamageMeter (expandable spell breakdown)
│   └── charts/          LeaderboardBar
├── lib/
│   ├── constants/       bosses.ts, classes.ts
│   ├── actions/         milestones.ts
│   ├── db.ts            Prisma client singleton
│   ├── schema.ts        Zod schemas
│   └── utils.ts         formatters, week bounds
├── parser/              Python FastAPI service
│   ├── main.py          FastAPI routes
│   ├── parser_core.py   Combat log parser
│   └── bosses.py        WotLK boss definitions
├── prisma/
│   ├── schema.prisma    Full data model
│   └── seed.ts          Boss + realm seeding
└── docker-compose.yml
```
