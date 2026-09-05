# Security Policy

## Supported Version

Pizza Logs ships continuously. Only the current `main` branch and latest Railway production deployment receive security fixes; historical tags are snapshots, not separate support lines.

## Report a Vulnerability

Do not open a public issue for a suspected vulnerability. Use a [private GitHub security advisory](https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new) and include:

- the affected route, component, or configuration;
- reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- likely impact and any data accessed;
- suggested mitigation, if known.

Please avoid accessing data that is not yours, disrupting production, sending high-volume traffic, or publishing details before a fix is available. The maintainer will coordinate disclosure through the advisory.

## Security Scope

Pizza Logs stores and displays:

- uploaded filename, size, SHA-256 hash, optional uploader label, and parse status;
- public in-game character names, raid events, and derived performance statistics;
- cached PizzaWarriors roster and Warmane gear/profile data;
- protected operational diagnostics and upload administration data.
- the private administrator's email/name, password hash, encrypted MFA and recovery material, database sessions and authentication control records.

It does not provide public end-user accounts or store plaintext login passwords. It is not designed to hold payment data, health information, financial records or government identifiers. Administrator sessions and Railway/upstream service logs may contain ordinary request metadata such as IP address and user agent.

## Implemented Controls

### Upload and parser boundary

- Public uploads accept only `.txt`, `.log`, and `.zip` names and require an application-generated UUIDv4.
- The web and parser paths enforce a 100 MiB compressed upload ceiling.
- ZIP validation rejects unsafe paths, symlinks, encryption, nested archives, excess members, excessive expansion, and suspicious compression ratios.
- Archive members stream directly from the ZIP; they are never extracted as a directory tree.
- Parser request, receive, and processing times are bounded, and full parsing uses bounded worker/semaphore capacity.
- Parser responses are schema-validated before database persistence.
- Raw parser exceptions and internal paths are logged server-side and replaced with fixed public messages.
- Arbitrary filesystem parsing has been removed. Legacy multipart/debug/stream routes are disabled unless `ENABLE_LEGACY_PARSER_ROUTES` is explicitly enabled.

### Admin boundary

- Every environment fails closed when the server authentication key or allowed origin is missing or invalid.
- An operator provisions one administrator; public registration and social login are disabled. Password login must complete authenticator MFA before accessing administrative data.
- Database sessions expire after eight hours and carry server-recorded MFA proof. Every admin page, action and API verifies the designated identity and live session; cookie caching cannot delay revocation.
- Initial enrollment grants no administrative access. Completing enrollment revokes onboarding sessions and requires a fresh MFA login. Recovery cannot grant a password-only admin session.
- The old shared-secret login, header, body and cookie paths are removed. `ADMIN_SECRET` remains a server-only encryption/signing key and is never a browser credential.
- Authentication throttling persists in PostgreSQL. Cookie-authenticated API mutations and server actions require the exact configured origin in addition to their session checks.
- Gear and roster refreshes use authenticated first-party server paths.

See [admin access and recovery](docs/operations/admin-access.md) for provisioning, recovery and rollout verification.

### Application and delivery

- Security headers include a Content Security Policy, HSTS, frame denial, MIME sniffing protection, a restrictive referrer policy, and a restrictive permissions policy.
- Next.js removes the framework-identifying `X-Powered-By` header.
- GitHub Actions use least-privilege permissions and immutable commit pins.
- CI performs tests/builds, dependency review, and CodeQL analysis. Dependabot monitors npm, Python, and Actions dependencies.
- Python runtime and development installs use reviewed, hash-locked requirements.
- Both production containers run as unprivileged users.
- Repository ownership and branch rules require pull requests and passing checks for `main`.

The maintained threat model is in [docs/security/threat-model.md](docs/security/threat-model.md).

## Secrets and Production Configuration

- Never commit `.env*`, `ADMIN_SECRET`, `DATABASE_URL`, Railway credentials, webhook URLs, API keys, or private keys.
- Use a long randomly generated production `ADMIN_SECRET` and rotate it after suspected exposure.
- Do not set `ADMIN_COOKIE_SECURE=false` in Railway.
- Keep `PARSER_SERVICE_URL` on Railway's internal service path where available.
- Do not enable legacy parser routes in production.
- Treat database backups and exports as sensitive even though report pages are public.

## Known Residual Risks

- Public upload capacity is bounded per process, but there is no distributed rate limiter across multiple replicas.
- Public raid reports intentionally expose in-game character names and performance data.
- Warmane and CDN availability/behavior are outside this project's control; cached snapshots provide availability fallback.
- The sandboxed desktop character model loads Warmane CDN code in an isolated `srcdoc` frame. It has no same-origin permission, referrer, parent DOM access, or Pizza Logs credentials.
- Repository license inventory covers direct dependencies and reviews notable transitive licenses, but it is not legal advice.

## Security Verification

Maintainers should run the following before a security-sensitive release:

```bash
npm run check:pr
npm audit --audit-level=moderate
python -m pip install --require-hashes -r parser/requirements-dev.lock
python -m pip_audit -r parser/requirements.lock
cd parser && pytest tests/ -v
```

Also review the final staged diff for secrets, inspect any Prisma migration, and verify no `.env`, raw log, upload, cache, or generated machine-state file is staged.
