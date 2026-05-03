# Prompt Library

> Reusable prompts for common operations. Copy-paste into Codex.

---

## Start a Session (full)
See [[Codex Resume Prompt]] — paste that directly.

---

## End a Session

```
Update the vault for this session:
1. Rewrite Pizza Logs HQ/02 Build Log/Latest Handoff.md with:
   - Date
   - Everything completed this session (files changed, what they do)
   - Current app state (git hash, DB status)
   - Exact next steps (specific, actionable)
   - Pending items not started
2. Update Pizza Logs HQ/03 Current Focus/Now.md
3. Add any new bugs to Known Issues
4. Add any key decisions to Decision Log
5. Add any new gotchas to Repeated Fixes & Gotchas
```

---

## Clear the DB

```
Clear upload-derived data only after Neil explicitly approves destructive DB work.
Prefer existing admin controls or Railway shell/SQL. Do not create or deploy a
temporary reset endpoint unless specifically requested, and never commit a reset
secret.
```

---

## Debug a Bug

```
Bug: [describe symptom]

Read Known Issues and Repeated Fixes & Gotchas first — this may already be solved.
If not, root-cause it before proposing a fix. Don't patch symptoms.
After fixing, add it to Repeated Fixes & Gotchas if it could recur.
```

---

## Add a Feature

```
Feature: [describe what you want]

Before writing code:
1. Check Backlog for any related items
2. Check Technical Debt for anything this might interact with
3. Confirm the exact files to change

After shipping:
1. Clear the DB
2. Update Latest Handoff
3. Update Feature Status
```

---

## Quick Architecture Question

```
Answer this without changing any code:
[question about how something works]

Reference System Architecture, Data Model, and Parser Deep Dive as needed.
```
