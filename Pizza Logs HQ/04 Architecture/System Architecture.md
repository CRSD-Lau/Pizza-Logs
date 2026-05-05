# System Architecture

## Request Flow

```text
Browser
  POST /api/upload?filename=...&realmName=...
  multipart/form-data, SSE response
    |
Next.js Web Service
  forwards request body to PARSER_SERVICE_URL /parse-stream
    |
Python parser-py service
  writes temp file, counts lines, parses encounters, streams progress and final JSON
    |
Next.js Web Service
  validates parser JSON, writes DB rows, computes milestones
    |
PostgreSQL
    |
Browser receives complete SSE event and links to raid/session pages
```

## SSE Events

Parser service emits:

```json
{ "type": "progress", "pct": 45, "msg": "Aggregating DPS and HPS..." }
{ "type": "done", "data": { "...": "ParseResult" } }
{ "type": "error", "msg": "..." }
```

Next.js upload route forwards progress and turns parser `done` into:

```json
{ "type": "complete", "result": { "...": "UploadResponse" } }
```

## Parser Internals

```text
CombatLogParser.parse_file()
  _iter_lines()
  _segment_encounters()
    Path A: ENCOUNTER_START / ENCOUNTER_END
    Path B: Warmane heuristic boss windows
  _aggregate_segment()
    detect boss
    detect difficulty and heroic evidence
    detect kill/wipe outcome
    aggregate damage, healing, damage taken, deaths, crits
    remap pets where owner evidence exists
    generate encounter fingerprint
  _normalize_session_difficulty()
  _assign_session_indices()
```

## Web Subsystems

| Area | Files |
|---|---|
| Upload | `components/upload/UploadZone.tsx`, `app/api/upload/route.ts` |
| Admin | `middleware.ts`, `lib/admin-auth.ts`, `app/admin/*`, `app/api/admin/*` |
| Player search | `components/players/PlayerSearch.tsx`, `lib/player-search.ts`, `app/api/players/search/route.ts` |
| Gear | `lib/warmane-armory.ts`, `lib/gearscore.ts`, `lib/item-template.ts`, `components/players/*` |
| Guild roster | `lib/warmane-guild-roster.ts`, `components/guild-roster/GuildRosterTable.tsx`, `app/guild-roster/page.tsx` |
| Weekly stats | `lib/weekly-stats.ts`, `app/weekly/page.tsx`, `app/api/weekly/route.ts` |
| Boss order/reveal | `lib/constants/bosses.ts`, `lib/ui-animation.ts` |

## Database

Core upload data:

- `uploads`
- `encounters`
- `participants`
- `players`
- `bosses`
- `milestones`

Support data:

- `guild_roster_members`
- `armory_gear_cache`
- `wow_items`
- `weekly_summaries`

## Deployment

Railway production runs:

- Next.js `Web Service`, built from root `Dockerfile`.
- Python `parser-py`, built from `parser/Dockerfile`.
- PostgreSQL database.

`start.sh` runs `prisma migrate deploy`, then `node server.js`.
