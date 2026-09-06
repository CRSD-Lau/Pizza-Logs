# Private Administrator Access

Author: Neil Mitchell
Last Modified By: Neil Mitchell

Pizza Logs has one designated administrator. Public registration, email-based password reset, social sign-in and changing the designated email through the browser are disabled. Authentication uses the existing PostgreSQL database and a local authenticator app; it does not add a paid authentication or email service.

## Configure and provision

The owner must configure these values privately on the intended web service before enabling administrator access:

- `DATABASE_URL`: the intended database connection, already required by Pizza Logs.
- `ADMIN_SECRET`: a random server encryption/signing key of at least 32 characters. It is never entered into the login page. Generate it with a password manager or a cryptographically secure generator and retain it privately.
- `ADMIN_AUTH_URL`: the exact public HTTPS origin, for example `https://logs.example.com`, with no path, query or credentials. This is also the only accepted origin for browser mutations.

Missing or invalid auth configuration leaves admin access locked. Public HTTPS always uses Secure cookies. Local HTTP tests may use a loopback origin; production-mode containers on local HTTP also require the loopback-only `ADMIN_COOKIE_SECURE=false` override. Do not change production environment variables from an agent session.

After the reviewed migration is applied, use a trusted checkout with dependencies installed and the intended environment loaded:

```bash
npm run admin:account -- provision
```

This interactive command asks for the administrator email and a password of 14–128 characters. Password input is hidden and must be repeated; never put credentials in arguments, source files or issue comments. Provisioning refuses to replace an existing administrator. The email identifies the account; no email is sent and mailbox ownership is not independently verified. Access to the database and this operator command is privileged access.

## First sign-in

1. Open `/admin/login` and enter the provisioned email and password.
2. Complete the authenticator setup page. Add its private setup key to an authenticator app using time-based, six-digit codes that change every 30 seconds.
3. Verify a code and save the displayed recovery codes privately. Each recovery code works once.
4. Sign in again with the password and an authenticator or recovery code. Enrollment revokes the temporary sessions; only the fresh two-step sign-in grants administrator access.

A password-only session can access enrollment for 15 minutes and cannot open admin data or invoke admin mutations. Full sessions expire after eight hours without sliding renewal. Server-side checks protect pages, metadata, actions and the roster API; the routing proxy only redirects requests that obviously lack a session cookie.

## Security and recovery

`/admin/security` provides password changes, replacement recovery codes, sign-out for the current device and sign-out for every device. Password changes and recovery-code replacement require a full MFA sign-in within the last 15 minutes; sign out and sign in again if that window has elapsed. A password change signs out every device. Old recovery codes stop working when replacements are generated. There is no browser control to disable MFA.

If the authenticator is unavailable, use an unused recovery code at sign-in. If both the authenticator and recovery codes are lost, use the trusted operator environment:

```bash
npm run admin:account -- recover
```

Recovery requires the existing designated email, an explicit `RECOVER` confirmation and a new password. It revokes sessions and pending challenges, removes the old factor and requires enrollment again. It does not grant a full session or change the designated account. Keep this command restricted to the owner; no public recovery endpoint exists.

Authentication attempts are throttled in PostgreSQL, including account-wide challenge limits. Retrying immediately after a limit is reached will continue to fail. Errors shown to the browser are generic. Time-based code reuse and concurrent recovery-code consumption are checked server-side.

## Deployment and acceptance

The additive `20260905120000_add_private_admin_mfa` migration creates eight auth tables and does not rewrite raid, upload or player tables. Inspect the migration and preserve the normal verified database backup before deployment. The previous shared-secret browser login, `x-admin-secret` authorization and roster body-secret authorization are removed. Existing admin cookies stop granting access.

After the reviewed application deployment and owner configuration, provision the real account and verify enrollment, fresh MFA login, a read-only admin page, sign-out and rejected reuse of the signed-out session. Verify production readiness and the normal [production smoke checks](railway.md). Local synthetic tests do not establish that production configuration or enrollment is complete.

Production acceptance for issue [#75](https://github.com/CRSD-Lau/Pizza-Logs/issues/75) was recorded on 2026-09-06: owner provisioning and authenticator enrollment were complete, and MFA-authenticated admin access was verified. Signing out the current device deleted its one active MFA session; a fresh `/admin` navigation in the same browser required login, while the designated account and authenticator factor remained unchanged. The previous cookie was not retrieved or directly replayed. The owner also accepted the separate [streaming and reupload recovery decision](../adr/0004-durable-upload-boundary.md).

Retain the server-key version associated with each database backup in protected secret storage, separately from the dump. Never put it in plaintext beside a backup. Replacing the key invalidates cookies and can make encrypted factors unreadable; plan operator recovery and fresh enrollment when rotating it. Never solve a rollout problem by reinstating the old shared-secret bypass. An application rollback requires review of its auth behavior; leaving the additive tables in place preserves evidence and avoids destructive rollback migrations.

## Restoring a backup

An older database snapshot can restore previously revoked sessions or consumed recovery codes. Keep the restored service's administration inaccessible while comparing the restored evidence with the backup. After that comparison, run the operator recovery command for the same designated identity to replace the password, invalidate restored sessions/challenges and remove old factors/recovery codes. Complete new enrollment and fresh MFA login before exposing restored administration. Preserve the original backup for evidence; do not modify it to make a comparison pass. See [service recovery](service-objectives.md) for the wider database procedure.

This login does not make interrupted uploads resumable or turn process-local admission into a distributed queue. The owner-approved [upload decision](../adr/0004-durable-upload-boundary.md) retains reupload after interruption; durable orchestration requires a separate future request.
