# Now

## Status
Parser healing field fix **DONE** — 61/61 tests green. Open issues remain.

---

## What Was Shipped This Session

| Change | File | Status |
|--------|------|--------|
| Use parts[11] (effective heal) not parts[10] (total) | `parser/parser_core.py` | ✅ |
| Update `_heal_parts` helper to `total`/`effective` semantics | `parser/tests/test_parser_core.py` | ✅ |
| 3 new TDD tests for effective heal behavior | `parser/tests/test_parser_core.py` | ✅ |
| CLAUDE.md: document SPELL_HEAL parts[11]=effective | `CLAUDE.md` | ✅ |

---

## Open Parser Issues (not yet fixed)

### Healing overcounting vs UWU (56-265% over on most bosses)
- Using parts[11] (effective heal) is correct per the log format
- But we're still ~56% over for Marrowgar, 265% over for Saurfang, etc.
- Likely cause: UWU may filter passive proc heals (Vampiric Embrace, Judgement of Light, ILotP) that we count
- Or: UWU may count only healing from "active healer" role abilities

### Blood-Queen healing undercounted (36% under UWU)
- "Essence of the Blood Queen" vampiric bite heals appear with **Blood-Queen as src GUID** (0xF1... non-player)
- Our `_is_player(src_guid)` filter drops them
- Need: count heals where `_is_player(dst_guid)` even if src is non-player (for fight mechanics)

### Lady Deathwhisper damage overcounted (35%)
- Our per-encounter damage counts ALL targets hit during the fight (boss + Adherents + Fanatics)
- UWU appears to count only damage to Lady Deathwhisper herself
- Difference: ~12.5M = add damage during phase 1
- Fix: only count eff_amount where dst_name/dst_guid == boss name/GUID (complex for multi-boss)

### S0 encounters missing (Sindragosa, BPC 10N)
- Not found at session_index=0
- Likely session assignment logic; needs investigation

### BPC damage slightly over (2%)
- Same add-damage issue (Kinetic Bombs, shadow orbs)

---

## Next Action

Investigate and fix the open issues above in priority order:
1. LDW damage (clear diagnosis: add damage inflation)
2. BQ healing (clear diagnosis: boss-sourced heals filtered out)
3. Session healing overcounting (less clear; may need UWU methodology insight)
4. S0 missing sessions
