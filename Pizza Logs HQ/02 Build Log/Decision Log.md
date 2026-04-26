# Decision Log

> Why we built it this way. Prevents re-hashing the same debate twice.

---

## 2026-04-20 — Session splitting threshold = 60 min

**Decision:** Encounters with >60 min gap between them = new sessionIndex  
**Why:** Typical raid night is 2-4 hours continuous. A VoA pug after a main raid night has a natural gap well over an hour. 60 min catches that without splitting within a single raid night.  
**Tradeoff:** Might merge a very long raid break (bathroom + food) into one session. Acceptable.  
**Config:** `CombatLogParser._assign_session_indices(gap_seconds=3600)` in `parser_core.py`

---

## 2026-04-20 — Move upload.update(DONE) before computeMilestones

**Decision:** Mark upload as DONE before computing milestones, not after  
**Why:** Milestones are best-effort. If they fail or the SSE stream drops, the upload should still be recorded correctly. DONE = encounters saved. Milestones are bonus.  
**Tradeoff:** An upload could be marked DONE but have no milestones. Acceptable — milestones failing is rare and not data-loss.

---

## 2026-04-20 — Raids page filters by encounters.some({}) not status=DONE

**Decision:** Show any upload with at least one encounter on the Raids page  
**Why:** Upload status can get stuck at PARSING even after encounters save correctly (stream drop). Filtering by data presence is more reliable than status.  
**Tradeoff:** Could show a partially-parsed upload. Acceptable — partial data is better than missing data.

---

## 2026-04-20 — Session-scoped player page instead of global profile in roster

**Decision:** Raid roster links go to `/uploads/[id]/sessions/[idx]/players/[name]` not `/players/[name]`  
**Why:** When reviewing a specific raid, you want stats from that raid, not all-time stats. All-time profile is still accessible via link at the bottom.  
**Tradeoff:** More URLs to maintain. Worth it for the contextual value.

---

## 2026-04-20 — Gold line for subject player in DPS/HPS chart

**Decision:** Viewed player = gold (#c8a84b) line, classmates = class color at 55% opacity  
**Why:** All same-class players have the same class color. Without differentiation you can't tell who is who. Gold stands out against any class color.  
**Tradeoff:** Subject player's line color doesn't match their class. Acceptable — gold is the app's primary accent.

---

## 2026-04-26 — Skada-WoTLK as sole parser reference

**Decision:** Parser replicates Skada-WoTLK exactly. Not UWU, not Warcraft Logs, not guesswork.  
**Why:** Skada is what the raid uses in-game. Website showing the same numbers as Skada = players immediately trust it. UWU source code is unavailable and UWU is not the player-facing reference.  
**How:** Every DMG_EVENTS entry, HEAL_EVENTS entry, spell exclusion, and field interpretation must cite a Skada Lua file + line. If Skada does it, we do it. If Skada doesn't, we don't.  
**Source:** https://github.com/bkader/Skada-WoTLK — Damage.lua, Healing.lua, Tables.lua, Functions.lua  
**Key findings from audit:**
- Heal formula: `max(0, parts[10] - parts[11])` — gross minus overheal (was wrong: using overheal as amount)
- DAMAGE_SHIELD, DAMAGE_SPLIT, SPELL_BUILDING_DAMAGE all included (Damage.lua RegisterForCL)
- Tables.lua has no `ignored_spells.heal` — nothing excluded from healing done
- SPELL_HEAL_ABSORBED not registered by Skada — correctly excluded

---

## Early — No heroic detection

**Decision:** Don't attempt to detect 25H vs 25N from log events  
**Why:** Warmane uses the same NPC/spell IDs for both difficulties. Without ENCOUNTER_START (which Warmane doesn't emit), there is no reliable signal. Boss HP threshold approach (25N vs 25H total damage ratio ~1.45x) is too noisy.  
**Status:** Won't do.

---

## Early — File-level + encounter-level deduplication

**Decision:** Two dedup layers: SHA-256 of file (Upload.fileHash) + SHA-256 of boss+difficulty+timeblock+sorted_player_names (Encounter.fingerprint)  
**Why:** File-level catches exact re-uploads. Encounter-level catches the same fight appearing in two different log files (e.g. two officers both upload a log from the same night).  
**Tradeoff:** Fingerprint is approximate (5-min timeblock). Acceptable — collision probability is negligible in practice.
