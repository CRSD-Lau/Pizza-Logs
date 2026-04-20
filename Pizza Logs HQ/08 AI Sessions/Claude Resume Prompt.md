# Claude Resume Prompt

> Paste this at the start of any Claude Code session. It loads all context.

---

## Paste This

```
Read these files in order before doing anything:

1. Pizza Logs HQ/02 Build Log/Latest Handoff.md  — last session state, git hash, next step
2. Pizza Logs HQ/03 Current Focus/Now.md          — what I'm focused on right now
3. Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md — active bugs, do not re-introduce

Then tell me:
- Current app state in 2 sentences
- The single most important next step from Latest Handoff
- Any active blocker I should know about

Do not redesign or refactor anything that already works.
Do not re-architect. Execute the next step from the handoff exactly.
After shipping any new feature, clear the DB automatically.
Update the vault (Latest Handoff + Now) at the end of the session.
```

---

## Session-Start Checklist

Before writing any code, confirm:
- [ ] Read Latest Handoff — know the git hash and last state
- [ ] Read Now — know the current focus
- [ ] Check Known Issues — don't re-introduce a fixed bug
- [ ] DB status (empty or has test data?)

---

## Other Prompts
See [[Prompt Library]] for common one-liners (debug, add feature, clear DB, etc.).

---

## Session-End Checklist

Before closing:
- [ ] Latest Handoff updated with exact git hash, files changed, next step
- [ ] Now.md updated to reflect current focus
- [ ] Any new bugs added to Known Issues
- [ ] Any key decisions added to Decision Log
- [ ] Any new gotchas added to Repeated Fixes & Gotchas
