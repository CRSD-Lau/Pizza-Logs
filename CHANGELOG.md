# Changelog

All notable user-visible, operational, security, and compatibility changes are recorded here. Pizza Logs deploys continuously from `main`; release tags are stable snapshots rather than separate supported product lines.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning for tagged releases.

## [Unreleased]

### Added

- Branded social preview plus canonical Open Graph, Twitter, sitemap, robots, and web-app manifest metadata.
- Content Security Policy and modern browser security headers.
- CodeQL, dependency review, Dependabot, CODEOWNERS, and immutable GitHub Action pins.
- Weekly dependency audits and a manifest-to-hash-lock consistency gate.
- Hash-locked Python runtime/development dependencies and an unprivileged parser image.
- Maintained architecture, development, operations, security, privacy, license, and ADR documentation.

### Changed

- Upgraded Next.js and `eslint-config-next` to 16.3.1 and Uvicorn to 0.52.3.
- Public uploads now use only the bounded UUID streaming protocol and persist parser-observed byte size.
- Agent/contributor work now uses short-lived task branches, issues/PRs, ADRs, and the changelog instead of a long-lived `codex-dev` plus mandatory Obsidian handoffs.
- Intro rendering writes canonical generated files directly to `public/animations`.

### Security

- Removed the unauthenticated upload-row listing and query-string admin import endpoint.
- Removed arbitrary parser filesystem access and disabled legacy multipart/debug/stream routes by default.
- Sanitized untrusted Slack pull-request text and public upload/parser errors.
- Added compressed-size enforcement to every upload path and removed the public fallback that bypassed modern archive controls.
- Isolated streamed-upload temp files behind server-generated names and made external HTML entity decoding single-pass.

### Removed

- Duplicate generated intro media, unused UI/helpers/constants/dependencies, stale tooling scripts, and obsolete project-vault/status documents.
- Public imported agent-chat transcripts and the stale GitHub wiki workflow.

## [0.1.0] - 2026-04-26

### Added

- First public release with Skada-aligned combat-log parsing, ICC raid support, player statistics, boss pages, leaderboards, uploads, and Railway deployment.

[Unreleased]: https://github.com/CRSD-Lau/Pizza-Logs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/CRSD-Lau/Pizza-Logs/releases/tag/v0.1.0
