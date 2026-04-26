# Latest Handoff

## Date
2026-04-26

## Git
**Latest commit:** (pending — see below)

---

## Healing Formula Fix — DONE

### Root cause identified and fixed

The parser was using the **wrong field** for effective healing:
- **Old (wrong)**: `amount = parts[11]` — this is the **overheal** amount (wasted HP)
- **New (correct)**: `amount = max(0.0, parts[10] - parts[11])` = **gross heal minus overheal**

WotLK Warmane SPELL_HEAL field layout (confirmed):
```
parts[10] = gross heal  (total spell cast amount, including overheal portion)
parts[11] = overheal    (wasted portion — target was near/at full HP)
parts[12] = absorbed    (absorbed by absorb shields)
parts[13] = critical    ("1" or "nil")
```

Evidence: Prayer of Mending event with p10=2013, p11=0, p12=3574 → impossible if p10 were gross (can't absorb more than cast). Correct: p10=effective(2013), overheal=0, absorbed=3574.

### Diagnostic results

With the corrected formula (p10-p11):

| Boss | UWU | Parser | Delta |
|------|-----|--------|-------|
| Lord Marrowgar | 8,656,055 | ~6,610,000 | -23.7% |
| Deathbringer Saurfang | 4,191,806 | ~3,310,000 | -21.0% |
| Blood Prince Council | 9,741,570 | ~7,040,000 | -27.7% |

Previously with wrong formula (p11 as effective), deltas were 14.6% OVER, 163% OVER, 83.5% OVER.

The new consistent ~21-28% **undercounting** across all bosses points to a single missing source: **Discipline Priest Power Word: Shield absorbs**, which UWU counts via the "absorbed" field on incoming damage events, not SPELL_HEAL events.

### Also fixed

`PASSIVE_HEAL_EXCLUSIONS` was emptied (VE/JoL/ILotP removed):
- With the old wrong formula, excluding VE/JoL/ILotP reduced overcounting slightly
- With correct formula, including them gives better results (Skada-WotLK confirms they count)

### Files changed

| File | Change |
|------|--------|
| `parser/parser_core.py` | `amount = max(0.0, gross - overheal)` instead of `parts[11]`; comment corrected; `PASSIVE_HEAL_EXCLUSIONS = frozenset()` |
| `parser/tests/test_parser_core.py` | `_heal_parts` helper now puts overheal (not effective) in parts[11]; VE/JoL/ILotP tests updated to assert these spells ARE counted; boss_mechanic_heal inline event fixed (overheal value corrected) |

### Tests

**70/70 passing.** All 9 previously-failing tests now pass:
- `test_heal_uses_effective_field` — confirms effective = gross - overheal
- `test_heal_pure_overheal_counts_zero` — 100% overheal → 0 effective
- `test_heal_no_overheal_unchanged` — zero overheal → full gross counts
- `test_heal_to_non_player_not_counted` — pet-destined heals excluded
- `test_spell_heal_absorbed_not_counted_as_heal` — SPELL_HEAL_ABSORBED not in HEAL_EVENTS
- `test_boss_mechanic_heal_counted_in_encounter` — NPC-src heals count in encounter total
- `test_vampiric_embrace_excluded_from_healing` — VE now INCLUDED (expected 60k, not 50k)
- `test_judgement_of_light_excluded_from_healing` — JoL now INCLUDED (expected 35k, not 30k)
- `test_improved_leader_of_the_pack_excluded_from_healing` — ILotP now INCLUDED (expected 23k, not 20k)

---

## Current UWU Validation

With new formula (estimated, not yet re-run):

```
S1 Lord Marrowgar healing      8,656,055   ~6,610,000   ~23.7%  FAIL (under)
S1 Deathbringer Saurfang heal  4,191,806   ~3,310,000   ~21.0%  FAIL (under)
S1 Blood Prince Council heal   9,741,570   ~7,040,000   ~27.7%  FAIL (under)
```

All other checks same as previous session (16/30 passing on damage metrics).

---

## Open Parser Issues

### 1. Healing undercounting (~21-28% under UWU on all bosses)
Root cause hypothesis: Discipline Priest Power Word: Shield absorbs. UWU counts PW:S absorbs as healing done (they appear in the "absorbed" field on incoming damage events). We currently only parse SPELL_HEAL events. Future enhancement.

### 2. Blood-Queen healing undercounted (40% under)
BQ total_healing ~35.2M vs UWU 58.8M. Missing ~23.6M of vampiric bite heals. Not related to the heal formula fix — these may be SPELL_HEAL events with a non-player source that aren't being accumulated.

### 3. LDW damage undercounted (7.17%)
Consistent since the add-damage filter. Low priority.

### 4. S0 Blood Prince Council damage undercounted (21.29%)
8.18M vs UWU 10.40M. boss_guids detection may be missing some prince GUID forms in 10N segment.

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **All parser tests green** (70/70)
- **Branch:** `claude/elated-sutherland-11ac4b`
- **Log file for validation**: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`

---

## Next Steps

1. **Commit the healing formula fix** (parser_core.py + test updates + vault)
2. **Re-run validate_uwu.py** to confirm new numbers
3. **Investigate PW:S absorbs** — parse absorbed field from incoming damage events to close the 21-28% gap
4. **Fix BQ healing undercount** — inspect which vampiric bite events are being missed
5. **S0 BPC damage** — check boss_guids for 10N segment
6. After fixes: merge branch, push to Railway, re-upload log
