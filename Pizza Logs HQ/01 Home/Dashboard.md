# Pizza Logs — Dashboard

> **Rule:** Build more. Organize less. One working feature at a time.

---

## Quick Status

| Thing          | Status                                                 |
| -------------- | ------------------------------------------------------ |
| App            | 🟢 Live — https://pizza-logs-production.up.railway.app |
| DB             | Check after last session                               |
| Last deploy    | See [[Latest Handoff]]                                 |
| Active blocker | See [[Known Issues]]                                   |

---

## Right Now
→ [[Now]] — what am I working on  
→ [[Latest Handoff]] — where I left off  
→ [[Next 30 Minutes]] — just start something  

---

## The Project

**Pizza Logs** — WoW WotLK combat log analytics for PizzaWarriors on Warmane (Lordaeron).  
Upload a combat log → parsed server-side → boss encounters stored → DPS/HPS rankings, player history, session analytics.

**Stack:** Next.js · TypeScript · PostgreSQL · Prisma · Python parser · Railway  
**Repo:** `C:\Users\neil_\OneDrive\Desktop\PizzaLogs\`  
**Routes:** `/` `/raids` `/players` `/weekly` `/bosses` `/uploads` `/admin`

---

## Navigation

### Daily Use
- [[Now]] — current focus
- [[Latest Handoff]] — last session recap
- [[Known Issues]] — active bugs
- [[Backlog]] — feature queue

### Architecture
- [[System Architecture]] — request flow, parser internals
- [[Data Model]] — DB schema quick ref
- [[Repo Map]] — what lives where
- [[Environment Variables]] — all env vars

### Operations
- [[Railway Runbook]] — deploy, restart, logs
- [[Decision Log]] — why we built it this way
- [[Security Checklist]] — what's protected, what's not
- [[Technical Debt]] — known shortcuts and their cost

### AI Control Center
- [[Codex Resume Prompt]] — paste this to start a session
- [[Prompt Library]] — reusable prompts for common ops
- [[Repeated Fixes & Gotchas]] — don't solve the same bug twice
- [[Codex Gotchas]] — things to remind Codex every session
- [[AI Operating System]]  
- [[Codex Skills Index]]

### Ideas
- [[Growth & Business]] — positioning, monetization, roadmap

---

## Shipped Features (highlights)

- Upload → SSE parse → DB → leaderboards (full pipeline working)
- Session splitting (>60 min gap = new raid session)
- Target/mob breakdown (per-player per-mob damage)
- Boss-only DPS (excludes add padding)
- Raids tab, Players tab, session-scoped player analytics
- DPS/HPS line chart (recharts, same-class comparison)
- Accordion sections on all data-heavy pages
- Milestones / #1 rankings
- Deduplication (file + encounter level)

---

## Known Limitations (won't fix)

- Heroic detection impossible (no ENCOUNTER_START on Warmane)
- Gunship Battle detection impossible
- DPS accuracy ±1-2% vs uwu-logs (different event inclusion rules)
