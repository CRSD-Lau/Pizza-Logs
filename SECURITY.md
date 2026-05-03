# Security Policy

## Scope

Pizza Logs is a private combat log analytics tool for a WoW raiding guild. It does not handle:
- User accounts or passwords
- Payment information
- Personal health, financial, or government data

Data stored: WoW combat logs, player names (in-game names only), and parsed raid statistics.

## Admin Access

The `/admin` page and admin import APIs are protected by a server-side secret configured via environment variable (`ADMIN_SECRET`). Do not share this value. Production fails closed if `ADMIN_SECRET` is missing.

Browser-assisted Warmane userscripts may temporarily hold the admin secret in the admin's browser so they can post imported data back to Pizza Logs. Treat that browser storage as sensitive local state.

## Reporting a Vulnerability

If you discover a security issue (e.g., SQL injection, auth bypass, data exposure), please report it privately rather than opening a public issue.

**Contact:** Open a [private security advisory](https://github.com/CRSD-Lau/pizza-logs/security/advisories/new) on GitHub.

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

We'll respond as quickly as possible and credit you in the fix if you'd like.

## Supported Versions

Only the latest version deployed on Railway is actively maintained. There are no versioned releases with separate security support windows.
