# Pizza Logs Code Review Guide

Use Codex review for changes that touch parser behavior, upload/report flow, admin controls, deployment, dependencies, or stale-code deletion. If GitHub Codex review is configured, comment:

```text
@codex review
```

Ask Codex to put findings first and focus on Pizza Logs risks, not cosmetic style.

## Review Priorities

- Parser correctness and Skada-WoTLK alignment
- Parser fixture validation and combat-log edge cases
- Boss segmentation, aliases, wipe/kill detection, and KILL duration
- DPS/HPS calculations and healing/damage event field indexes
- Upload flow, duplicate handling, saved report shape, and milestone timing
- Admin-only access control and destructive admin actions
- Analytics/report query regressions
- Railway deployment risk and startup/migration behavior
- Accidental secret exposure
- Stale-code deletions without proof
- Generated, private, or local files accidentally staged
- Documentation drift and stale commands
- Dependency and lockfile changes
- Prisma schema or migration changes

## Pre-Main Checklist

Before pushing `main`:

- Parser tests pass.
- Parser fixture validation passes.
- TypeScript check passes.
- Production build passes.
- Secret scan passes or limitations are documented.
- No `.env` files are staged.
- No production secrets are staged.
- Railway config changes are intentional.
- Database migrations are understood.
- Git status contains only intended changes.
- Final diff has been reviewed.

## Stale-Code Review Rule

Approve deletions only when the diff proves no imports, scripts, docs, deployment config, tests, or runtime paths still reference the deleted code. Parser-critical code needs fixture validation before deletion.
