# Now

## Status
Healing formula fix **DONE** — 70/70 tests green.
Healing delta: was 14–228% OVER UWU → now ~21-28% UNDER UWU (consistent gap).

---

## What Was Shipped This Session

| Change | File | Status |
|--------|------|--------|
| Fix heal effective field: `parts[10] - parts[11]` (gross - overheal), not `parts[11]` | `parser/parser_core.py` | ✅ |
| Empty `PASSIVE_HEAL_EXCLUSIONS` — VE/JoL/ILotP now counted (correct per Skada) | `parser/parser_core.py` | ✅ |
| Fix `_heal_parts` test helper: parts[11]=overheal (not effective) | `parser/tests/test_parser_core.py` | ✅ |
| Update VE/JoL/ILotP tests: assert these ARE counted (60k/35k/23k not 50k/30k/20k) | `parser/tests/test_parser_core.py` | ✅ |
| Fix inline boss_mechanic_heal event: parts[11]=7431 (overheal), not 11550 | `parser/tests/test_parser_core.py` | ✅ |
| Vault updated | `Pizza Logs HQ/` | ✅ |

---

## Open Parser Issues (not yet fixed)

### Healing undercounting (~21-28% under on all bosses)
- Consistent gap across Marrowgar / Saurfang / BPC
- Likely cause: Discipline Priest Power Word: Shield absorbs
  (UWU counts them as healing done; we don't parse absorbed field from damage events)

### Blood-Queen healing undercounted (40% under)
- UWU: 58.78M, parser: ~35.2M — vampiric bite heals from boss mechanic missing

### LDW damage undercounted (7.17%)
- Low priority

### S0 BPC damage undercounted (21.29%)
- boss_guids may not capture all prince GUID forms in 10N segment

---

## Next Action

Priority order:
1. **Commit** the heal formula fix (parser_core + tests + vault)
2. **Re-run validate_uwu.py** to get exact new numbers
3. Investigate PW:S absorb approach to close ~25% heal gap
4. Fix BQ healing undercount

**Log file**: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
