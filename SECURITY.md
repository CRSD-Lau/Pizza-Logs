# Security Policy

## Scope

Pizza Logs is a combat-log analytics tool for a WoW raiding guild. It stores in-game character names, uploaded combat-log metadata, parsed raid statistics, cached guild roster rows, and cached Warmane gear snapshots.

Pizza Logs does not handle user account passwords, payment information, health data, financial data, or government identifiers.

## Admin Access

The `/admin` page, admin upload history, cleanup actions, and import APIs are protected by a server-side secret configured with `ADMIN_SECRET`.

- Production fails closed if `ADMIN_SECRET` is missing.
- The admin login sets an `HttpOnly` `x-admin-secret` cookie.
- `ADMIN_COOKIE_SECURE=false` is only for local HTTP compose and must not be set in Railway production.
- Browser-assisted Warmane userscripts may temporarily store the admin secret in the admin's browser so they can post imported data back to Pizza Logs. Treat that browser storage as sensitive local state.

## Current Risks

- `/api/upload` does not yet enforce a hard server-side byte limit while streaming to the parser.
- Upload rate limiting is not implemented in app code.
- Warmane roster/gear/portrait flows depend on browser-assisted imports because direct server fetches can hit Cloudflare/403 behavior.

## Reporting A Vulnerability

Report security issues privately instead of opening a public issue.

Contact: open a private security advisory at https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new

Include:

- what is vulnerable;
- steps to reproduce;
- likely impact;
- affected routes, files, or configuration if known.

## Supported Versions

Only the latest Railway production deployment is actively maintained. Pizza Logs does not publish versioned releases with separate support windows.
