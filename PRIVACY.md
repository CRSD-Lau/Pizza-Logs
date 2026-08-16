# Privacy Notice

Last updated: 2026-08-15

Pizza Logs is a community raid-analysis service for PizzaWarriors. It has no end-user account system, advertising SDK, or payment flow.

## Data Processed

When a combat log is uploaded, Pizza Logs processes:

- the uploaded file's base filename, byte size, and SHA-256 hash;
- an optional uploader label plus selected guild, realm, host, and expansion values;
- public in-game character and pet names;
- timestamps, combat events, raid composition, encounters, and derived performance statistics.

Pizza Logs also stores public PizzaWarriors roster information and cached Warmane character equipment/profile data. It does not intentionally request or store Battle.net/Warmane passwords, email addresses, payment information, or real-world identity documents.

## How Data Is Used

Data is used to detect duplicate uploads, parse and display raid reports, calculate records and weekly summaries, provide player/gear views, and operate or troubleshoot the service.

Raw upload bytes are written temporarily by the parser during processing, then removed after completion or cleanup. The database keeps the parsed report and upload metadata; it does not keep a downloadable copy of the raw combat log.

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

Ordinary public report browsing does not require an application account cookie. The admin login uses an essential `HttpOnly`, `SameSite=Strict`, secure-in-production cookie to protect maintenance access.

## Retention and Removal

Parsed reports and cached game data remain until a maintainer deletes them; there is currently no automatic public-report expiration period. Temporary/incomplete parser uploads are cleaned after processing or abandonment. Hosting-provider logs and backups follow the provider's operational retention.

To request removal of a report or raise a privacy concern, contact the maintainer privately through a [GitHub security advisory](https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new) and identify the report URL and relevant in-game name. A request may require enough information to distinguish the report from unrelated guild data.

## Changes

Material changes to data collection, public visibility, or retention will be reflected in this file and `CHANGELOG.md`.
