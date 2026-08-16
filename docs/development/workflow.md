# Development Workflow

## Branches

`main` is the production branch. Work happens on short-lived branches created from current `origin/main`:

```bash
git fetch origin
git switch --create codex/<task> origin/main
```

Use one branch per coherent change. The historical long-lived `codex-dev` synchronization branch is retired because it duplicated `main`, accumulated unrelated context, and made branch ownership and cleanup unclear.

## Pull Requests

- Open a PR into `main`.
- Use the repository template and identify parser, upload, schema, admin/security, API, or deployment risk.
- Required CI must pass; required checks are never bypassed.
- Review the complete diff, including generated files and deletions.
- Prefer squash merge and delete the branch.
- Railway deploys the merge commit from `main`.

Maintainer or agent merge authority is operational, not a review bypass: merge only when CI is green, the final diff is understood, and no explicit blocker remains.

## Where Project Knowledge Lives

| Information | Canonical home |
| --- | --- |
| Work in progress, bugs, requests | GitHub issue or pull request |
| Shipped user/ops/security change | `CHANGELOG.md` and release notes when tagged |
| Durable architectural decision | `docs/adr/` |
| Current commands and contracts | Maintained docs in `docs/` |
| Security disclosure | Private GitHub security advisory |

Session handoffs, rolling “now” pages, imported chat transcripts, and duplicate wiki pages are intentionally not part of the workflow. Git history, PR discussion, CI output, and concise durable docs provide a more reliable baseline.

## Releases

Pizza Logs normally deploys continuously rather than cutting a tag for every merge. When a stable public snapshot is useful:

1. finish the changelog section;
2. update the package version consistently;
3. merge through a passing PR;
4. tag the exact `main` commit;
5. publish release notes from the changelog;
6. verify Railway and production smoke results.
