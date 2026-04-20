# START HERE — Pizza Logs Session Context

> Claude: read this note at the start of every session. It is the single source of truth.
> After reading, check [[Latest Handoff]] for what happened last session and [[Now]] for current focus.

---

## What This Project Is

**Pizza Logs** — WoW WotLK combat log analytics for the PizzaWarriors guild on Warmane (Lordaeron server).
Players upload their `WoWCombatLog.txt`, the parser extracts raid boss encounters, and the app shows DPS/HPS rankings, milestones, and historical records.

- **Live app**: https://pizza-logs-production.up.railway.app
- **GitHub**: https://github.com/CRSD-Lau/pizza-logs
- **Reference site** (ground truth for parse accuracy): https://uwu-logs.xyz/reports/26-04-17--18-47--Rimeclaw--Lordaeron/

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Database | PostgreSQL on Railway, Prisma ORM |
| Parser | Python 3.12, FastAPI, uvicorn |
| Hosting | Railway (two services: Web Service + parser-py) |
| Vault | Obsidian, lives at `Pizza Logs HQ/` inside the repo |

---

## App Routes

| Route | Purpose |
|---|---|
| `/` | Upload page + homepage stats |
| `/weekly` | This week's top DPS/HPS per boss |
| `/bosses` | All-time leaderboard per boss |
| `/history` | Recent encounters |
| `/admin` | DB stats, service health, upload timings |

---

## Key Technical Facts (read before touching parser)

### Warmane WotLK Log Format
- **No `ENCOUNTER_START` / `ENCOUNTER_END` events** — encounter detection is purely heuristic
- Player GUIDs start with `0x06` (Warmane) or `Player-` (retail format)
- NPC GUIDs start with `0x03`
- `SPELL_HEAL` format: **14 fields**, crit at **index 13** (not 14, not 15)
- `SWING_DAMAGE`: no spell fields — spell name defaults to "Auto Attack"
- Heroic difficulty is **undetectable** without ENCOUNTER_START (same NPC/spell IDs as normal)

### Encounter Segmentation (heuristic)
- Anchor on events where src or dst name matches a known boss
- Collect ALL events within 30s of last boss event (`ENCOUNTER_GAP_SECONDS = 30`)
- End segment when 30s pass with no boss event
- Minimum 10 events to be a real encounter (`MIN_ENCOUNTER_EVENTS = 10`)

### Duration Calculation
- For KILL encounters: use **boss death timestamp** (not last segment event — post-fight tail inflates duration)
- For WIPE encounters: use last segment event

### Special Cases
- **Valithria Dreamwalker**: KILL = "Green Dragon Combat Trigger" UNIT_DIED (she never dies on success)
- **Gunship Battle**: undetectable — timing overlaps with Deathbringer Saurfang pull (known limitation)
- **False positives**: filter out segments with 0 damage and duration < 60s

### Class Detection
- `SPELL_CLASS_MAP` in `parser_core.py` maps ~150 spell names → WoW class
- Populated during aggregation loop, saved to `Player.class` in DB

---

## Known Limitations (do not try to fix without a plan)

1. **Heroic difficulty**: impossible to detect without ENCOUNTER_START — not worth pursuing
2. **Gunship Battle**: timing overlap with Saurfang — accepted limitation
3. **DPS accuracy vs uwu-logs**: slight discrepancy (~1-2%) — under investigation

---

## Known Issues / Bugs

See [[Known Issues]] for full list. Top items:
- Marrowgar DPS: app shows ~9.45k, uwu-logs shows 9.3k — investigating over-count
- SSE progress streaming: recently shipped, needs end-to-end test after Railway deploy

---

## Railway

- **Project**: Pizza Logs
- **Environment**: production
- **Services**: "Web Service" (Next.js) + "parser-py" (FastAPI)
- **DB**: Postgres on Railway internal network (`postgres.railway.internal:5432`)
- **Internal URLs not reachable locally** — use a temporary API endpoint or Railway shell for DB ops
- Parser internal URL: `http://parser-py.railway.internal:8000`
- App public URL: `https://pizza-logs-production.up.railway.app`

### Common Commands
```bash
# Check Railway status
railway status

# View logs (Next.js)
railway logs --service "Web Service"

# View logs (parser)
railway logs --service "parser-py"

# Clear DB (use temp API endpoint — see Deployment guide)
curl -X POST https://pizza-logs-production.up.railway.app/api/admin/reset-db \
  -H "Content-Type: application/json" -d '{"secret":"pizza-reset-2026"}'
# NOTE: reset-db endpoint was DELETED 2026-04-19. Recreate if needed.
```

---

## File Map (most important files)

```
parser/
  parser_core.py       ← core parse logic, SPELL_CLASS_MAP, segmentation, aggregation
  bosses.py            ← boss definitions and aliases (mirrors lib/constants/bosses.ts)
  main.py              ← FastAPI app, /parse and /parse-stream endpoints

app/
  api/upload/route.ts  ← upload handler: streams to parser, batches DB writes
  admin/page.tsx        ← admin dashboard

components/upload/
  UploadZone.tsx       ← upload UI, SSE stream reader, browser notification

lib/
  constants/bosses.ts  ← boss sort order + definitions (ICC first, Naxx last)
  constants/classes.ts ← WoW class colors (getClassColor function)
  db.ts                ← Prisma client
  schema.ts            ← Zod schemas for parse result and upload response

prisma/
  schema.prisma        ← DB schema
  seed.ts              ← seeds Boss table from lib/constants/bosses.ts

Pizza Logs HQ/         ← this Obsidian vault (committed to repo)
CLAUDE.md              ← instructs Claude to read this vault every session
```

---

## Vault Navigation

- [[Latest Handoff]] — what happened last session, exact next steps
- [[Now]] — current active focus
- [[System Architecture]] — full technical architecture diagram
- [[Parser Deep Dive]] — parser internals, format docs, known edge cases
- [[Feature Status]] — what's built, what's planned, backlog
- [[Railway Guide]] — deployment, env vars, common ops
- [[Known Issues]] — bugs and their status
- [[Repo Map]]
