# Pizza Logs - Start Here

Read this first at the start of every Codex session, then read:

1. `Pizza Logs HQ/02 Build Log/Latest Handoff.md`
2. `Pizza Logs HQ/03 Current Focus/Now.md`

Then run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' status --short --branch
```

## Project

Pizza Logs is a Warmane / WotLK 3.3.5a combat-log parser and leaderboard app for PizzaWarriors.

- Live app: https://pizza-logs-production.up.railway.app
- Repo: https://github.com/CRSD-Lau/Pizza-Logs
- Canonical remote: `origin`
- Production deploys from `origin/main`
- Codex works on `codex-dev`, pushes `origin/codex-dev`, and opens PRs into `main`
- Codex must not commit, push, or merge directly on `main`

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 15, React 19, TypeScript, Tailwind |
| Parser | Python FastAPI service |
| Database | PostgreSQL with Prisma |
| Hosting | Railway Web Service plus `parser-py` |

## Core Flow

Browser upload -> one UUID-keyed raw request to `POST /api/upload` -> Next.js forwards to parser `/uploads/{upload_id}/stream` -> parser validates and atomically finalizes the file, emits a quick classification, then streams full parse progress and final JSON -> Next.js writes uploads, encounters, participants, and milestones -> browser links to stored raid/session pages.

`/parse-stream` remains a compatibility path for older callers; the browser upload uses the UUID-keyed route.

## Parser Rules That Matter

Parser correctness is the product. Preserve Skada-WoTLK combat primitives and
match the adopted UwU public report definitions documented in
`docs/uwu-analytics-parity.md`; do not copy undocumented behavior blindly.

- Warmane logs often lack reliable `ENCOUNTER_START` / `ENCOUNTER_END`, so heuristic boss detection remains required.
- If encounter markers exist, the parser can use them, but heroic correction still checks Warmane-specific evidence.
- Damage events: `SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`, `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `SPELL_BUILDING_DAMAGE`.
- Heal events: `SPELL_HEAL`, `SPELL_PERIODIC_HEAL`.
- `SPELL_HEAL`: `parts[10]` gross, `parts[11]` overheal, `parts[12]` absorbed, `parts[13]` crit.
- Effective healing is `max(0, parts[10] - parts[11])`.
- Headline Total Damage uses the raw damage-event `amount`; useful/effective damage remains separate.
- `SWING_DAMAGE` has shifted indexes: amount at `parts[7]`, overkill at `parts[8]`, absorbed at `parts[12]`, crit at `parts[13]`.
- KILL duration uses boss death timestamp, not the last post-kill event.
- Gunship kill handling uses Warmane crew-death evidence.
- Absorbs stay separate from effective healing; the UwU-style session Heal column explicitly adds attributed absorbs.

Formal details: `docs/parser-contract.md`.

## Current Product Areas

- Upload and parser pipeline
- Raids, sessions, encounters, leaderboards, weekly stats, players
- Admin diagnostics and admin upload history
- Guild roster cache for PizzaWarriors/Lordaeron
- Warmane gear cache, GearScoreLite display, AzerothCore item metadata
- Browser userscripts for roster and gear imports
- Desktop start/stop launchers for the local web, parser, and PostgreSQL services
- Cinematic intro and responsive page polish

## Files To Know

```text
app/api/upload/route.ts       Upload handler and DB writes
parser/parser_core.py         Core parser logic
parser/main.py                Parser API and SSE endpoint
lib/constants/bosses.ts       Boss order and display helpers
lib/warmane-armory.ts         Gear cache and Warmane gear normalization
lib/warmane-guild-roster.ts   Guild roster import/sync helpers
lib/gearscore.ts              GearScoreLite implementation
prisma/schema.prisma          Database schema
README.md                     Public setup and architecture overview
AGENTS.md                     Codex workflow and repo guardrails
```

## Do Not Re-Invent

- Keep `codex-dev -> PR -> main`.
- Use existing Warmane cache/import paths for gear and roster data.
- Use `AccordionSection` for data-heavy expandable sections.
- Keep upload status `DONE` before `computeMilestones`.
- Filter raid history by stored encounters, not only upload status.
- Do not build a Railway-side Cloudflare bypass for Warmane.
