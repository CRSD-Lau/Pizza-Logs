# Pizza Logs Code Review Guide

Use this guide when requesting or performing review on Pizza Logs changes. If GitHub Codex review is configured, comment:

```text
@codex review
```

Ask for findings first, with exact file and line references.

## Review Priorities

- Parser correctness and Skada-WoTLK alignment.
- Parser fixture validation and combat-log edge cases.
- Boss segmentation, aliases, wipe/kill detection, and KILL duration.
- DPS/HPS calculations and healing/damage event field indexes.
- Upload flow, duplicate handling, saved report shape, and milestone timing.
- Admin-only access control and destructive admin actions.
- Public routes not exposing upload telemetry, secrets, reset controls, or raw admin data.
- Warmane roster/gear/portrait cache behavior and browser import safety.
- Railway startup, Prisma migration, and deployment risk.
- Accidental secret exposure.
- Stale-code or stale-doc deletion without proof.
- Generated, private, or local files accidentally staged.
- Documentation drift and stale commands.
- Dependency and lockfile changes.

## Pre-PR Checklist

- `codex-dev` is updated from `origin/main`.
- Parser tests pass if parser behavior changed.
- TypeScript check passes.
- Lint passes.
- Production build passes.
- Secret scan or manual staged-secret review is clean.
- No `.env` files are staged.
- No production secrets are staged.
- Railway config changes are intentional.
- Database migrations are understood.
- Git status contains only intended changes.
- Final diff has been reviewed.

## Stale-Code Review Rule

Approve deletions only when the diff or search evidence proves no imports, scripts, docs, deployment config, tests, or runtime paths still reference the deleted item. Parser-critical code needs fixture validation before deletion.
