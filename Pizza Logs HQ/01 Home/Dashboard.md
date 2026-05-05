# Pizza Logs Dashboard

## Quick Status

| Area | Status |
|---|---|
| Production | https://pizza-logs-production.up.railway.app |
| Working branch | `codex-dev` |
| Deploy path | PR from `codex-dev` to `main`, Neil merges, Railway deploys |
| Active focus | See [[Now]] |
| Active blockers | See [[Known Issues]] |

## Daily Links

- [[START HERE]] - session startup rules
- [[Latest Handoff]] - current repo state and last session notes
- [[Now]] - current focus and next actions
- [[Known Issues]] - open bugs, blockers, and limitations
- [[Feature Status]] - shipped features, backlog, and technical debt

## Architecture And Operations

- [[System Architecture]] - request flow and major subsystems
- [[Data Model]] - database quick reference
- [[Repo Map]] - source layout
- [[Environment Variables]] - active env vars
- [[Parser Deep Dive]] - parser internals, with `docs/parser-contract.md` as the formal contract
- [[Railway Runbook]] - deployment and recovery
- [[Security Checklist]] - current security posture
- [[Decision Log]] - durable project decisions
- [[Repeated Fixes & Gotchas]] - recurring implementation pitfalls
- [[Codex Gotchas]] - agent-specific reminders
- [[Codex Prompts]] - reusable Codex prompts

## Product Summary

Pizza Logs lets PizzaWarriors upload WotLK combat logs, parse boss encounters with Skada-aligned rules, and review raid sessions, boss rankings, player history, gear, roster data, and weekly summaries.

Current high-value areas:

- parser correctness and fixture coverage;
- upload reliability and SSE progress;
- admin-only diagnostics and import tools;
- Warmane roster/gear cache freshness;
- player pages for both combat-log and roster-only characters.

## Known Limitations

- Absorbs are not implemented yet.
- Role detection is still a rough upload-time heuristic.
- Warmane direct server fetches are unreliable; browser-assisted imports remain the supported path.
- Upload rate limiting and hard server-side size enforcement are still open.
