# Repo Map

Repo: https://github.com/CRSD-Lau/Pizza-Logs

Local path on Neil's desktop:

```text
C:\Users\neil_\OneDrive\Desktop\PizzaLogs
```

## Top-Level

```text
app/                  Next.js App Router pages and API routes
components/           UI, upload, charts, meters, player gear, roster widgets
lib/                  Shared app logic and data helpers
parser/               FastAPI parser service
prisma/               Prisma schema, migrations, seed
scripts/              Local helper scripts and item import
tests/                TypeScript-focused tests
docs/                 Repo-level parser/workflow/review docs
Pizza Logs HQ/        Committed Obsidian vault
public/               Favicon, icons, intro media
```

## Important Files

| File | Purpose |
|---|---|
| `app/api/upload/route.ts` | Upload SSE route and DB persistence |
| `parser/parser_core.py` | Combat-log segmentation and aggregation |
| `parser/main.py` | Parser service routes, including `/parse-stream` |
| `lib/constants/bosses.ts` | WotLK boss list and ICC ordering helpers |
| `lib/schema.ts` | Zod contracts between parser and web app |
| `lib/actions/milestones.ts` | Milestone computation |
| `lib/warmane-armory.ts` | Gear cache, Warmane normalization, item enrichment |
| `lib/warmane-guild-roster.ts` | Guild roster import/sync/read helpers |
| `lib/armory-gear-client-scripts.ts` | Gear userscript/bookmarklet source |
| `lib/guild-roster-client-scripts.ts` | Roster userscript/bookmarklet source |
| `lib/player-portrait-client-scripts.ts` | Deprecated no-op portrait userscript compatibility update |
| `lib/class-icons.ts` | WoW class icon URL helper for player avatars |
| `lib/gearscore.ts` | GearScoreLite score calculation |
| `lib/item-template.ts` | AzerothCore item metadata import/enrichment helpers |
| `prisma/schema.prisma` | Database schema |
| `Dockerfile` | Railway web service image |
| `parser/Dockerfile` | Railway parser service image |
| `start.sh` | Web service startup and migration deploy |
| `AGENTS.md` | Codex session and branch rules |
| `README.md` | Public setup and architecture overview |

## Public Route Families

- `/`
- `/raids`
- `/raids/[id]/sessions/[sessionIdx]`
- `/raids/[id]/sessions/[sessionIdx]/players/[playerName]`
- `/encounters/[id]`
- `/bosses`
- `/bosses/[bossSlug]`
- `/leaderboards`
- `/players`
- `/players/[playerName]`
- `/guild-roster`
- `/weekly`

## Admin Route Families

- `/admin`
- `/admin/login`
- `/admin/uploads`
- `/admin/uploads/[id]`
- `/api/admin/*`

`/uploads` and `/uploads/[id]` redirect to admin upload history.

## Related

- [[System Architecture]]
- [[Data Model]]
- [[Parser Deep Dive]]
- [[Environment Variables]]
