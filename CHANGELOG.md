# Changelog

All notable user-visible, operational, security, and compatibility changes are recorded here. Pizza Logs deploys continuously from `main`; release tags are stable snapshots rather than separate supported product lines.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning for tagged releases.

## [Unreleased]

### Added

- Private administrator account provisioning, authenticator enrollment, single-use recovery codes and an account security page, with no paid authentication service.
- Public third-party license notices and owner-confirmed Veo/ChatGPT media provenance with Git introduction dates; sale or transfer clearance is outside the current site's scope.
- Additional independently captured UwU mode, outcome, spell and target comparisons, with explicit mismatch classifications; current evidence is 14 exact cases and 12 visible differences, not full parity.
- Read-only database evidence capture and restoration comparison covering row content, enums, schema, migration history and report totals.
- Full runtime-image vulnerability/SBOM gates, parser tests on the production OS, 90-day CI evidence retention and an exact media provenance register.
- A pinned, offline UwU differential lab, explicit compatibility manifest and monthly reference-drift check. Current evidence does not establish complete UwU parity.
- Nullable parser/metric provenance on new uploads, database integration tests, dependency readiness endpoints and headless responsive/accessibility acceptance in CI.
- Maintained acquisition risk assessment, surface inventory, service objectives and durable-upload ADR.
- Branded social preview plus canonical Open Graph, Twitter, sitemap, robots, and web-app manifest metadata.
- Content Security Policy and modern browser security headers.
- CodeQL, dependency review, Dependabot, CODEOWNERS, immutable GitHub Action pins, and production-container CI builds.
- Weekly dependency audits and a manifest-to-hash-lock consistency gate.
- Hash-locked Python runtime/development dependencies and an unprivileged parser image.
- Maintained architecture, development, operations, security, privacy, license, and ADR documentation.

### Changed

- Require account-level backup eligibility and subscription-cost checks before native Railway recovery setup; document the Pro-plan gate, owner-operated PITR activation and isolated restore validation.
- Record production administrator MFA and current-device sign-out acceptance, including stored-session deletion and a fresh same-browser login requirement, plus owner acceptance of direct streaming with reupload after interruption; durable upload orchestration remains a separate future request.
- Add an All Boss Attempts default raid-summary view alongside Successful Boss Fights. Keep headline, player and target totals on the same selected fights, include every stored attempt in the all-attempt view, and preserve selection through report navigation. Short-pull controls change the encounter list and its counts without changing either summary; existing reports need no re-upload.

- Standardize report amounts and rates with exactly two decimals and K/M abbreviations (`13.93K`, `4.20M`, `1,234.57M`), matching charts, tables and tooltips. Percentages, decimal seconds and scaled binary file sizes also use two decimals; counts, ranks, levels and GearScore retain grouped whole numbers. Preserve clock-style durations, UTC dates, missing-value handling, mobile metric labels and explicit death/kill/wipe count words across public and admin pages.
- Keep recent player history chronological, expose every spell in expanded breakdowns and paginate the complete admin upload inventory with accurate visible/total counts.
- Remove unscoped player crowns, historical-award sorting and unreliable award-derived best figures. Add alphabetical name/class browsing, guild filtering before pagination, and complete upload-based raid history pagination.
- Put uploading first, make the guild cinematic optional, request notifications only on explicit opt-in, and provide a primary report link after both new and duplicate uploads.
- Add difficulty filters, real weekly attempt dates and fight links, report section shortcuts, accessible search announcements and keyboard navigation, a tablet-safe header, compact short-pull details, readable status colors and visitor-facing recovery pages. Historical awards explicitly show rank when achieved.

- Keep the centered character quick look consistent across guild, raid and player pages: preserve a valid cached appearance during partial Armory failures, identify cached outfits, and show loading, missing-appearance and unavailable-WebGL states in the shared portrait.
- Focus raid summaries, player totals/rates and target breakdowns on successful boss fights, excluding wipes and between-fight trash while retaining encounter adds. Add ascending/descending player-table sorting on desktop and mobile, and keep complete session totals in a separate collapsed section. Existing reports use stored encounters without reprocessing.
- Keep collapsed breakdown controls out of keyboard navigation and brighten two fallback player-name colors so players with an unknown class remain readable on dark report surfaces.
- Exclude recorded wipes under one minute with no recorded deaths from default public wipe/pull counts. Show a short-pull count and an Include short pulls control; preserve every stored attempt, short kill, death-bearing wipe, unknown outcome and combat metric. The policy also applies to existing reports without reprocessing.
- Keep unknown outcomes separate from wipe totals on the boss index.
- Parser 1.1.1 counts effective player and owned-pet healing to NPCs, pets and totems in encounter totals and HPS, correcting omitted Valithria healing. Existing stored reports are not automatically recalculated.
- Recognize Fel Synergy healing as owner-exclusive evidence for a controlled permanent pet, recovering supported pet damage attribution without treating generic healing as ownership.
- Fit the hover character viewer to the full portrait height and lower its camera framing so tall headgear and feet remain visible.
- Move the parser to a digest-pinned supported Alpine/Python runtime, removing the observed Debian package findings while retaining hash locks and non-root execution. Matched local parsing is 7–16% slower with lower peak memory; see the runtime runbook.
- Persist complete uploads atomically with bounded conflict retries and completed-file deduplication; incomplete historical uploads require maintainer recovery.
- Correct environmental incoming damage and explicit calendar-day session boundaries in both quick previews and final reports without rewriting historical reports.
- Aggregate boss/weekly statistics in PostgreSQL; fix weekly cutoff, milestone rank eligibility and player aggregate statistics.
- Restore fresh database bootstrap, verify legacy migration adoption, normalize the historical roster index name, package the migration engine for offline startup, honor runtime database schemas and bound database/upstream operations.
- Associate upload field labels, improve supporting-text and admin-control contrast, and label weekly versus recorded all-time achievements within the existing visual design.
- Restore the Choose File button's file-picker action and expose upload progress/error announcements to assistive technology.
- Upgraded Next.js and `eslint-config-next` to 16.3.1, Python to 3.14, Uvicorn to 0.52.3, and `pip-tools` to 7.6.1.
- Public uploads now use only the bounded UUID streaming protocol and persist parser-observed byte size.
- Agent/contributor work now uses short-lived task branches, issues/PRs, ADRs, and the changelog instead of a long-lived `codex-dev` plus mandatory Obsidian handoffs.
- Intro rendering writes canonical generated files directly to `public/animations`.

### Security

- Apply Alpine's `libuuid` 2.42.3-r1 security update in the existing parser runtime, preserving the pinned Python/Alpine base, Python lockfiles and unsuppressed image scan gate.
- Replace the shared-secret admin login and header/body bypasses with password plus MFA, server-side session checks, database-backed throttling, exact-origin mutation checks and immediate session revocation. Deployment requires owner configuration and enrollment before admin access is available.
- Bound parser transport, archive metadata and physical lines; retain worker capacity and temporary files until cancelled work actually exits. ZIP members support stored/deflate compression only.
- Remove unused installer tools from runtime images and update vulnerable transitive npm dependencies. The follow-up parser image replaces the affected Debian base; the original findings and rollout implications remain documented.
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
