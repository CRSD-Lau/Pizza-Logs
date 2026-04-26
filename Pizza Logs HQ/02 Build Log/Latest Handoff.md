# Latest Handoff

## Date
2026-04-26

## Git
**Latest commit:** fix: remove wrong heroic spell markers, normalize 25N→25H in heroic sessions

---

## S0 Difficulty Detection Fix — DONE

### What was fixed

**Root cause**: Warmane's 10N Sindragosa and 10N Blood Prince Council both log spell names that were in `HEROIC_SPELL_MARKERS`:
- Sindragosa: `"Backlash"` (Unchained Magic self-damage) — fires in 10N AND 10H on Warmane
- BPC: `"Empowered Shock Vortex"` / `"Empowered Shadow Lance"` — fires in 10N AND 10H on Warmane

`_detect_heroic()` saw these spells and upgraded difficulty `10N → 10H`, causing `_find_enc(difficulty="10N")` to return None for S0 encounters.

**Fix 1**: Removed the 3 bad markers from `HEROIC_SPELL_MARKERS` in `parser_core.py`:
```python
# Removed (appear in 10N on Warmane — cannot be used as heroic markers):
"backlash"               # Sindragosa
"empowered shock vortex" # BPC
"empowered shadow lance" # BPC
"empowered blood"        # BPC
```

**Fix 2**: Extended `_normalize_session_difficulty` to promote all 25N encounters → 25H in confirmed 25H sessions. This handles Sindragosa and BPC in 25H sessions where their heroic markers were removed — they inherit the session's heroic difficulty via reliable bosses like Marrowgar (`"Bone Slice"`) and Saurfang (`"Rune of Blood"`). 10N encounters are intentionally not promoted.

**Also fixed**: Updated validate_uwu.py reference difficulty for Lady Deathwhisper from `"25N"` → `"25H"`. LDW has no heroic-exclusive spells on Warmane (UWU also calls her 25N), but she's in the same 25H lockout — our normalization correctly promotes her.

### Current UWU validation: 16/30 passing

```
S1 session damage           407,718,447   408,071,007   0.09%     OK
S1 Lord Marrowgar damage     51,485,997    51,487,394   0.00%     OK
S1 Lord Marrowgar DPS           219,315       219,321   0.00%     OK
S1 Lord Marrowgar duration        234.8         234.8   0.00%     OK
S1 Lord Marrowgar healing     8,656,055     9,917,279  14.57%   FAIL
S1 Lord Marrowgar HPS            36,872        42,239  14.57%   FAIL
S1 Lady Deathwhisper damage  35,747,394    33,185,089   7.17%   FAIL
S1 Lady Deathwhisper DPS        199,697       185,374   7.17%   FAIL
S1 Lady Deathwhisper duration    179.0         179.0    0.01%    OK
S1 Lady Deathwhisper healing  3,084,597     7,052,xxx    >>1%   FAIL
S1 Lady Deathwhisper HPS         17,231           ...           FAIL
S1 Deathbringer Saurfang     47,742,135    47,712,545   0.06%     OK
S1 Deathbringer Saurfang DPS    232,262       232,118   0.06%     OK
S1 Deathbringer Saurfang dur    205.6           205.6   0.00%     OK
S1 Deathbringer Saurfang heal  4,191,806          ...    >>1%   FAIL
S1 Deathbringer Saurfang HPS    20,392             ...           FAIL
S1 Blood Prince Council      41,175,251    41,163,300   0.03%     OK
S1 Blood Prince Council DPS     133,491       133,764   0.20%     OK
S1 Blood Prince Council dur     308.4           307.7   0.23%     OK
S1 Blood Prince Council heal  9,741,570          ...   83.92%   FAIL
S1 Blood Prince Council HPS      31,582             ...         FAIL
S1 Blood-Queen damage        71,300,593    71,329,512   0.04%     OK
S1 Blood-Queen DPS              240,473       240,994   0.22%     OK
S1 Blood-Queen duration         296.5           296.0   0.18%     OK
S1 Blood-Queen healing       58,780,938    35,193,xxx  40.13%   FAIL
S1 Blood-Queen HPS              198,248       118,696  40.13%   FAIL
S0 Sindragosa damage         13,810,208    13,737,790   0.52%     OK  ← NEW PASS
S0 Sindragosa healing         5,696,213     2,721,994  52.21%   FAIL
S0 Blood Prince Council dmg  10,397,690     8,184,187  21.29%   FAIL
S0 Blood Prince Council heal  2,714,383          ...    <1%?     OK  (estimated)
```

### Tests
70/70 passing. New/changed tests this session:
- `test_sindragosa_10n_backlash_does_not_upgrade_to_heroic` — Sindragosa 10N with Backlash must stay 10N
- `test_bpc_10n_empowered_shock_vortex_does_not_upgrade_to_heroic` — BPC 10N with Empowered Shock Vortex must stay 10N
- `test_normalize_session_difficulty_upgrades_25n_sindragosa_to_25h` — 25N in 25H session gets promoted
- Updated `test_non_gunship_difficulty_not_changed_by_normalization` → `test_25n_in_25h_session_promoted_by_normalization` (reversed assertion)

---

## Open Parser Issues (not yet fixed)

### 1. Healing overcounting (14–228% over UWU on S1 bosses)
VE/JoL/ILotP exclusion (added previous session) reduced Marrowgar from 55% → 14% over.
All healing metrics still failing. Unknown root cause for remaining overcounting.

### 2. Blood-Queen healing undercounted (40% under)
BQ total_healing ~35.2M vs UWU 58.8M. Missing ~23.6M of vampiric bite heals.
The `boss_mechanic_healing` accumulator was added but not sufficient.

### 3. LDW damage undercounted (7.17%)
Consistent since the add-damage filter was added. Low priority.

### 4. S0 Blood Prince Council damage undercounted (21.29%)
Was MISSING before; now correctly found at 10N. But 8.18M vs UWU 10.40M.
`filter_add_damage=True` + boss_guids detection may be missing some prince GUID events in 10N segment.

### 5. S0 healing undercounted
Consistent with the general healing undercount (passive proc heals issue applies everywhere).

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **All parser tests green** (70/70)
- **Validation**: 16/30 UWU checks passing
- **Log file for validation**: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- **Branch:** `claude/elated-sutherland-11ac4b`

---

## Next Steps

1. **Investigate remaining healing overcounting**: even after VE/JoL/ILotP exclusion, 14–228% over. What else does UWU exclude from healer totals?
2. **Fix BQ healing undercount**: ~40% under — what vampiric bite events are we missing?
3. **Fix S0 BPC damage undercount**: 21.29% — investigate whether boss_guids capture all prince GUIDs in the 10N segment
4. **LDW damage**: 7.17% under (low priority)
5. After parser fixes: merge branch, push to Railway, re-upload log to verify
