# Latest Handoff

## Date
2026-04-24

## Git
**Latest:** `dbb95db` — main branch
fix: include TYPE_GUARDIAN in session_damage accumulator (Mirror Images, Treants, AotD)

---

## What Was Done

### Verified production state
- DB schema was already in sync (`sessionDamage Json?` column exists) — Railway's `start.sh`
  runs `prisma db push` on every deploy, so commit `75ae523` already applied the migration
- Parser-py service is up and reachable from Web Service
- Most recent upload (parsedAt 2026-04-24T13:00:58Z) shows `sessionDamage` populated

### Gap analysis after DAMAGE_SHIELD fix
After `75ae523` deployed, the real numbers were:
| Session | Our value | UWU | Delta | % |
|---|---|---|---|---|
| Session 1 (10H, idx 0) | 193,815,908 | 200,402,269 | −6,586,361 | −3.29% |
| Session 2 (25H, idx 1) | 404,126,721 | 407,718,447 | −3,591,726 | −0.88% |

DAMAGE_SHIELD only contributed ~0.2M — the main gap was elsewhere.

### Root cause of remaining gap — TYPE_GUARDIAN (dbb95db)

**Problem:** The full-session accumulator used `(flags & 0x1100) == 0x1100` which required
both TYPE_PET (0x1000) and CONTROL_PLAYER (0x0100) to be set.

This **missed all TYPE_GUARDIAN (0x2000) units**, which are player-controlled but classified
as guardians rather than pets. These include:
- **Mirror Images** (Mage) — 3 images casting Frostbolt for ~30s
- **Force of Nature Treants** (Druid Balance talent) — 3 treants dealing melee/Nature damage
- **Army of the Dead ghouls** (Death Knight) — 8 ghouls for 40s
- **Shadowfiend** (Priest) — sustained melee DPS pet ← actually TYPE_PET, was already counted
- **Shaman elementals / Fire totems** — Magma Totem, Searing Totem if TYPE_GUARDIAN

Guardian unit flags example: `0x2124` = TYPE_GUARDIAN (0x2000) | CONTROL_PLAYER (0x0100)
| FRIENDLY (0x0020) | RAID (0x0004)

**Fix** (`parser/parser_core.py` line ~448):
```python
# Before:
is_pet = (int(src_flags, 16) & 0x1100) == 0x1100

# After:
flags = int(src_flags, 16)
is_pet = bool(flags & 0x0100) and bool(flags & 0x3000)
# 0x3000 = TYPE_PET (0x1000) | TYPE_GUARDIAN (0x2000)
# 0x0100 = CONTROL_PLAYER
```

**44 TDD tests passing.**

---

## Full Commit History This Session

| Commit | Fix |
|---|---|
| 7868a17 | Overkill subtracted, P2P excluded (−13M from session totals) |
| 8a6e9ff | Interaction scan restricted to 0xF14* heal events (Gunship Cannons fixed) |
| 9e0ae01 | Full-session damage (boss+trash) added — session header matches UWU |
| 75ae523 | DAMAGE_SHIELD added to full-session accumulator |
| dbb95db | TYPE_GUARDIAN added — Mirror Images, Treants, AotD ghouls now counted |

---

## Expected Results After Re-Upload

| Session | Expected | UWU |
|---|---|---|
| Session 2 (25H) | ~407M | 407,718,447 |
| Session 1 (10H) | ~200M | 200,402,269 |

Deploy to Railway in progress. Re-upload the April 19 Notlich Lordaeron log to verify.

---

## If Still Off

After guardians are added, any remaining gap would be:
1. **SPELL_BUILDING_DAMAGE** from vehicles (Gunship Cannons, Flame Leviathan) — we exclude,
   UWU may also exclude. If UWU counts these, add SPELL_BUILDING_DAMAGE too.
2. **Pre-summoned pets not found via interaction scan** — pets that neither have SPELL_SUMMON
   nor ever receive a player heal. Should be very rare in practice.
3. Float/rounding differences — sub-0.1% is acceptable noise.

## Next Features (when ready)
- **Absorbs tracking**: parse `SPELL_ABSORBED` events
- **Player detail page**: per-boss breakdown for one player across full log
- **Damage mitigation stats**: `SPELL_MISSED` subtypes
