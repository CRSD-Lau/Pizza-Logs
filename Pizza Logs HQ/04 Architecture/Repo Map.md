# Repo Map

**Repo:** https://github.com/CRSD-Lau/pizza-logs  
**Local:** `C:\Users\neil_\OneDrive\Desktop\PizzaLogs\`

---

## Key Files

```
parser/
  parser_core.py            ← core logic: SPELL_CLASS_MAP, segmentation, aggregation
  bosses.py                 ← boss defs + aliases (mirrors lib/constants/bosses.ts)
  main.py                   ← FastAPI app: /parse and /parse-stream endpoints

app/
  api/upload/route.ts       ← upload handler: streams to parser, batches DB writes
  raids/page.tsx            ← raids index, grouped by calendar day
  uploads/[id]/
    page.tsx                ← session list for one upload
    sessions/[idx]/
      page.tsx              ← single raid session detail + roster
      players/[name]/
        page.tsx            ← session-scoped player analytics + DPS/HPS chart
  players/
    page.tsx                ← player listing with class filter
    [playerName]/page.tsx   ← all-time player profile
  encounters/[id]/page.tsx  ← single boss pull: meters, spell breakdown, roster
  weekly/page.tsx
  bosses/[slug]/page.tsx
  admin/page.tsx            ← DB stats, service health

components/
  upload/UploadZone.tsx         ← upload UI, SSE reader, browser notifications
  meter/DamageMeter.tsx         ← DPS/HPS table with spell drill-down
  meter/MobBreakdown.tsx        ← mob damage table with player drill-down
  charts/SessionLineChart.tsx   ← recharts line chart (session player page)
  charts/LeaderboardBar.tsx     ← CSS-only bar for leaderboards
  ui/AccordionSection.tsx       ← collapsible section (client component)
  ui/StatCard.tsx
  ui/Badge.tsx
  layout/Nav.tsx                ← Upload|Raids|Players|This Week|Bosses|History|Admin

lib/
  constants/bosses.ts       ← WOTLK_BOSSES: sortOrder (ICC=10-40, Naxx=700-741)
  constants/classes.ts      ← CLASS_COLORS, getClassColor(), WOW_CLASSES
  db.ts                     ← Prisma client singleton
  schema.ts                 ← Zod: ParseResultSchema, UploadResponseSchema
  utils.ts                  ← formatDps, formatNumber, formatDuration, cn
  actions/milestones.ts     ← computeMilestones() — rank detection post-upload

prisma/
  schema.prisma             ← DB schema (source of truth → see [[Data Model]])
  seed.ts                   ← seeds Boss table from bosses.ts

Pizza Logs HQ/              ← this Obsidian vault (committed to repo)
CLAUDE.md                   ← instructs Claude to read vault at session start
start.sh                    ← Railway startup: prisma db push → node server.js
Dockerfile                  ← multi-stage; --chown=nextjs:nodejs on prisma dirs
```

---

## Related
- [[System Architecture]] — how these files talk to each other
- [[Data Model]] — DB schema quick reference
- [[Parser Deep Dive]] — parser internals and edge cases
- [[Environment Variables]] — env vars per service
