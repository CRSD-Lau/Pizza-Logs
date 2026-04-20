# Technical Debt

> Real debt that will bite us. Not a wish list.

---

## High (will block something soon)

### Footer text is wrong
- **Debt:** Footer says "All parsing done client-side, no data leaves your browser" — parsing is entirely server-side
- **Impact:** Misleads users, looks amateurish
- **Fix:** Update footer component, change to "All parsing done server-side on Railway"
- **Effort:** 5 min

### Admin page has no auth
- **Debt:** `/admin` is publicly accessible — anyone can see DB stats, upload timings, errors
- **Impact:** Exposes internal metrics and potential error details
- **Fix:** Simple middleware checking `x-admin-secret` cookie or env-var header
- **Effort:** 30 min

---

## Medium (annoying, worth fixing eventually)

### Reset-DB endpoint pattern is manual
- **Debt:** Every DB wipe requires deploy temp endpoint → hit → delete (3 commits)
- **Impact:** Slow, messy git history
- **Fix:** Build it permanently behind proper admin auth once admin auth is done
- **Effort:** 1 hour (depends on admin auth)

### Player page links from encounter detail go to global profile
- **Debt:** Encounter detail page links players to `/players/[name]` (all-time), not to session-scoped page
- **Impact:** Inconsistency — session page goes to session-scoped, encounter detail doesn't
- **Fix:** Pass `uploadId` + `sessionIndex` through encounter detail so roster links can go to session page
- **Effort:** 45 min

### `inferRole` in route.ts is a rough heuristic
- **Debt:** Role is inferred from healing/damage ratio — any DK with self-heals gets misclassified
- **Impact:** TANK role never assigned; role badges are unreliable
- **Fix:** Infer role from class (tank specs only DK/Warrior/Paladin/Druid) + spec detection from spells
- **Effort:** 2-3 hours

---

## Low (cosmetic, minor)

### `stalled` field in UploadState was missing from setState calls
- **Status:** Fixed 2026-04-20

### Weekly page (`/weekly`) not in nav
- **Debt:** Nav has "This Week" but the page hasn't been audited for accuracy
- **Effort:** Audit needed

### No 404 page
- **Debt:** Next.js default 404, no branded error page
- **Effort:** 20 min

---

## Won't Fix

| Item | Reason |
|---|---|
| Heroic detection | Impossible without ENCOUNTER_START |
| DPS accuracy to 0.1% | Different event inclusion rules vs uwu-logs; not worth chasing |
| Gunship Battle detection | Impossible |
