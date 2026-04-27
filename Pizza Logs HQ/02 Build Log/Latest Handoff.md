# Latest Handoff

## Date
2026-04-26

## Git
**Branch:** `main` (clean — only branch)
**Latest commit:** `93392fd` docs: remove stale quick-win tasks

---

## What Was Done This Session

### 1. Cleanup commit pushed to main
- Staged vault changes from previous session committed
- Deleted stale UWU parity docs, validate_uwu.py
- Added parser/tests/__init__.py
- Updated all vault files

### 2. .gitignore hardened
- `tsconfig.tsbuildinfo`, `WoWCombatLog/`, `parser/diag_*.py`, `.claude/worktrees/`

### 3. README rewritten
- Correct deployment (Railway), architecture (no ENCOUNTER_START/END), Skada parser note, all current routes

### 4. Branch cleanup
- All stale Claude worktree branches deleted — only `main` remains

### 5. Decisions logged
- Absorbs: will be combined Healing+Absorbs column when implemented (not separate)
- Skada number verification deferred to next week (manual in-game check)

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Tests**: 71/71 passing
- **Git**: main only, clean
- **HPS gap**: ~21-28% under Skada — expected (PW:S absorbs not implemented)
- **DPS**: <1% residual from orphaned pets — accepted

---

## Open Items (priority order)

### 1. BUG: Difficulty detection regression — Hardcore vs Normal not distinguishing
Parser is not correctly detecting Hardcore vs Normal difficulty. Needs investigation.
- Check what signal in the log distinguishes them (player flag? damage scaling? NPC IDs?)
- Fix parser difficulty assignment
- Add tests

### 2. Stats / Analytics page
Big new feature: a dedicated `/stats` page with as much analytics as we can surface.
Ideas confirmed by Neil:
- Class performance comparisons (avg DPS/HPS by class across all logs)
- Raid comparisons (instance vs instance, week over week)
- All-time records and trends (top parses over time, progression charts)
- Various graphs — Recharts, same chart library already in use

Scope to be designed before implementation (brainstorm session).

### 3. Absorbs — Power Word: Shield
Decision made: **combined Healing+Absorbs column** (not separate).
Implementation:
1. Parse `SPELL_AURA_APPLIED` for PW:S spell IDs — store shield capacity + caster
2. Parse `absorbed` field on incoming damage events — attribute to Disc priest
3. Add `total_absorbs` to ParsedEncounter, merge into HPS column in API + UI

### 4. Verify Skada numbers in-game
Upload a log and compare DPS/HPS to Skada addon numbers for the same fight.
Deferred to next week (Neil to do manually).

---

## Next Steps (priority order)

1. Fix Hardcore vs Normal detection regression
2. Brainstorm + design Stats/Analytics page
3. Verify Skada numbers in-game (next week)
4. Implement absorbs (after verification)
