# Pizza Logs — Start Here

> Read this first every session. Then read Latest Handoff → Now.md.

---

## What This Project Is

**Pizza Logs** is a WoW WotLK raid log parser and leaderboard site for a Warmane private server guild. Raiders upload their `WoWCombatLog.txt` and the site shows DPS/HPS rankings, boss kill history, and personal progression — matching what players see in **Skada** in-game.

**Live site:** https://pizza-logs-production.up.railway.app  
**Repo:** https://github.com/CRSD-Lau/pizza-logs

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 + TypeScript + Tailwind |
| Backend | Next.js API routes (upload, leaderboard, encounters) |
| Parser | Python FastAPI (`parser-py` Railway service) |
| Database | PostgreSQL (Railway managed) |
| ORM | Prisma |
| Hosting | Railway — two services: `Web Service` + `parser-py` |

---

## Parser Philosophy

**Match Skada-WoTLK exactly.** Source: https://github.com/bkader/Skada-WoTLK

Skada is the in-game meter the raid uses. The website must show the same numbers.  
We do **not** try to match UWU — no source code available.

Every parser decision must cite a Skada file/line. Key files:
- `Skada/Modules/Damage.lua` — what damage events are tracked
- `Skada/Modules/Healing.lua` — what heal events are tracked, effective heal formula
- `Skada/Core/Tables.lua` — spell exclusion lists
- `Skada/Core/Functions.lua` — event field suffix definitions

---

## Critical Technical Facts

### Warmane-specific
- **No ENCOUNTER_START/END** — all boss detection is heuristic
- **Heroic undetectable** — same spell/NPC IDs in 25N and 25H; don't attempt
- **Gunship Battle undetectable** — don't attempt
- Player GUIDs: `0x06` prefix on Warmane, `Player-` prefix on retail

### SPELL_HEAL field layout (Skada: `HEAL = "amount, overheal, absorbed, critical"`)
```
parts[10] = gross heal   (total cast amount)
parts[11] = overheal     (wasted — target near full HP)
parts[12] = absorbed     (absorbed by shields)
parts[13] = critical     ("1" or "nil")
Effective heal = max(0, parts[10] - parts[11])
```

### SPELL_DAMAGE field layout (Skada: `DAMAGE = "amount, overkill, school, resisted, blocked, absorbed, critical, ..."`)
```
parts[10] = amount    parts[11] = overkill   parts[15] = absorbed
Effective damage = max(0, amount - overkill - absorbed)
```

### SWING_DAMAGE (no spell fields — indices shift by 3)
```
parts[7] = amount   parts[8] = overkill   parts[12] = absorbed
```

### DMG_EVENTS (per Skada Damage.lua)
`SPELL_DAMAGE`, `SWING_DAMAGE`, `RANGE_DAMAGE`, `SPELL_PERIODIC_DAMAGE`,  
`DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `SPELL_BUILDING_DAMAGE`

### HEAL_EVENTS (per Skada Healing.lua)
`SPELL_HEAL`, `SPELL_PERIODIC_HEAL` — that's it. SPELL_HEAL_ABSORBED is NOT tracked.

### Heal exclusions
None — `Tables.lua` has no `ignored_spells.heal`. Every SPELL_HEAL counts.

### KILL duration
Use **boss death timestamp** (`UNIT_DIED` on boss), not last event in segment.

---

## Architecture in One Paragraph

Browser uploads log → Next.js streams to Python parser (`/parse-stream`) → parser sends SSE progress events + final JSON result → Next.js batches DB writes (upsert players, create encounters + participants, compute milestones) → browser shows results.

---

## Key Files to Know

```
parser/parser_core.py     — all parsing logic
parser/bosses.py          — boss definitions + aliases
parser/main.py            — FastAPI endpoints
app/api/upload/route.ts   — upload handler + DB writes
lib/constants/bosses.ts   — boss list with sort order
prisma/schema.prisma      — DB schema
```

---

## Do Not Re-Invent

- `inferRole` — rough heuristic (heal/dmg ratio), not accurate, known debt
- `AccordionSection` — use this, not `SectionHeader`, for all data sections
- Upload status: set `DONE` **before** `computeMilestones`, not after
- Raids page: filter by `encounters: { some: {} }`, not `status: "DONE"`
