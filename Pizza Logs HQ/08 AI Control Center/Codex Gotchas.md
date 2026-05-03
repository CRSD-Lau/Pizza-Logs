# Codex Gotchas

> Project-specific reminders for Codex or any future agent working on Pizza Logs.

## Always Remember

- Do not re-architect working systems unless the task requires it.
- Update Latest Handoff and Now.md before committing.
- Upload status must be set to `DONE` before `computeMilestones`.
- Do not build a Railway residential proxy or Cloudflare-bypass path. Railway should serve cached snapshots and receive imports; it should not depend on live Warmane requests during normal page render.
- Local-only noise can include `.env.local`, `.env.sync-agent`, `.next/`, `.pytest_cache/`, `.sync-agent-logs/`, `tmp-mobile-check/`, and `WoWCombatLog/`.

## Recurring Misunderstandings

| Pitfall | Correct behavior |
|---|---|
| Use `SectionHeader` for data sections | Prefer `AccordionSection` for expandable data sections |
| Filter raids page by `status: "DONE"` | Filter by `encounters: { some: {} }` |
| Add long recap after every response | Keep results concise and actionable |
| Add comments explaining what code does | Comment only non-obvious constraints |
| Create new files when a focused edit would do | Prefer editing existing files |
| Forget `stalled: false` in UploadZone state | `UploadState.stalled` is required |

## Parser Facts Agents Get Wrong

- Parser is Python FastAPI on Railway, not client-side.
- Warmane often lacks useful encounter events; heuristic detection matters.
- Skada-WoTLK is the source of truth, not UWU.
- `SPELL_HEAL_ABSORBED` is not healing done in Skada.
- Heal total is gross minus overheal.
- `DAMAGE_SHIELD`, `DAMAGE_SPLIT`, and `SPELL_BUILDING_DAMAGE` count for damage done.
- KILL duration uses boss death timestamp.

## Deployment Facts

- Railway internal hostnames are not reachable locally.
- `start.sh` runs `prisma migrate deploy`, then `node server.js`.
- Prisma schema changes require `npm run db:generate` locally.
- Production admin must have `ADMIN_SECRET`; missing secret should fail closed in production.
