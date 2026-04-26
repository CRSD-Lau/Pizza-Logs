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

## Parser Philosophy — Skada-First

**The parser must replicate Skada-WoTLK exactly.**

Skada (https://github.com/bkader/Skada-WoTLK) is the in-game addon used by the raid to track
damage and healing. The website should show the same numbers players see in-game.
We do NOT try to match UWU — we have no UWU source code and it is not the player-facing reference.

**Every parser decision must be grounded in Skada's Lua source:**
- When adding or removing a spell exclusion, cite the Skada file/line
- When interpreting a combat log field, verify against Skada's suffix/field definitions
- When unsure how Skada handles an edge case, fetch the source and read it

**Skada source reference:** https://github.com/bkader/Skada-WoTLK
Key files:
- `Skada/Modules/Healing.lua` — healing done tracking, ignored_spells.heal, effective heal formula
- `Skada/Modules/Absorbs.lua` — shield absorb tracking (separate from healing)
- `Skada/Modules/Damage.lua` — damage done tracking
- `Skada/Core/Tables.lua` — ignored_spells.heal exclusion list (JoL is excluded here)
- `Skada/Core/Functions.lua` — event suffix/field index definitions

---

## Critical Parser Facts (do not get wrong)

- Warmane WotLK logs have **NO ENCOUNTER_START/END** — heuristic detection only
- `SPELL_HEAL` field layout (confirmed via Skada suffix `amount, overheal, absorbed, critical`):
  - `parts[10]` = **gross heal** (total cast amount, before overheal)
  - `parts[11]` = **overheal** (wasted portion — target near/at full HP)
  - `parts[12]` = absorbed (by shields)
  - `parts[13]` = critical ("1" or "nil")
  - **Effective heal = max(0, parts[10] - parts[11])** — this is what Skada uses
- `SWING_DAMAGE`: no spell fields, spell_name = "Auto Attack", crit at **index 13**
- Player GUIDs: `0x06` prefix (Warmane) or `Player-` prefix (retail)
- Heroic difficulty: **undetectable** — do not attempt
- Gunship Battle: **undetectable** — do not attempt
- KILL duration: use **boss death timestamp**, not last segment event

## Healing Exclusions (per Skada Tables.lua `ignored_spells.heal`)

- **Judgement of Light** — EXCLUDED (explicitly in Skada's ignored_spells.heal)
- **Vampiric Embrace** — INCLUDED (not in Skada exclusion list)
- **Improved Leader of the Pack** — INCLUDED (not in Skada exclusion list)

## Absorbs (Skada `Absorbs.lua` — separate from Healing module)

Skada tracks absorbs (Power Word: Shield, etc.) in a dedicated module, separate from
`actor.heal`. PW:S absorbs are detected via:
1. `SPELL_AURA_APPLIED` / `SPELL_AURA_REFRESH` — shield applied, store capacity
2. `absorbed` field on incoming damage events — count what was actually consumed

Whether to include absorbs in the website's "healing done" column is TBD — we need to
decide if we want to match Skada's Healing module (heal-only) or Skada's combined
Healing+Absorbs view.

## Vault Deep Dives

For detailed reference during implementation:
- Architecture: `Pizza Logs HQ/04 Architecture/System Architecture.md`
- Parser internals: `Pizza Logs HQ/04 Architecture/Parser Deep Dive.md`
- Feature status: `Pizza Logs HQ/05 Features/Feature Status.md`
- Railway ops: `Pizza Logs HQ/06 Deployment/Railway Guide.md`
- Active bugs: `Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md`
