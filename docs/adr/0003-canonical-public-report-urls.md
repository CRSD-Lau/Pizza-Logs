# ADR 0003: Canonical Public Report URLs

- Status: Accepted
- Date: 2026-08-15

## Context

Database CUIDs and numeric session indexes are stable internally but are poor public/share URLs. Raid dates are meaningful, and uploaded files may include multiple sessions or multiple sessions on one date.

## Decision

New public links use an immutable `Upload.publicSlug` and a session date derived from persisted `sessionAnalytics.startedAt`, falling back to the earliest encounter. A second session on the same date receives `-2`, `-3`, and so on. Legacy CUID/numeric routes permanently redirect to the canonical dated route.

Share metadata uses the same canonical date/report identity.

## Consequences

- Database identifiers are not exposed in newly generated share links.
- Stored session timestamps, not request time, determine canonical URLs.
- Existing bookmarks continue through permanent redirects.
- URL construction and metadata must share tested routing helpers.
