# Codex Prompts

## Resume Work

```
Read START HERE, Latest Handoff, Now, Known Issues, and System Architecture.
Then summarize current state, what was last completed, the safest next step,
and any deployment or parser risks. Do not change files yet.
```

## End Session

```
Update the Pizza Logs vault:
1. Rewrite Latest Handoff with date, branch, work completed, files changed,
   verification commands/results, current state, and exact next step.
2. Update Now.md with the active focus and next items.
3. Update Known Issues if bugs were fixed or found.
4. Add key decisions or recurring gotchas when relevant.
```

## Ask For Code Review

```
Review this Pizza Logs change as a senior maintainer.
Prioritize parser correctness, upload/report regressions, admin-only access,
Railway deployment risk, secret exposure, stale-code deletion proof,
dependency changes, and documentation drift. Put findings first with exact
file/line references. Do not spend review space on style unless it hides a bug.
```

## Parser Change Gate

```
Before editing parser logic, map the affected Skada behavior, fixture coverage,
and parser tests. Do not change combat-log math, segmentation, boss aliases,
kill/wipe detection, duration, pet attribution, or GUID handling without a
passing targeted test or fixture validation.
```

## Deployment Gate

```
Before pushing main, verify parser tests, TypeScript, build, secret scan, git
status, final diff, and Railway migration/startup risk. Do not push main if any
gate fails.
```
