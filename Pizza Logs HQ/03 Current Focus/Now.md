# Now

## Status
Skada-WoTLK alignment **DONE** — merged to main, Railway deploying.
Parser replicates Skada exactly: DMG_EVENTS, HEAL_EVENTS, heal formula, no spell exclusions.
71/71 tests passing.

---

## Verify the Deploy

1. Wait for Railway build (~3-5 min after push)
2. Upload a log at https://pizza-logs-production.up.railway.app
3. Compare DPS to Skada in-game for the same fight — should match

---

## Quick Wins (next up)

| Task | Effort | Why |
|------|--------|-----|
| Fix footer text | 5 min | Says "client-side" — it's server-side |
| Add admin auth | 30 min | `/admin` is publicly accessible |

---

## Open Parser Work

### HPS gap (~21-28% under Skada)
Cause: Power Word: Shield absorbs. Skada counts in `Absorbs.lua` as `actor.absorb`.
We only parse SPELL_HEAL events — absorbs appear in incoming damage event `absorbed` fields.

Decision needed: heal-only column vs heal+absorbs column?

Implementation:
1. `SPELL_AURA_APPLIED` → detect PW:S, record capacity + caster
2. `absorbed` field on damage events → attribute to Disc priest
3. Add `total_absorbs` to ParsedEncounter, expose in API + UI

---

## Reference
- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
