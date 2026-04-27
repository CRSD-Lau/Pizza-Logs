# Now

## Status
Repo clean. Main only. Railway deployed. 71/71 tests passing.

---

## Next Up

| Task | Type | Notes |
|------|------|-------|
| Fix Hardcore vs Normal detection | BUG | Regression — difficulty not distinguishing correctly |
| Stats / Analytics page | FEATURE | Class comparisons, raid comparisons, all-time trends, graphs |
| Verify Skada numbers in-game | VERIFY | Neil to do manually — deferred to next week |
| Absorbs (PW:S) | FEATURE | Decision: combined Healing+Absorbs column. Do after verification. |

---

## Hardcore vs Normal Bug
Parser not correctly distinguishing Hardcore from Normal difficulty.
- Investigate what signal the log provides (player flags, damage values, NPC IDs?)
- Fix parser difficulty assignment and add tests

---

## Stats / Analytics Page
New `/stats` page — full brainstorm needed before implementation.
Confirmed scope ideas:
- Class performance comparisons (avg DPS/HPS by class)
- Raid comparisons (instance vs instance, week over week)
- All-time records and progression trends
- Multiple graph types using Recharts

---

## Absorbs Decision (logged)
When implemented: **combined Healing+Absorbs column**, not separate.
Reason: simpler UI, matches Skada's combined view that players reference.

---

## Reference
- Skada source: https://github.com/bkader/Skada-WoTLK
- Log file: `C:/Users/neil_/OneDrive/Desktop/PizzaLogs/WoWCombatLog/WoWCombatLog.txt`
- Live app: https://pizza-logs-production.up.railway.app
