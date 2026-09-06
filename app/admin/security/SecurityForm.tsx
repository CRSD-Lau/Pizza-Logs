"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { AuthError, RecoveryCodes, authErrorMessage, authInputClass, authLabelClass } from "../auth-form-ui";

export function SecurityForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function signOut(everywhere: boolean) {
    if (pending) return;
    setPending(everywhere ? "revoke" : "logout");
    setError(null);
    try {
      if (everywhere) {
        const revoked = await authClient.revokeSessions();
        if (revoked.error) {
          setError(authErrorMessage(revoked.error, "We could not sign out your devices. Please try again."));
          return;
        }
        try { await authClient.signOut(); } catch { /* Every server session has been revoked. */ }
      } else {
        const result = await authClient.signOut();
        if (result.error) {
          setError(authErrorMessage(result.error, "We could not sign you out. Please try again."));
          return;
        }
      }
      setRecoveryCodes([]);
      window.location.replace("/admin/login");
    } catch {
      setError("We could not complete sign out. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setNotice(null);
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setPending("password");
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not change your password. Check your details and try again."));
        return;
      }
      // The server revokes the session after a successful password change.
      try { await authClient.signOut(); } catch { /* Fresh authentication is required. */ }
      window.location.replace("/admin/login");
    } catch {
      setError("We could not change your password. Please try again.");
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPending(null);
    }
  }

  async function rotateRecoveryCodes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("recovery");
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password: recoveryPassword });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not replace your recovery codes. Please try again."));
        return;
      }
      setRecoveryCodes(result.data.backupCodes);
    } catch {
      setError("We could not replace your recovery codes. Please try again.");
    } finally {
      setRecoveryPassword("");
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-gold-dim pb-5 text-sm">
        <p className="break-all text-text-primary">{email}</p>
        <p className="text-text-secondary">Authenticator protection is required. To change your password or recovery codes, you must have signed in within the last 15 minutes.</p>
        <Link href="/admin" className="inline-flex min-h-11 items-center rounded-sm text-gold hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">Back to admin</Link>
      </div>
      <AuthError message={error} />
      {notice && <p role="status" className="text-sm text-text-secondary">{notice}</p>}
      {recoveryCodes.length ? (
        <RecoveryCodes codes={recoveryCodes} onSaved={() => { setRecoveryCodes([]); setNotice("Your new recovery codes are ready. The previous codes no longer work."); }} />
      ) : (
        <>
          <section aria-labelledby="password-title" className="space-y-4">
            <h2 id="password-title" className="text-lg font-semibold text-text-primary">Change password</h2>
            <p id="new-password-help" className="text-sm text-text-secondary">Use 14–128 characters. This signs out every device, including this one.</p>
            <form method="post" onSubmit={changePassword} className="space-y-4" aria-busy={pending === "password"}>
              <div className="space-y-1.5">
                <label htmlFor="current-password" className={authLabelClass}>Current password</label>
                <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={!!pending} className={authInputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-password" className={authLabelClass}>New password</label>
                <input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128} aria-describedby="new-password-help" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={!!pending} className={authInputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className={authLabelClass}>Confirm new password</label>
                <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={14} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={!!pending} className={authInputClass} />
              </div>
              <Button type="submit" disabled={!!pending || !currentPassword || !newPassword || !confirmation} className="w-full">{pending === "password" ? "Changing password…" : "Change password and sign out"}</Button>
            </form>
          </section>
          <section aria-labelledby="replace-recovery-title" className="space-y-4 border-t border-gold-dim pt-5">
            <h2 id="replace-recovery-title" className="text-lg font-semibold text-text-primary">Replace recovery codes</h2>
            <p className="text-sm text-text-secondary">This immediately invalidates your old recovery codes. Save the new codes before leaving this page.</p>
            <form method="post" onSubmit={rotateRecoveryCodes} className="space-y-4" aria-busy={pending === "recovery"}>
              <div className="space-y-1.5">
                <label htmlFor="recovery-password" className={authLabelClass}>Confirm your password</label>
                <input id="recovery-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} disabled={!!pending} className={authInputClass} />
              </div>
              <Button type="submit" disabled={!!pending || !recoveryPassword} className="w-full">{pending === "recovery" ? "Replacing codes…" : "Replace recovery codes"}</Button>
            </form>
          </section>
        </>
      )}
      <section aria-labelledby="sign-out-title" className="space-y-3 border-t border-gold-dim pt-5">
        <h2 id="sign-out-title" className="text-lg font-semibold text-text-primary">Sign out</h2>
        <p className="text-sm text-text-secondary">Signing out all devices ends every active session. Each device will need your password and an authenticator or recovery code to sign in again.</p>
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => signOut(false)} disabled={!!pending || recoveryCodes.length > 0}>{pending === "logout" ? "Signing out…" : "Sign out this device"}</Button>
          <Button type="button" variant="danger" onClick={() => signOut(true)} disabled={!!pending || recoveryCodes.length > 0}>{pending === "revoke" ? "Signing out devices…" : "Sign out all devices"}</Button>
        </div>
      </section>
    </div>
  );
}
