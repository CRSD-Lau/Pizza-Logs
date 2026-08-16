## Summary

<!-- What changed and why? Keep this outcome-focused. -->

## Risk

<!-- Parser, upload, database/migration, admin/security, public API, deployment, or none. -->

## Validation

- [ ] `npm run check:pr`
- [ ] `cd parser && pytest tests/ -v` (required for parser changes)
- [ ] `npx prisma validate` and migration reviewed (required for schema changes)
- [ ] Container/config checks completed (required for deployment changes)
- [ ] Final diff reviewed; no secret, `.env`, raw log, upload, cache, or machine-state files staged

## Documentation and Operations

- [ ] Authoritative docs and `CHANGELOG.md` updated, or no documentation change is needed
- [ ] Production impact, migration risk, rollback, and re-upload requirements are stated when applicable

## Review Focus

<!-- Call out parser fixtures, security boundaries, response compatibility, or anything reviewers should inspect closely. -->

@codex review: focus on parser/Skada correctness, upload and admin security, data or Railway risk, accidental secret exposure, stale-code deletion proof, and documentation drift.
