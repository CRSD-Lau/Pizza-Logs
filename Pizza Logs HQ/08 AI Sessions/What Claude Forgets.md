# What Claude Forgets

> Things to explicitly remind Claude at the start of a session or when it goes off-track.

---

## Always Remind Claude

**Scope discipline**
> "Do not re-architect. Do not refactor things that aren't broken. Execute the next step from the handoff exactly."

**DB reset rule**
> "After shipping any new feature, clear the DB automatically using the temp reset-db endpoint pattern."

**Vault maintenance**
> "Update Latest Handoff and Now.md at the end of this session."

**Status tracking**
> "The upload status gets stuck at PARSING if anything errors after encounters are saved. Fix: update status=DONE before computeMilestones."

---

## Recurring Misunderstandings

| Claude tends to… | Correct behavior |
|---|---|
| Use `SectionHeader` after we switched to `AccordionSection` | Use `AccordionSection` for all data sections |
| Filter raids page by `status: "DONE"` | Filter by `encounters: { some: {} }` instead |
| Add trailing summaries after every response | Neil prefers terse responses — results only, no recap |
| Add comments explaining what code does | Only comment WHY (non-obvious constraints), never WHAT |
| Create new files when editing existing ones would do | Prefer editing existing files |
| Forget to add `stalled: false` in UploadZone setState | UploadState requires `stalled` — it's non-optional |

---

## Architecture Facts Claude Sometimes Gets Wrong

- Parser is **server-side** (Python FastAPI on Railway) — NOT client-side
- Warmane has **no ENCOUNTER_START/END** — all detection is heuristic
- `prisma db push` must run via source entry: `node ./node_modules/prisma/build/index.js db push` (NOT `.bin/prisma`)
- Railway internal network (`postgres.railway.internal`) is not reachable locally
- `ReadableStream` controller: use safe `send/close` wrappers that swallow ERR_INVALID_STATE
- Upload status: move `update(DONE)` **before** `computeMilestones`, not after

---

## Things That Always Break

| Thing | What breaks | Fix |
|---|---|---|
| Prisma schema changes | Local client out of date | Run `npx prisma generate` |
| New Railway deploy | Schema not applied | `prisma db push` runs at startup via `start.sh` |
| SSE stream drop | Upload stays PARSING | status=DONE is now set before milestones |
