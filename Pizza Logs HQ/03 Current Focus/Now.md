# Now

## Status
`dbb95db` pushed. Railway redeploying. Re-upload the April 19 Notlich Lordaeron log to verify delta is closed.

---

## Immediate Next Step
Re-upload the April 19 Notlich Lordaeron log and confirm:
- Session 2 (25H): ~407M ≈ UWU 407,718,447
- Session 1 (10H): ~200M ≈ UWU 200,402,269

---

## What Was Fixed This Session

| Fix | Commit | Impact |
|---|---|---|
| Overkill + P2P | 7868a17 | −13M |
| Gunship Cannons | 8a6e9ff | −4.46M |
| Full-session (boss+trash) | 9e0ae01 | +128M (was showing boss-only) |
| DAMAGE_SHIELD | 75ae523 | ~0.2M |
| TYPE_GUARDIAN (Mirror Images, Treants, AotD) | dbb95db | TBD — expected ~3-6M |

---

## Next Features
- Absorbs tracking (`SPELL_ABSORBED`)
- Player detail page (per-boss per-session for one player)
- Damage mitigation stats
