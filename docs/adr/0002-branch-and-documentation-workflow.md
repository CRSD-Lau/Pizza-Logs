# ADR 0002: Branch and Documentation Workflow

- Status: Accepted
- Date: 2026-08-15

## Context

The repository used a long-lived `codex-dev` branch plus mandatory committed Obsidian handoff/current-focus files. Those files duplicated PR/release history, grew large, contradicted current code, exposed imported chat transcripts/personal paths, and routinely described already-merged work as the next task.

Modern agent sessions can inspect Git, code, tests, issues, PRs, and concise maintained docs directly. A mandatory rolling handoff is no longer a reliable source of truth.

## Decision

- Use short-lived task branches from current `origin/main`.
- Require a passing pull request into `main`; prefer squash merge and branch deletion.
- Use issues/PRs for live work, `CHANGELOG.md` for shipped behavior, and ADRs for durable decisions.
- Keep conventional versioned docs in `docs/`; retire the public wiki and committed Obsidian vault.
- Do not commit session transcripts, rolling “now” pages, or machine-specific handoffs.

## Consequences

- Every task begins from production truth and has an obvious owner/lifetime.
- CI and the final PR diff remain the delivery gate.
- Durable knowledge must be intentionally summarized instead of copied from conversations.
- Git history preserves the retired material if forensic recovery is ever needed.
