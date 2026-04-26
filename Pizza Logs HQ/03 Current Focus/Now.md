# Now

## Status
S0 difficulty detection fix **DONE** — 70/70 tests green, 16/30 UWU checks passing.

---

## What Was Shipped This Session

| Change | File | Status |
|--------|------|--------|
| Remove wrong heroic markers: `backlash` (Sindragosa), `empowered shock vortex/shadow lance/blood` (BPC) | `parser/parser_core.py` | ✅ |
| Extend `_normalize_session_difficulty` to promote 25N→25H in confirmed heroic sessions | `parser/parser_core.py` | ✅ |
| TDD tests: Sindragosa 10N backlash stays 10N, BPC 10N empowered spell stays 10N, 25N Sindragosa in 25H session promoted | `parser/tests/test_parser_core.py` | ✅ |
| Update existing normalize test: 25N in 25H session now correctly promoted to 25H | `parser/tests/test_parser_core.py` | ✅ |
| Update UWU reference: LDW difficulty 25N → 25H | `parser/tests/validate_uwu.py` | ✅ |
| VE/JoL/ILotP healing exclusion (prev session) | `parser/parser_core.py` | ✅ |

---

## Open Parser Issues (not yet fixed)

### Healing overcounting (14–228% over UWU on S1 bosses)
- Marrowgar: 14.57% over (was 55% before VE/JoL/ILotP exclusion — improved)
- Saurfang, BPC: still massively over
- Root cause: additional passive/proc heals that UWU excludes, unknown which

### Blood-Queen healing undercounted (40% under)
- UWU: 58.78M, parser: ~35.2M — missing ~23.6M
- Vampiric bite heals from boss mechanic not fully captured

### LDW damage undercounted (7.17%)
- Low priority — unclear without UWU's exact add-filter methodology

### S0 BPC damage undercounted (21.29%)
- Was MISSING before this session; now found at 10N
- 8.18M vs UWU 10.40M — boss_guids may not capture all prince GUID forms in 10N

---

## Next Action

Priority order:
1. Investigate healing overcounting — what other spells does UWU exclude beyond VE/JoL/ILotP?
2. Fix BQ healing undercount — inspect which vampiric bite events are being missed
3. Fix S0 BPC damage undercount — check boss_guids for 10N segment

**Log file**: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
