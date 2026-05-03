# Codex Skills Index

Use skills/plugins when they fit the task. Do not install risky plugins or use secret-backed connectors unless the repo already has safe configuration.

## Useful Skills For Pizza Logs

- `superpowers:systematic-debugging` - root-cause bugs before patching symptoms.
- `superpowers:verification-before-completion` - run checks before claiming work is complete.
- `superpowers:dispatching-parallel-agents` - split independent audits or investigations.
- `github:yeet` - publish scoped changes after validation when a GitHub flow is requested.
- `codex-security:security-scan` - use for explicit security reviews; for ordinary releases, at minimum run a secret scan.
- `build-web-apps:*` or `vercel:*` - use for frontend implementation and browser verification when UI changes need it.

## Pizza Logs Rules

- Parser changes require fixture validation.
- Main branch pushes deploy to Railway.
- Vault updates belong in the same commit as code/docs changes.
- Secret-bearing local files stay out of Git.
