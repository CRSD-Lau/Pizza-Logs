# Latest Handoff

## Date
2026-04-26

## Git
**Branch:** `main` (clean — only branch)
**Latest commit:** `2935c91` docs: update project structure in README
**Release:** `v0.1.0` — tagged and published on GitHub

---

## What Was Done This Session

### 1. Repo cleanup
- Committed all staged vault changes from previous session
- Hardened `.gitignore` (tsconfig.tsbuildinfo, WoWCombatLog/, parser/diag_*.py, .claude/worktrees/)
- Fixed remote URL redirect (pizza-logs → Pizza-Logs)
- Deleted all stale Claude worktree branches — only `main` remains

### 2. README rewritten
- Correct deployment (Railway), architecture (no ENCOUNTER_START/END)
- Skada-WoTLK parser philosophy documented
- All current routes listed
- Project structure updated to match actual files

### 3. Wiki published (6 pages)
- Home, Project Vision, Current Status, How to Upload, Understanding Your Stats, Roadmap, Technical Overview
- Live at https://github.com/CRSD-Lau/Pizza-Logs/wiki

### 4. SECURITY.md added
- Scope, admin secret note, how to report vulnerabilities, private advisory link

### 5. v0.1.0 — First Release
- Git tag pushed, GitHub Release published manually
- Full release notes covering all shipped features and known limitations

### 6. GitHub Issue opened
- `bug: Normal vs Hardcore difficulty not correctly detected`
- https://github.com/CRSD-Lau/Pizza-Logs/issues

### 7. Decisions logged
- Absorbs: combined Healing+Absorbs column when implemented (not separate)
- Skada number verification deferred to next week (manual in-game check)

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Release**: v0.1.0
- **Tests**: 71/71 passing
- **Git**: main only, clean, remote URL corrected
- **HPS gap**: ~21-28% under Skada for Disc priests — expected (PW:S absorbs not implemented)
- **DPS**: <1% residual from orphaned pets — accepted

---

## Open Items (priority order)

### 1. BUG: Hardcore vs Normal difficulty detection regression
Tracked in: https://github.com/CRSD-Lau/Pizza-Logs/issues
- Identify what signal in the Warmane log distinguishes Normal from Hardcore
- Fix difficulty assignment in `parser/parser_core.py`
- Add regression tests

### 2. Stats / Analytics page
New `/stats` page — brainstorm session needed before any code.
Confirmed scope:
- Class performance comparisons (avg DPS/HPS by class)
- Raid comparisons (instance vs instance, week over week)
- All-time records and progression trends
- Multiple graph types using Recharts

### 3. Verify Skada numbers in-game
Neil to upload a log and compare DPS/HPS to in-game Skada for the same fight.
Deferred to next week.

### 4. Absorbs — Power Word: Shield
Decision: **combined Healing+Absorbs column** (not separate).
Do after Skada verification.
1. Parse `SPELL_AURA_APPLIED` for PW:S — store capacity + caster
2. Parse `absorbed` field on damage events — attribute to Disc priest
3. Merge into HPS column in API + UI

---

## Next Steps (priority order)

1. Fix HC/Normal detection regression
2. Brainstorm + design Stats/Analytics page
3. Verify Skada numbers in-game (next week)
4. Implement absorbs
