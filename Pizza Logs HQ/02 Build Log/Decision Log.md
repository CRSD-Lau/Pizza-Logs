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

## Early — No heroic detection

**Decision:** Don't attempt to detect 25H vs 25N from log events  
**Why:** Warmane uses the same NPC/spell IDs for both difficulties. Without ENCOUNTER_START (which Warmane doesn't emit), there is no reliable signal. Boss HP threshold approach (25N vs 25H total damage ratio ~1.45x) is too noisy.  
**Status:** Won't do.

---

## Early — File-level + encounter-level deduplication

**Decision:** Two dedup layers: SHA-256 of file (Upload.fileHash) + SHA-256 of boss+difficulty+timeblock+sorted_player_names (Encounter.fingerprint)  
**Why:** File-level catches exact re-uploads. Encounter-level catches the same fight appearing in two different log files (e.g. two officers both upload a log from the same night).  
**Tradeoff:** Fingerprint is approximate (5-min timeblock). Acceptable — collision probability is negligible in practice.
