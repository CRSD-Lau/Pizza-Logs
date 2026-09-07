# Privacy Notice

Author: Neil Mitchell
Last Modified By: Neil Mitchell
Last updated: 2026-09-06

Pizza Logs is a community raid-analysis service for PizzaWarriors. Public visitors do not have accounts. One private administrator account protects maintenance access; there is no advertising SDK or payment flow.

## Data Processed

When a combat log is uploaded, Pizza Logs processes:

- the uploaded file's base filename, byte size, and SHA-256 hash;
- an optional uploader label plus selected guild, realm, host, and expansion values;
- public in-game character and pet names;
- timestamps, combat events, raid composition, encounters, and derived performance statistics.

Pizza Logs also stores public PizzaWarriors roster information and cached Warmane character equipment/profile data. It does not intentionally request or store Battle.net/Warmane passwords, public visitors' email addresses, payment information or real-world identity documents.

Private administration stores the designated administrator's email and name, a password hash, encrypted authenticator and recovery-code material, and session records that can include IP address and user agent. Short-lived authentication challenges, rate-limit records and keyed code-reuse fingerprints support sign-in security. Plaintext login passwords are not stored. No email is sent and no external authentication provider receives these credentials.

## How Data Is Used

Data is used to detect duplicate uploads, parse and display raid reports, calculate records and weekly summaries, provide player/gear views, and operate or troubleshoot the service.

Raw upload bytes are written temporarily by the parser during processing, then removed after completion or cleanup. The database keeps the parsed report and upload metadata; it does not keep a downloadable copy of the raw combat log.

Each upload requires acknowledgement of the current upload rules and public visibility notice. The server checks the submitted policy version before processing. This is a request-level acknowledgement, not a verified identity or a separately retained consent record. Upload admission counters are held in process memory; this upload throttle does not store IP addresses or add tracking cookies. Original upload filenames remain in administrator metadata and are omitted from public encounter APIs.

## Public Visibility

Raid reports, in-game character names, roster data, gear snapshots, and performance statistics are public. Do not upload a log if those game identifiers should not appear publicly. Admin diagnostics and maintenance controls are not public.

## Infrastructure and Third Parties

- Railway hosts the application, parser, and production infrastructure and may process ordinary request logs such as IP address and user agent.
- PostgreSQL stores application data within the deployed environment.
- Warmane Armory/CDN is queried server-side for public roster, character, model, and gear information.
- `wow.zamimg.com` may serve static item icons when local metadata identifies an icon slug.
- GitHub hosts the source repository, issues, pull requests, and private security reports.

Pizza Logs does not sell personal information and does not include a third-party advertising or behavioral analytics SDK.

## Cookies

Ordinary public report browsing does not require an application account cookie. Admin sign-in uses essential session and temporary challenge cookies with `HttpOnly` and `SameSite=Strict`; public HTTPS cookies are always Secure. Full admin sessions expire after eight hours and sign-out revokes the stored session.

## Retention and Removal

Parsed reports and cached game data remain until a maintainer deletes them; there is currently no automatic public-report expiration period. Temporary/incomplete parser uploads are cleaned after processing or abandonment. Hosting-provider logs and backups follow the provider's operational retention.

The private administrator identity and credentials remain until replaced or removed through operator maintenance. Session expiration ends authorization but does not promise immediate physical deletion of every expired database row. Expired challenge and code-reuse records, and rate-limit records older than 24 hours, are removed opportunistically during authentication requests. Password changes, session revocation and operator recovery invalidate the relevant current authentication records. Backups can retain older records until those backups expire; [restore procedures](docs/operations/admin-access.md#restoring-a-backup) require renewed admin enrollment before restored administration is exposed.

To request removal of a report or raise a privacy concern, contact the maintainer privately through a [GitHub security advisory](https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new) and identify the report URL and relevant in-game name. A request may require enough information to distinguish the report from unrelated guild data.

## Changes

Material changes to data collection, public visibility, or retention will be reflected in this file and `CHANGELOG.md`.
