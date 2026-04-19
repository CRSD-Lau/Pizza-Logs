# Pizza Logs — Claude Instructions

## Obsidian Vault Rule (MANDATORY)
The Obsidian vault lives at `Pizza Logs HQ/` inside this repo.

**After every change session** (before or alongside any git commit), Claude MUST:
1. Update `Pizza Logs HQ/02 Build Log/Latest Handoff.md` with what was done, current state, and exact next step
2. Update `Pizza Logs HQ/03 Current Focus/Now.md` with what's actively being worked on and what's next
3. Include vault file changes in the same git commit as code changes (or a follow-up commit in the same session)

Do not wait to be asked. Do not skip this step. These notes are the source of truth for session continuity.

---

## Project Overview
Pizza Logs — WoW WotLK combat log analytics for Warmane private server.

- **Live app**: https://pizza-logs-production.up.railway.app
- **Repo**: https://github.com/CRSD-Lau/pizza-logs
- **Railway project**: Pizza Logs (production environment)
- **Stack**: Next.js 15 + TypeScript + Prisma + PostgreSQL (Railway) + Python parser (FastAPI, separate Railway service)

## Architecture
- `app/` — Next.js pages and API routes
- `components/` — React UI components
- `lib/` — DB client, utils, constants (class colors, boss list)
- `parser/` — Python FastAPI parser service
  - `parser_core.py` — core parsing logic (heuristic encounter segmentation)
  - `bosses.py` — WoW boss definitions and aliases
- `prisma/` — schema and seed data
- `Pizza Logs HQ/` — Obsidian vault (session notes, architecture, build log)

## Key Parser Facts (Warmane / WotLK)
- **No ENCOUNTER_START/END events** — encounter detection is purely heuristic
- Player GUIDs use `0x06` prefix; NPC GUIDs use `0x03`
- Heroic difficulty is undetectable without ENCOUNTER_START
- Gunship Battle cannot be isolated from Deathbringer Saurfang (timing overlap)
- SPELL_HEAL format: 14 fields, crit at index 13
- Valithria Dreamwalker KILL = "Green Dragon Combat Trigger" UNIT_DIED (not Valithria herself)
- KILL duration: use boss death timestamp, not last segment event

## Railway CLI Notes
- `railway run --service "Web Service" <cmd>` — runs locally with Railway env injected
- Internal URLs (postgres.railway.internal, parser-py.railway.internal) are NOT reachable locally
- Use public proxy URL or a temporary API endpoint for local→Railway DB operations

## Reference Site
https://uwu-logs.xyz — use as ground truth for DPS/HPS accuracy checks
Test log: https://uwu-logs.xyz/reports/26-04-17--18-47--Rimeclaw--Lordaeron/
