# Latest Handoff

## Date
2026-04-26

## Git
**Branch:** `main` (merged + pushed — Railway deploy triggered)
**Latest commit:** `3b58613` merge: align parser 100% with Skada-WoTLK source

---

## What Was Done This Session

### 1. Heal formula fixed
- `effective = max(0, parts[10] - parts[11])` — gross heal minus overheal
- Was using `parts[11]` directly (the overheal amount), causing 14-228% overcounting
- Confirmed via Skada `Healing.lua`: `local amount = max(0, heal.amount - heal.overheal)`

### 2. Parser philosophy switched to Skada-first
- Skada-WoTLK is now the sole reference (https://github.com/bkader/Skada-WoTLK)
- Not UWU — no source code available, not the player-facing reference
- CLAUDE.md, vault, all comments updated to cite Skada files

### 3. DMG_EVENTS aligned with Skada Damage.lua RegisterForCL
Added: `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, `SPELL_BUILDING_DAMAGE`
Previously excluded based on UWU assumptions; Skada explicitly registers all three.

### 4. PASSIVE_HEAL_EXCLUSIONS emptied
- `Tables.lua` has no `ignored_spells.heal` table
- JoL line in Tables.lua is commented out = not excluded
- All SPELL_HEAL / SPELL_PERIODIC_HEAL events count

### 5. Tests: 71/71 passing

### 6. Full project review and cleanup
- Stale UWU parity docs deleted (docs/superpowers/)
- GuildLogs_PoC.html removed
- All vault files updated for accuracy
- Known Issues, Feature Status, Technical Debt, Decision Log, What Claude Forgets all current

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **Deploy**: Pushed to main — Railway building now
- **Tests**: 71/71 passing
- **HPS gap**: ~21-28% under Skada — expected (PW:S absorbs not yet implemented)
- **DPS**: <1% residual from orphaned pets — accepted

---

## Open Items

### HPS gap — Power Word: Shield absorbs
Skada tracks absorbs in `Absorbs.lua` as `actor.absorb` (separate from `actor.heal`).
We only parse `SPELL_HEAL` events. To close the ~25% gap:
1. Parse `SPELL_AURA_APPLIED` for PW:S spell IDs — store shield capacity per caster
2. Parse `absorbed` field on incoming damage events — attribute consumed absorb to Disc priest

Decision needed: heal-only column (Skada Healing module) or heal+absorbs column (Skada combined view)?

### Footer text bug
Footer says "All parsing done client-side" — wrong, it's server-side. Fix: update footer component.

### Admin page has no auth
`/admin` is publicly accessible. Fix: env-var cookie check in middleware.

---

## Next Steps (priority order)

1. Upload a log and verify numbers match Skada in-game
2. Fix footer text (5 min)
3. Add admin auth (30 min)
4. Decide absorbs strategy — heal-only or heal+absorbs column?
5. If absorbs: implement Absorbs.lua-style tracking
