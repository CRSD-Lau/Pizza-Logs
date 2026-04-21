# Now

## Active
Pushed a28ae3b — awaiting Railway redeploy for Gunship difficulty fix.

---

## Work Completed This Session

### TDD suite + Gunship difficulty normalization + aggregate filter

#### _normalize_session_difficulty
- Gunship gets 25N from Warmane even on heroic; now infers difficulty from other session encounters
- Only Gunship is touched — other bosses with unusual difficulty are left alone

#### DMG_EVENTS guard in _aggregate_segment
- Defence-in-depth: DAMAGE_SHIELD / SPELL_BUILDING_DAMAGE now blocked inside aggregate even without pre-filter
- Revealed by TDD tests (was a latent bug)

#### 26 TDD tests (all green)
- `parser/tests/test_parser_core.py`
- Covers difficulty decoding, player detection, Gunship kill/wipe, normalization, damage exclusion

---

## Immediate Next Steps

1. Wait for Railway parser-py redeploy
2. Clear DB → re-upload same log (2026-04-19 Notlich Lordaeron)
3. Verify: Gunship = 25H KILL
4. Investigate 13M delta — run `diagnose.py` locally to get per-encounter totals

---

## Blockers

### 🔴 13M damage delta vs UWU (unresolved)
- Our total ~289M vs UWU 276,045,348
- DAMAGE_SHIELD and SPELL_BUILDING_DAMAGE were not the source
- Need per-encounter comparison — run `diagnose.py` or fetch UWU per-boss pages

### 🟡 Persistent Pets
- Hunter beasts / Warlock demons pre-summoned → no SPELL_SUMMON → orphaned
- May partially explain residual delta

---

## Not Working On
- UI redesigns
- Non-ICC content
- Absorbs tracking (backlog)
