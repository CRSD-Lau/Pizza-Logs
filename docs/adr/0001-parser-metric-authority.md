# ADR 0001: Parser Metric Authority

- Status: Accepted
- Date: 2026-08-15

## Context

Warmane combat logs frequently lack reliable encounter markers, and raiders compare Pizza Logs with both Skada-WoTLK and UwU-style reports. Those products answer overlapping but not identical questions.

## Decision

Skada-WoTLK is the authority for supported damage/healing events and effective-healing primitives. Pizza Logs may adopt clearly labeled UwU analytical views, such as the first-to-last-event Custom Slice and healing plus attributed absorbs, without changing the stored primitive definitions.

Headline outgoing damage and damage taken use the raw reported combat-log amount. Useful/effective damage remains a supplemental analytical formula. Missing or conflicting ownership/difficulty evidence remains unknown or unattributed.

## Consequences

- Parser changes require evidence and regression coverage.
- Presentation can offer comparison views without mutating historical primitives.
- Some totals may intentionally differ from another product because boundaries or definitions differ.
- Historic uploads require re-upload after parser corrections; rows are not silently recomputed.
