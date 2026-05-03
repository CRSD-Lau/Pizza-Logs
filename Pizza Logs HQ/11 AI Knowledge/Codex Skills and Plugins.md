# Codex Skills and Plugins

Pizza Logs is Codex-first. `AGENTS.md` is the canonical workflow guide; this page is a short reference for choosing skills/plugins.

## Recommended Uses

| Need | Use |
|---|---|
| Large repo audit | Parallel explorer subagents |
| Bug root cause | `superpowers:systematic-debugging` |
| Final completion claims | `superpowers:verification-before-completion` |
| GitHub publish flow | `github:yeet` when a PR/push flow is requested |
| Security review | `codex-security:security-scan` for explicit full scans; otherwise run secret scans |
| Frontend verification | Browser/Vercel browser skills when UI changes need screenshots |

## Do Not Use

- Secret-backed connectors unless Neil has already configured them safely.
- Risky plugins that can mutate production services without a scoped request.
- Any workflow that skips parser fixture validation for parser behavior changes.
