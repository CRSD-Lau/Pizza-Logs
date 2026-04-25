# Now

## Status
Leaderboards & Players redesign **DONE** — branch ready to merge.

---

## What Was Shipped This Session

| Change | File | Status |
|--------|------|--------|
| Milestone cap to top 3 | `lib/actions/milestones.ts` | ✅ |
| Leaderboards nav link | `components/layout/Nav.tsx` | ✅ |
| Home page leaderboards teaser | `app/page.tsx` | ✅ |
| New /leaderboards page | `app/leaderboards/page.tsx` | ✅ |
| Players class stats panel | `app/players/page.tsx` | ✅ |

---

## Immediate Next Action

1. Merge `claude/elated-sutherland-11ac4b` to `main`
2. Push — Railway auto-deploys
3. Re-upload `WoWCombatLog.txt` to verify live HPS numbers match UWU

---

## Next Features (Backlog)

- Absorbs tracking (`SPELL_ABSORBED`) — shield absorption stats
- Player detail page (per-boss per-session breakdown)
- Damage mitigation stats (`SPELL_MISSED` subtypes)
