# Feature Status

## Shipped ✅

| Feature | Notes |
|---|---|
| File upload (drag + drop) | UploadZone.tsx, accepts .txt/.log up to 1GB |
| Streaming upload to parser | `duplex: "half"` — no buffering in Next.js |
| SSE real progress bar | Parser emits every 50k lines, browser reads stream |
| Browser notification on complete | Native Notification API, fires even if tab in background |
| Boss encounter detection | Heuristic segmentation (no ENCOUNTER_START needed) |
| DPS / HPS aggregation | Per player per encounter |
| Spell breakdown | Per spell: damage, healing, hits, crits, school |
| Class detection | SPELL_CLASS_MAP (~150 spells → 10 classes) |
| WoW class colors | In DamageMeter, LeaderboardBar, weekly page |
| Weekly leaderboard (`/weekly`) | Top DPS/HPS per boss this week |
| Boss leaderboards (`/bosses`) | All-time top per boss+difficulty |
| Upload history (`/history`) | Recent uploads with encounter counts |
| Admin dashboard (`/admin`) | DB stats, service health, upload timings, errors |
| Deduplication | File-level (SHA-256) + encounter-level (fingerprint) |
| Milestone tracking | New #1 records detected and shown after upload |
| Valithria Dreamwalker KILL detection | Green Dragon Combat Trigger death |
| KILL duration accuracy | Uses boss death timestamp, not post-fight tail |
| Boss sort order (ICC first) | sortOrder field, ICC=10-40, Naxx=700-741 |
| Obsidian vault | Pizza Logs HQ/ in repo, Codex reads on session start |
| AGENTS.md | Session instructions committed to repo root |
| Parser — Skada-WoTLK alignment | DMG_EVENTS, HEAL_EVENTS, heal formula all match Skada source exactly |
| Heal formula fix | effective = max(0, parts[10] - parts[11]) — gross minus overheal per Skada |
| Heroic difficulty normalization | 25N encounters in confirmed 25H sessions promoted via `_normalize_session_difficulty` |

---

## In Progress 🔄

| Feature | Status |
|---|---|
| HPS accuracy vs Skada | Parser aligned with Skada-WoTLK source. ~21-28% gap remains — likely PW:S absorbs (separate Skada module, not yet implemented) |
| Absorbs tracking (PW:S) | Skada counts absorbs separately (`actor.absorb`). Not yet in parser. Future enhancement. |

---

## Planned / Backlog 🔜

| Feature | Priority | Notes |
|---|---|---|
| Admin auth (secret middleware) | Medium | Simple env-var cookie check, no user DB needed |
| Player profile page | Medium | `/players/[name]` — all encounters, class, progression |
| Encounter detail page | Medium | Full damage meter + spell breakdown per fight |
| Guild comparison | Low | Compare guild members side-by-side |
| Heroic difficulty detection | Won't do | Impossible without ENCOUNTER_START on Warmane |
| Public guild pages | Low | Share leaderboards publicly |
| Multiple guild support | Low | Already in schema (Guild table), just needs UI |
| Real-time parse speed display | Low | Show MB/s or lines/s during upload |

---

## Footer Text Bug
Footer says "All parsing done client-side, no data leaves your browser" — this is wrong, parsing is server-side. Should be updated.
