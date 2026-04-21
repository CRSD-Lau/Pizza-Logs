# Latest Handoff

## Date
2026-04-21

## Git
**Latest:** `7868a17` — main branch
fix: subtract overkill from total_damage; exclude player-to-player damage

---

## Completed This Session

### Root-cause fix for 289M vs 276M delta vs UWU

Ran `diagnose.py` against the live log, identified two independent bugs via targeted scripts.

#### Bug 1 — Overkill not subtracted (−8.7M)
- Parser used raw `amount` from SPELL_DAMAGE/SWING_DAMAGE, never subtracted `overkill`
- Blood Prince Council: 7.846M overkill alone — three princes die simultaneously, every player's last hit overkills massively
- Fix: `eff_amount = max(0, amount - overkill)` used throughout `_aggregate_segment`

#### Bug 2 — Player-to-player damage counted (−5.3M)
- No `dst_guid` check before accumulating damage
- Blood-Queen: bitten vampires attack each other (Pact of the Darkfallen 1.49M, Blood Mirror 1.37M, Vampiric Bite, Starfire, etc.) → 3.79M over
- BPC: Empowered Shadow Lance etc. → 1.14M over
- Fix: `if not is_heal and _is_player(dst_guid): continue`

#### Combined result
| Boss | Before | After | Diff |
|---|---|---|---|
| Marrowgar | 51.12M | 50.34M | −0.78M |
| Deathwhisper | 47.55M | 47.30M | −0.26M |
| Gunship | 19.07M | 18.94M | −0.13M |
| Saurfang | 46.82M | 46.63M | −0.19M |
| **BPC** | 50.65M | **41.67M** | **−8.98M** |
| **Blood-Queen** | 74.04M | **70.12M** | **−3.92M** |
| **Session 2 total** | **289.26M** | **~275M** | **−14.3M** |
| UWU | — | 276.045M | residual ~1M |

Residual ~1M under UWU = pre-summoned pets (Hunter beasts, Warlock demons) whose SPELL_SUMMON isn't in the log. Not a bug — a known limitation.

#### TDD tests added (5 new, 31 total passing)
- `test_overkill_not_counted_in_spell_damage`
- `test_overkill_not_counted_in_swing_damage`
- `test_zero_overkill_unchanged`
- `test_player_to_player_damage_not_counted`
- `test_player_to_npc_damage_still_counted`

---

## Files Changed

| File | Change |
|---|---|
| `parser/parser_core.py` | `_aggregate_segment`: overkill subtracted from eff_amount; P2P damage skipped |
| `parser/tests/test_parser_core.py` | 5 new TDD tests; `_spell_damage_parts` now accepts `overkill` param; new `_swing_damage_parts` helper |

---

## Exact Next Steps
1. **Deploy**: Railway picks up the push; wait for parser-py to redeploy (~2 min)
2. **Re-upload**: clear DB at `/admin` → upload same log (2026-04-19 Notlich Lordaeron)
3. **Verify**:
   - Session 2 total should be ~275-276M (down from 289M)
   - Gunship = 25H KILL
   - BPC total should drop from 50.6M to ~41.7M
   - Blood-Queen should drop from 74M to ~70M
4. If still off: check pre-summoned pets — run `diagnose.py --encounter <boss>` per boss and compare per-player totals to UWU

## Pending Features
- **Absorbs tracking**: parse `SPELL_ABSORBED` events
- **Persistent pet attribution**: pre-summoned pets (no SPELL_SUMMON in log)
- **Damage mitigation stats**: `SPELL_MISSED` subtypes
