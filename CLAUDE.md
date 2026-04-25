# Pizza Logs — Claude Instructions

## MANDATORY: Read vault at session start

At the start of EVERY session (before writing any code or answering any question),
Claude MUST read these files in order:

1. `Pizza Logs HQ/00 Inbox/START HERE.md` — master context, key technical facts
2. `Pizza Logs HQ/02 Build Log/Latest Handoff.md` — what happened last session
3. `Pizza Logs HQ/03 Current Focus/Now.md` — what's actively in progress

Do not skip this. Do not summarize from memory. Read the actual files.

---

## MANDATORY: Update vault after every change

After every change session (alongside or before any git commit), Claude MUST update:

1. `Pizza Logs HQ/02 Build Log/Latest Handoff.md` — what was done, current state, exact next step
2. `Pizza Logs HQ/03 Current Focus/Now.md` — active focus and next items
3. `Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md` — if bugs were fixed or found

Include vault file changes in the same git commit as code changes.

---

## Project Quick Reference

- **Live app**: https://pizza-logs-production.up.railway.app
- **Repo**: https://github.com/CRSD-Lau/pizza-logs
- **Stack**: Next.js 15 + TypeScript + Prisma + PostgreSQL + Python FastAPI parser
- **Hosting**: Railway (two services: "Web Service" + "parser-py")
- **Vault**: `Pizza Logs HQ/` — Obsidian vault committed to repo

## Critical Parser Facts (do not get wrong)

- Warmane WotLK logs have **NO ENCOUNTER_START/END** — heuristic detection only
- `SPELL_HEAL`: **14 fields**, crit at **index 13** (NOT 14, NOT 15); `parts[10]`=total heal (before overheal), `parts[11]`=**effective heal** (use this for HPS)
- `SWING_DAMAGE`: no spell fields, spell_name = "Auto Attack", crit at **index 13**
- Player GUIDs: `0x06` prefix (Warmane) or `Player-` prefix (retail)
- Heroic difficulty: **undetectable** — do not attempt
- Gunship Battle: **undetectable** — do not attempt
- KILL duration: use **boss death timestamp**, not last segment event

## Vault Deep Dives

For detailed reference during implementation:
- Architecture: `Pizza Logs HQ/04 Architecture/System Architecture.md`
- Parser internals: `Pizza Logs HQ/04 Architecture/Parser Deep Dive.md`
- Feature status: `Pizza Logs HQ/05 Features/Feature Status.md`
- Railway ops: `Pizza Logs HQ/06 Deployment/Railway Guide.md`
- Active bugs: `Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md`
