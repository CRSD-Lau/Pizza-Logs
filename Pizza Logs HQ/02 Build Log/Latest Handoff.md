# Latest Handoff

## Date
2026-04-25

## Git
**Latest commit:** TBD (pending commit of this session's work)

---

## Healing Field Fix — DONE

### What was fixed
`parser/parser_core.py` — SPELL_HEAL now reads `parts[11]` (effective heal) instead of `parts[10]` (total heal before overheal).

**WotLK log format confirmed from actual log data:**
- `parts[10]` = total heal (before overheal deduction)
- `parts[11]` = effective heal (what actually restored HP; 0 = 100% overheal)

Evidence from log samples:
- `728,0` → 0 effective (target at full HP, all wasted)
- `1225,738` → 738 effective (487 wasted to overheal)
- `2379,2379` → 2379 effective (no overheal)

### What was NOT fixed (open issues)

#### 1. Healing overcounting (56-265% over UWU on most bosses)
Using parts[11] is correct field parsing, but we're still significantly over UWU.
Suspected cause: UWU may filter passive proc heals (Vampiric Embrace, JoL, ILotP, Beacon of Light, set bonus procs).
No single formula maps our counts to UWU counts across all bosses.

#### 2. Blood-Queen healing undercounted (36% under UWU)
Root cause identified: "Essence of the Blood Queen" vampiric bite heals are logged with Blood-Queen herself as the source GUID (0xF1... non-player). Our `_is_player(src_guid)` filter drops them.
Fix: when `is_heal=True` and `_is_player(dst_guid)`, count the heal even if src is non-player.

#### 3. Lady Deathwhisper damage overcounted (35%)
Root cause identified: our per-encounter damage counts ALL targets (boss + adds). LDW phase 1 has Adherents/Fanatics worth ~12.5M damage. UWU appears to count only boss-directed damage.
Fix: for per-encounter damage, only accumulate eff_amount where dst is the boss GUID. (Complex for multi-boss fights like BPC.)

#### 4. S0 missing encounters (Sindragosa, BPC 10N)
Sindragosa (10N) KILL and BPC (10N) KILL are not found at session_index=0. Session assignment bug.

#### 5. BPC damage slightly over (2%)
Same add-damage issue (Kinetic Bombs, shadow orbs) — minor.

### Tests
61/61 tests passing. New tests added:
- `test_heal_uses_effective_field` — verifies parts[11] is used, not parts[10]
- `test_heal_pure_overheal_counts_zero` — verifies effective=0 events are filtered
- `test_heal_no_overheal_unchanged` — verifies default (no overheal) still counts full amount

---

## Current State

- **Live app**: https://pizza-logs-production.up.railway.app
- **All parser tests green** (61/61)
- **Validation**: 12/26 UWU checks passing (damage metrics all green, healing metrics all failing)
- **Branch:** `claude/elated-sutherland-11ac4b`

---

## Next Steps

1. **Fix BQ healing undercount**: include N→P heals (boss-sourced) when dst is player
2. **Fix LDW damage**: filter per-encounter eff_amount to only count boss-targeted hits
3. **Investigate healing overcounting**: determine which passive procs UWU excludes
4. **Fix S0 missing sessions**: check session index assignment logic
5. After parser fixes: merge branch, push to Railway, re-upload log to verify
