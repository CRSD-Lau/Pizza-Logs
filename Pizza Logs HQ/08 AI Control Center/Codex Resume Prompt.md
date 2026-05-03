# Codex Resume Prompt

> Paste this at the start of a Codex session when you want the agent to resume Pizza Logs work.

## Paste This

```
Read these files in order before doing anything:

1. Pizza Logs HQ/00 Inbox/START HERE.md
2. Pizza Logs HQ/02 Build Log/Latest Handoff.md
3. Pizza Logs HQ/03 Current Focus/Now.md
4. Pizza Logs HQ/09 Bugs and Blockers/Known Issues.md

Then run:
git status --short --branch

If git is not on PATH, use:
C:\Program Files\Git\cmd\git.exe

Tell me:
- Current app state in 2 sentences
- The single most important next step from Latest Handoff
- Any active blocker I should know about

Do not redesign or refactor working systems unless the requested task requires it.
Do not change parser behavior without fixture validation.
Update Latest Handoff, Now.md, and Known Issues at the end of the session.
```

## Session-Start Checklist

- [ ] Read START HERE
- [ ] Read Latest Handoff
- [ ] Read Now
- [ ] Check Known Issues
- [ ] Check current Git branch/status
- [ ] Identify parser/admin/deployment risk before editing

## Session-End Checklist

- [ ] Latest Handoff updated with date, branch, files changed, verification, next step
- [ ] Now.md updated to reflect current focus
- [ ] Known Issues updated for fixed or discovered bugs
- [ ] Any key decisions added to Decision Log
- [ ] Any recurring gotchas added to Repeated Fixes & Gotchas
