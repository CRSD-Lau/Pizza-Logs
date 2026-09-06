# Pizza Logs Documentation

This directory contains maintained, versioned project documentation. GitHub issues and pull requests are the source of truth for active work; `CHANGELOG.md` records shipped changes; ADRs record durable decisions.

## Start Here

- [Project README](../README.md) - product overview and quick start
- [1.0.0 release contract](releases/1.0.0.md) - stable product scope, compatibility, known limits and release gates
- [Development setup](development/setup.md) - local environment and database
- [Testing](development/testing.md) - validation gates
- [Acquisition review](acquisition-review.md) - evidence, findings and release conditions
- [Architecture overview](architecture/overview.md) - services, data flow, and boundaries
- [Surface inventory](architecture/surface-inventory.md) - pages, APIs, actions, jobs and data lifecycle
- [Contribution workflow](../CONTRIBUTING.md) - branches and pull requests

## Parser and Analytics

- [Parser contract](parser-contract.md) - authoritative combat-log behavior
- [Difficulty detector](difficulty-detector.md) - evidence model and Ulduar rules
- [Streamed upload protocol](archive-upload-protocol.md) - request, state, limits, and cleanup
- [UwU analytical parity](uwu-analytics-parity.md) - adopted comparison definitions and exclusions
- [Fixture guide](../parser/tests/fixtures/README.md) - canonical test data

## Product Guides

- [Uploading a log](guides/uploading.md)
- [Reading a report](guides/reading-reports.md)
- [Player gear quick look](player-gear-quick-look.md)
- [Retired browser automation](userscript-retirement.md)
- [Intro animation pipeline](intro-animation.md)
- [Guild branding](branding.md)
- [Frontend design contract](../DESIGN.md)

## Operations and Security

- [Railway runbook](operations/railway.md)
- [Admin account setup and recovery](operations/admin-access.md)
- [Service objectives and recovery](operations/service-objectives.md)
- [Parser runtime maintenance](operations/parser-runtime.md)
- [Security policy](../SECURITY.md)
- [Threat model](security/threat-model.md)
- [Privacy notice](../PRIVACY.md)
- [Dependency license inventory](../LICENSE.LIST)
- [Asset provenance and rights](security/asset-provenance.md)

## Decisions

- [ADR 0001: Parser metric authority](adr/0001-parser-metric-authority.md)
- [ADR 0002: Branch and documentation workflow](adr/0002-branch-and-documentation-workflow.md)
- [ADR 0003: Canonical public report URLs](adr/0003-canonical-public-report-urls.md)
- [ADR 0004: Durable upload boundary](adr/0004-durable-upload-boundary.md)

## Documentation Rules

- Update an authoritative document in the same pull request as the behavior it describes.
- Prefer links over copied status text.
- Use an ADR for durable choices that future maintainers may otherwise revisit without context.
- Do not commit chat transcripts, session handoffs, personal paths, or rolling “now” documents.
- Validate local Markdown links with `npm run docs:check`.
