# Codex Prompts

## Resume Work

```text
Read these files in order:
1. Pizza Logs HQ/00 Inbox/START HERE.md
2. Pizza Logs HQ/02 Build Log/Latest Handoff.md
3. Pizza Logs HQ/03 Current Focus/Now.md

Then run git status --short --branch. If git is not on PATH, use:
C:\Program Files\Git\cmd\git.exe

Summarize current app state, the safest next step, and any parser/admin/deployment risk. Do not change files yet.
```

## End Session

```text
Update the Pizza Logs vault:
1. Latest Handoff: date, branch, changes, verification, current state, exact next step.
2. Now: active focus and next actions.
3. Known Issues: any new or fixed bugs.
4. Decision Log or Repeated Fixes & Gotchas only if a durable decision or recurring fix was found.
```

## Code Review

```text
Review this Pizza Logs change as a senior maintainer. Put findings first with exact file/line references. Focus on parser correctness, Skada alignment, upload/report regressions, admin-only access, Railway/Prisma risk, secrets, stale-code deletion proof, dependency changes, and documentation drift. Ignore cosmetic style unless it hides a bug.
```

## Parser Change Gate

```text
Before editing parser logic, map the affected Skada behavior, fixture coverage, and parser tests. Do not change combat-log math, segmentation, boss aliases, kill/wipe detection, duration, pet attribution, GUID handling, or difficulty handling without targeted pytest or fixture validation.
```

## PR Gate

```text
Before opening a PR from codex-dev to main, verify branch state, lint, type-check, build, parser tests when applicable, secret scan/staged-secret review, git status, final diff, and Railway migration/startup risk. Do not push or merge main directly.
```
